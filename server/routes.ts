import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { mediaItems, mediaTags, familyRelations, users, albums, albumMembers } from "@db/schema";
import { and, eq, or } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from 'express';
import mime from 'mime-types';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

export function registerRoutes(app: Express): Server {
  // Setup auth routes first
  setupAuth(app);

  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res, filePath) => {
      // Set proper MIME type
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Set caching headers
      res.setHeader('Cache-Control', 'no-cache');

      // Enable partial content support
      res.setHeader('Accept-Ranges', 'bytes');

      console.log('Serving file:', {
        path: filePath,
        contentType: mimeType,
        size: fs.statSync(filePath).size
      });
    },
    index: false,
    dotfiles: 'deny'
  }));

  // Get all users (for family relations)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(users);

    res.json(allUsers);
  });

  // Albums endpoints
  app.get("/api/albums", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userAlbums = await db
        .select()
        .from(albums)
        .where(eq(albums.createdBy, req.user.id));

      const sharedAlbums = await db
        .select({
          album: albums,
          member: albumMembers,
        })
        .from(albums)
        .innerJoin(
          albumMembers,
          and(
            eq(albumMembers.albumId, albums.id),
            eq(albumMembers.userId, req.user.id)
          )
        );

      // Combine user's albums and shared albums
      const combinedAlbums = [
        ...userAlbums,
        ...sharedAlbums.map(({ album }) => album),
      ];

      res.json(combinedAlbums);
    } catch (error) {
      console.error('Error fetching albums:', error);
      res.status(500).send("Error fetching albums");
    }
  });

  app.post("/api/albums", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { name, description, isShared } = req.body;

    const [album] = await db
      .insert(albums)
      .values({
        name,
        description,
        createdBy: req.user.id,
        isShared: isShared || false,
      })
      .returning();

    res.json(album);
  });

  app.post("/api/albums/:albumId/members", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId } = req.params;
    const { userId, canEdit } = req.body;

    // Check if user has permission to add members
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, parseInt(albumId)))
      .limit(1);

    if (!album || album.createdBy !== req.user.id) {
      return res.status(403).send("Not authorized to add members to this album");
    }

    const [member] = await db
      .insert(albumMembers)
      .values({
        albumId: parseInt(albumId),
        userId,
        canEdit: canEdit || false,
      })
      .returning();

    res.json(member);
  });

  // Media endpoints
  app.get("/api/media", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const items = await db.query.mediaItems.findMany({
      where: eq(mediaItems.userId, req.user.id),
      with: {
        tags: true,
      },
    });
    res.json(items);
  });

  app.post("/api/media", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    try {
      // Log upload details
      console.log('File upload:', {
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Verify file was written correctly
      const stats = await fs.promises.stat(req.file.path);
      console.log('File stats:', {
        size: stats.size,
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid
      });

      // Ensure file permissions allow reading
      await fs.promises.chmod(req.file.path, 0o644);

      const { type, title, description, albumId } = req.body;
      const url = `/uploads/${req.file.filename}`;

      // If albumId is provided, check if user has permission to add to album
      if (albumId) {
        const [album] = await db
          .select()
          .from(albums)
          .where(eq(albums.id, parseInt(albumId)))
          .limit(1);

        const [member] = await db
          .select()
          .from(albumMembers)
          .where(and(
            eq(albumMembers.albumId, parseInt(albumId)),
            eq(albumMembers.userId, req.user.id)
          ))
          .limit(1);

        if (!album || (!member && album.createdBy !== req.user.id)) {
          return res.status(403).send("Not authorized to add media to this album");
        }
      }

      const [item] = await db
        .insert(mediaItems)
        .values({
          userId: req.user.id,
          albumId: albumId ? parseInt(albumId) : null,
          type,
          title,
          description,
          url,
          metadata: {
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
          },
        })
        .returning();

      res.json(item);
    } catch (error) {
      console.error('Error handling upload:', error);
      res.status(500).send("Error processing uploaded file");
    }
  });

  // Family relations endpoints
  app.get("/api/family", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const relations = await db.query.familyRelations.findMany({
      where: or(
        eq(familyRelations.fromUserId, req.user.id),
        eq(familyRelations.toUserId, req.user.id)
      ),
      with: {
        fromUser: true,
        toUser: true,
      },
    });
    res.json(relations);
  });

  app.post("/api/family", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { toUserId, relationType } = req.body;

    // Validate relation type
    const validRelationTypes = ['parent', 'child', 'sibling', 'spouse'];
    if (!validRelationTypes.includes(relationType)) {
      return res.status(400).send("Invalid relation type");
    }

    const [relation] = await db
      .insert(familyRelations)
      .values({
        fromUserId: req.user.id,
        toUserId,
        relationType,
      })
      .returning();

    res.json(relation);
  });

  app.delete("/api/family/:relationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { relationId } = req.params;

    try {
      // Check if the user has permission to delete this relation
      const [relation] = await db
        .select()
        .from(familyRelations)
        .where(eq(familyRelations.id, parseInt(relationId)))
        .limit(1);

      if (!relation) {
        return res.status(404).send("Relation not found");
      }

      // Only allow users to delete relations they're part of
      if (relation.fromUserId !== req.user.id && relation.toUserId !== req.user.id) {
        return res.status(403).send("Not authorized to delete this relation");
      }

      await db
        .delete(familyRelations)
        .where(eq(familyRelations.id, parseInt(relationId)));

      res.json({ message: "Relation deleted successfully" });
    } catch (error) {
      console.error('Error deleting relation:', error);
      res.status(500).send("Error deleting relation");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}