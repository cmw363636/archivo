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

  // Media streaming handler with improved error handling and CORS
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
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Accept-Ranges, Content-Range, Content-Type',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
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
          title: title?.trim() || null,
          description: description?.trim() || null,
          url,
          website_url: type === 'post' ? websiteUrl?.trim() || null : null,
          content: type === 'post' ? content?.trim() || null : null,
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
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user.id;
      const uploadedOnly = req.query.uploaded === 'true';

      if (uploadedOnly) {
        // If uploaded=true, only get media directly uploaded by the user
        const userMedia = await db.query.mediaItems.findMany({
          where: albumId
            ? and(
                eq(mediaItems.userId, userId),
                eq(mediaItems.albumId, albumId)
              )
            : eq(mediaItems.userId, userId),
          with: {
            tags: true,
          },
        });

        return res.json(userMedia);
      }

      // Otherwise, get both uploaded and tagged media
      const userMedia = await db.query.mediaItems.findMany({
        where: albumId
          ? and(
              eq(mediaItems.userId, userId),
              eq(mediaItems.albumId, albumId)
            )
          : eq(mediaItems.userId, userId),
        with: {
          tags: true,
        },
      });

      const taggedMedia = await db.query.mediaTags.findMany({
        where: eq(mediaTags.userId, userId),
        with: {
          mediaItem: {
            with: {
              tags: true,
              user: true,
            },
          },
        },
      });

      // Combine and deduplicate the results
      const taggedMediaItems = taggedMedia.map(tag => tag.mediaItem);
      const allMedia = [...userMedia, ...taggedMediaItems];
      const uniqueMedia = Array.from(new Map(allMedia.map(item => [item.id, item])).values());

      // Sort by creation date
      uniqueMedia.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(uniqueMedia);
    } catch (error) {
      console.error('Error fetching media items:', error);
      res.status(500).send("Error fetching media items");
    }
  });


  // Add new endpoint to fetch media where user is tagged
  app.get("/api/media/tagged", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user.id;

    try {
      const taggedMedia = await db.query.mediaTags.findMany({
        where: eq(mediaTags.userId, userId),
        with: {
          mediaItem: {
            with: {
              user: true,
            },
          },
        },
      });

      // Transform the response to match the MediaItem type
      const mediaItems = taggedMedia.map(tag => tag.mediaItem);

      res.json(mediaItems);
    } catch (error) {
      console.error('Error fetching tagged media:', error);
      res.status(500).send("Error fetching tagged media");
    }
  });

  // Add media update endpoint
  app.patch("/api/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;
    const { title, description } = req.body;

    try {
      // Check if the media item exists and belongs to the user
      const [mediaItem] = await db
        .select()
        .from(mediaItems)
        .where(
          and(
            eq(mediaItems.id, parseInt(mediaId)),
            eq(mediaItems.userId, req.user.id)
          )
        )
        .limit(1);

      if (!mediaItem) {
        return res.status(404).send("Media item not found or unauthorized");
      }

      // Update the media item
      const [updatedItem] = await db
        .update(mediaItems)
        .set({
          title: title?.trim() || mediaItem.title,
          description: description?.trim() || null,
        })
        .where(eq(mediaItems.id, parseInt(mediaId)))
        .returning();

      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating media:', error);
      res.status(500).send("Error updating media");
    }
  });

  // Add media delete endpoint
  app.delete("/api/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;

    try {
      // Check if the media item exists and belongs to the user
      const [mediaItem] = await db
        .select()
        .from(mediaItems)
        .where(
          and(
            eq(mediaItems.id, parseInt(mediaId)),
            eq(mediaItems.userId, req.user.id)
          )
        )
        .limit(1);

      if (!mediaItem) {
        return res.status(404).send("Media item not found or unauthorized");
      }

      // Delete any associated tags first
      await db
        .delete(mediaTags)
        .where(eq(mediaTags.mediaId, parseInt(mediaId)));

      // Delete the media item
      await db
        .delete(mediaItems)
        .where(eq(mediaItems.id, parseInt(mediaId)));

      // If there's a file associated, delete it
      if (mediaItem.url && mediaItem.url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), mediaItem.url.slice(1));
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
          // Continue even if file deletion fails
        }
      }

      res.json({ message: "Media deleted successfully" });
    } catch (error) {
      console.error('Error deleting media:', error);
      res.status(500).send("Error deleting media");
    }
  });

  // Get tags for a media item
  app.get("/api/media/:mediaId/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;

    try {
      const tags = await db.query.mediaTags.findMany({
        where: eq(mediaTags.mediaId, parseInt(mediaId)),
        with: {
          user: true,
        },
      });

      res.json(tags);
    } catch (error) {
      console.error('Error fetching media tags:', error);
      res.status(500).send("Error fetching media tags");
    }
  });

  // Add a tag to a media item
  app.post("/api/media/:mediaId/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;
    const { userId } = req.body;

    try {
      // Check if tag already exists
      const [existingTag] = await db
        .select()
        .from(mediaTags)
        .where(
          and(
            eq(mediaTags.mediaId, parseInt(mediaId)),
            eq(mediaTags.userId, userId)
          )
        )
        .limit(1);

      if (existingTag) {
        return res.status(400).send("User already tagged in this media");
      }

      const [tag] = await db
        .insert(mediaTags)
        .values({
          mediaId: parseInt(mediaId),
          userId,
        })
        .returning();

      res.json(tag);
    } catch (error) {
      console.error('Error adding media tag:', error);
      res.status(500).send("Error adding media tag");
    }
  });

  // Remove a tag from a media item
  app.delete("/api/media/:mediaId/tags/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId, userId } = req.params;

    try {
      await db
        .delete(mediaTags)
        .where(
          and(
            eq(mediaTags.mediaId, parseInt(mediaId)),
            eq(mediaTags.userId, parseInt(userId))
          )
        );

      res.json({ message: "Tag removed successfully" });
    } catch (error) {
      console.error('Error removing media tag:', error);
      res.status(500).send("Error removing media tag");
    }
  });

  // Users endpoint (add before albums endpoints)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const usersList = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        })
        .from(users);

      res.json(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).send("Error fetching users");
    }
  });

  // Albums endpoints
  app.get("/api/albums", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Get user's created albums with media items and members count
      const userAlbums = await db.query.albums.findMany({
        where: eq(albums.createdBy, req.user.id),
        with: {
          mediaItems: true,
          members: {
            with: {
              user: {
                columns: {
                  username: true,
                  displayName: true
                }
              }
            }
          }
        }
      });

      // Get shared albums with media items and members count
      const sharedAlbums = await db.query.albumMembers.findMany({
        where: eq(albumMembers.userId, req.user.id),
        with: {
          album: {
            with: {
              mediaItems: true,
              members: {
                with: {
                  user: {
                    columns: {
                      username: true,
                      displayName: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Format shared albums to match user albums structure
      const formattedSharedAlbums = sharedAlbums.map(({ album }) => album);

      // Combine and return all albums
      const allAlbums = [...userAlbums, ...formattedSharedAlbums];

      res.json(allAlbums);
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

  // Add member removal endpoint
  app.delete("/api/albums/:albumId/members/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId, userId } = req.params;

    try {
      // Check if user has permission to remove members
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, parseInt(albumId)))
        .limit(1);

      if (!album) {
        return res.status(404).send("Album not found");
      }

      if (album.createdBy !== req.user.id) {
        return res.status(403).send("Not authorized to remove members from this album");
      }

      // Remove the member from the album
      await db
        .delete(albumMembers)
        .where(
          and(
            eq(albumMembers.albumId, parseInt(albumId)),
            eq(albumMembers.userId, parseInt(userId))
          )
        );

      res.json({ message: "Member removed successfully" });
    } catch (error) {
      console.error('Error removing album member:', error);
      res.status(500).send("Error removing album member");
    }
  });

  // Add media to album endpoint
  app.post("/api/albums/:albumId/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId, mediaId } = req.params;

    try {
      // Check if user has permission to add media to this album
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, parseInt(albumId)))
        .limit(1);

      if (!album) {
        return res.status(404).send("Album not found");
      }

      // Check if user is album creator or has edit permissions
      const [member] = album.createdBy === req.user.id
        ? [true]
        : await db
            .select()
            .from(albumMembers)
            .where(
              and(
                eq(albumMembers.albumId, parseInt(albumId)),
                eq(albumMembers.userId, req.user.id),
                eq(albumMembers.canEdit, true)
              )
            )
            .limit(1);

      if (!member) {
        return res.status(403).send("Not authorized to add media to this album");
      }

      // Update the media item to be part of this album
      await db
        .update(mediaItems)
        .set({ albumId: parseInt(albumId) })
        .where(
          and(
            eq(mediaItems.id, parseInt(mediaId)),
            eq(mediaItems.userId, req.user.id)
          )
        );

      res.json({ message: "Media added to album successfully" });
    } catch (error) {
      console.error('Error adding media to album:', error);
      res.status(500).send("Error adding media to album");
    }
  });

  // Add remove media from album endpoint
  app.delete("/api/albums/:albumId/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId, mediaId } = req.params;

    try {
      // Check if user has permission to remove media from this album
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, parseInt(albumId)))
        .limit(1);

      if (!album) {
        return res.status(404).send("Album not found");
      }

      // Check if user is album creator or has edit permissions
      const [member] = album.createdBy === req.user.id
        ? [true]
        : await db
            .select()
            .from(albumMembers)
            .where(
              and(
                eq(albumMembers.albumId, parseInt(albumId)),
                eq(albumMembers.userId, req.user.id),
                eq(albumMembers.canEdit, true)
              )
            )
            .limit(1);

      if (!member) {
        return res.status(403).send("Not authorized to remove media from this album");
      }

      // Remove media from album by setting albumId to null
      await db
        .update(mediaItems)
        .set({ albumId: null })
        .where(
          and(
            eq(mediaItems.id, parseInt(mediaId)),
            eq(mediaItems.albumId, parseInt(albumId))
          )
        );

      res.json({ message: "Media removed from album successfully" });
    } catch (error) {
      console.error('Error removing media from album:', error);
      res.status(500).send("Error removing media from album");
    }
  });

  // Add delete album endpoint
  app.delete("/api/albums/:albumId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId } = req.params;

    try {
      // Check if user has permission to delete this album
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, parseInt(albumId)))
        .limit(1);

      if (!album) {
        return res.status(404).send("Album not found");
      }

      if (album.createdBy !== req.user.id) {
        return res.status(403).send("Not authorized to delete this album");
      }

      // Delete the album
      await db
        .delete(albums)
        .where(eq(albums.id, parseInt(albumId)));

      res.json({ message: "Album deleted successfully" });
    } catch (error) {
      console.error('Error deleting album:', error);
      res.status(500).send("Error deleting album");
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

  // Add new profile update route
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { dateOfBirth } = req.body;

    try {
      // Update user profile
      const [updatedUser] = await db
        .update(users)
        .set({
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).send("Error updating user profile");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}