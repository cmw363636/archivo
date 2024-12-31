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

  // Enable CORS pre-flight
  app.options('/uploads/:filename', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, Content-Type');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.status(204).send();
  });

  // Media streaming handler with improved error handling
  app.get('/uploads/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.resolve(uploadDir, filename);

      // Security check: ensure the file path is within uploads directory
      if (!filePath.startsWith(uploadDir)) {
        console.error('Invalid file path access attempt:', filePath);
        return res.status(403).send('Access denied');
      }

      // Check if file exists and is readable
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
        console.error(`File not accessible: ${filePath}`, error);
        return res.status(404).send('File not found or not accessible');
      }

      // Get file stats
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';

      // Set common headers
      const headers = {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Accept-Ranges, Content-Range, Content-Type',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      };

      // Handle range requests (for video/audio streaming)
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
          res.status(416).send('Requested range not satisfiable');
          return;
        }

        const chunkSize = (end - start) + 1;
        console.log('Streaming file with range:', {
          path: filePath,
          contentType: mimeType,
          range,
          start,
          end,
          size: chunkSize
        });

        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize,
        });

        stream.pipe(res);
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).send('Error streaming file');
          }
        });
      } else {
        console.log('Streaming entire file:', {
          path: filePath,
          contentType: mimeType,
          size: fileSize
        });

        res.writeHead(200, {
          ...headers,
          'Content-Length': fileSize,
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).send('Error streaming file');
          }
        });
      }
    } catch (error) {
      console.error('Unexpected error during file streaming:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  // Media upload endpoint with improved error handling and logging
  app.post("/api/media", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { type, title, description, websiteUrl, content, albumId } = req.body;

    try {
      let url = '';

      // For post type, file is optional
      if (type === 'post') {
        url = req.file ? `/uploads/${req.file.filename}` : '';

        // If there's a file, verify it was written correctly
        if (req.file) {
          const stats = await fs.promises.stat(req.file.path);
          console.log('File stats:', {
            size: stats.size,
            mode: stats.mode,
            uid: stats.uid,
            gid: stats.gid
          });

          // Ensure file permissions allow reading
          await fs.promises.chmod(req.file.path, 0o644);
        }
      } else {
        // For other types, file is required
        if (!req.file) {
          return res.status(400).send("No file uploaded");
        }
        url = `/uploads/${req.file.filename}`;

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
          website_url: type === 'post' ? websiteUrl : null,
          content: type === 'post' ? content : null,
          metadata: req.file ? {
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
          } : null,
        })
        .returning();

      res.json(item);
    } catch (error) {
      console.error('Error handling upload:', error);
      res.status(500).send("Error processing uploaded file");
    }
  });

  // Media endpoints
  app.get("/api/media", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const albumId = req.query.albumId ? parseInt(req.query.albumId as string) : undefined;

      const items = await db.query.mediaItems.findMany({
        where: albumId 
          ? and(
              eq(mediaItems.userId, req.user.id),
              eq(mediaItems.albumId, albumId)
            )
          : eq(mediaItems.userId, req.user.id),
        with: {
          tags: true,
        },
        orderBy: (mediaItems, { desc }) => [desc(mediaItems.createdAt)],
      });

      console.log('Fetched media items:', {
        count: items.length,
        items: items.map(item => ({
          id: item.id,
          type: item.type,
          url: item.url
        }))
      });

      res.json(items);
    } catch (error) {
      console.error('Error fetching media items:', error);
      res.status(500).send("Error fetching media items");
    }
  });


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