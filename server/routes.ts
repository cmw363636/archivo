import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { mediaItems, mediaTags, familyRelations, users, albums, albumMembers, memories } from "@db/schema";
import { and, eq, or, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from 'express';
import mime from 'mime-types';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
  setupAuth(app);

  app.options('/uploads/:filename', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, Content-Type');
    res.header('Access-Control-Max-Age', '86400'); 
    res.status(204).send();
  });

  app.get('/uploads/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.resolve(uploadDir, filename);

      if (!filePath.startsWith(uploadDir)) {
        console.error('Invalid file path access attempt:', filePath);
        return res.status(403).send('Access denied');
      }

      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
        console.error(`File not accessible: ${filePath}`, error);
        return res.status(404).send('File not found or not accessible');
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';

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

  app.post("/api/media", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { type, title, description, websiteUrl, content, albumId, mediaDate } = req.body;

    try {
      let url = '';

      if (type === 'post') {
        url = req.file ? `/uploads/${req.file.filename}` : '';

        if (req.file) {
          const stats = await fs.promises.stat(req.file.path);
          console.log('File stats:', {
            size: stats.size,
            mode: stats.mode,
            uid: stats.uid,
            gid: stats.gid
          });

          await fs.promises.chmod(req.file.path, 0o644);
        }
      } else {
        if (!req.file) {
          return res.status(400).send("No file uploaded");
        }
        url = `/uploads/${req.file.filename}`;

        const stats = await fs.promises.stat(req.file.path);
        console.log('File stats:', {
          size: stats.size,
          mode: stats.mode,
          uid: stats.uid,
          gid: stats.gid
        });

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
          mediaDate: mediaDate ? new Date(mediaDate) : new Date(),
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

  app.get("/api/media", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const albumId = req.query.albumId ? parseInt(req.query.albumId as string) : undefined;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user.id;
      const uploadedOnly = req.query.uploaded === 'true';

      if (uploadedOnly) {
        const userMedia = await db.query.mediaItems.findMany({
          where: albumId
            ? and(
                eq(mediaItems.userId, userId),
                eq(mediaItems.albumId, albumId)
              )
            : eq(mediaItems.userId, userId),
          with: {
            user: {
              columns: {
                username: true,
                displayName: true
              }
            }
          },
          orderBy: [desc(mediaItems.createdAt)]
        });

        return res.json(userMedia);
      }

      // For non-uploadedOnly requests, return both uploaded and tagged media
      const userMedia = await db.query.mediaItems.findMany({
        where: albumId
          ? and(
              eq(mediaItems.userId, userId),
              eq(mediaItems.albumId, albumId)
            )
          : eq(mediaItems.userId, userId),
        with: {
          user: {
            columns: {
              username: true,
              displayName: true
            }
          }
        },
        orderBy: [desc(mediaItems.createdAt)]
      });

      const taggedMedia = await db.query.mediaTags.findMany({
        where: eq(mediaTags.userId, userId),
        with: {
          mediaItem: {
            with: {
              tags: true,
              user: {
                columns: {
                  username: true,
                  displayName: true
                }
              },
            },
          },
        },
      });

      const taggedMediaItems = taggedMedia.map(tag => tag.mediaItem);
      const allMedia = [...userMedia, ...taggedMediaItems];
      const uniqueMedia = Array.from(new Map(allMedia.map(item => [item.id, item])).values());

      uniqueMedia.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(uniqueMedia);
    } catch (error) {
      console.error('Error fetching media items:', error);
      res.status(500).send("Error fetching media items");
    }
  });


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

      const mediaItems = taggedMedia.map(tag => tag.mediaItem);

      res.json(mediaItems);
    } catch (error) {
      console.error('Error fetching tagged media:', error);
      res.status(500).send("Error fetching tagged media");
    }
  });

  app.patch("/api/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;
    const { title, description, mediaDate } = req.body;

    try {
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

      const [updatedItem] = await db
        .update(mediaItems)
        .set({
          title: title?.trim() || null,
          description: description?.trim() || null,
          mediaDate: mediaDate ? new Date(mediaDate) : mediaItem.mediaDate,
        })
        .where(eq(mediaItems.id, parseInt(mediaId)))
        .returning();

      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating media:', error);
      res.status(500).send("Error updating media");
    }
  });

  app.delete("/api/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;

    try {
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

      await db
        .delete(mediaTags)
        .where(eq(mediaTags.mediaId, parseInt(mediaId)));

      await db
        .delete(mediaItems)
        .where(eq(mediaItems.id, parseInt(mediaId)));

      if (mediaItem.url && mediaItem.url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), mediaItem.url.slice(1));
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }

      res.json({ message: "Media deleted successfully" });
    } catch (error) {
      console.error('Error deleting media:', error);
      res.status(500).send("Error deleting media");
    }
  });

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

  app.post("/api/media/:mediaId/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { mediaId } = req.params;
    const { userId } = req.body;

    try {
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

  app.get("/api/users/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const userId = parseInt(req.params.userId);

    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          email: users.email,
          dateOfBirth: users.dateOfBirth,
          profilePicture: users.profilePicture,
          story: users.story,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).send("User not found");
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).send("Error fetching user");
    }
  });

  app.get("/api/albums", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
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

      const formattedSharedAlbums = sharedAlbums.map(({ album }) => album);

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

  app.delete("/api/albums/:albumId/members/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId, userId } = req.params;

    try {
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

  app.post("/api/albums/:albumId/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId, mediaId } = req.params;

    try {
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, parseInt(albumId)))
        .limit(1);

      if (!album) {
        return res.status(404).send("Album not found");
      }

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

  app.delete("/api/albums/:albumId/media/:mediaId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId, mediaId } = req.params;

    try {
      const [album] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, parseInt(albumId)))
        .limit(1);

      if (!album) {
        return res.status(404).send("Album not found");
      }

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

  app.delete("/api/albums/:albumId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { albumId } = req.params;

    try {
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

      await db
        .delete(albums)
        .where(eq(albums.id, parseInt(albumId)));

      res.json({ message: "Album deleted successfully" });
    } catch (error) {
      console.error('Error deleting album:', error);
      res.status(500).send("Error deleting album");
    }
  });

  app.get("/api/family", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user.id;

      const relations = await db.query.familyRelations.findMany({
        where: or(
          eq(familyRelations.fromUserId, userId),
          eq(familyRelations.toUserId, userId)
        ),
        with: {
          fromUser: true,
          toUser: true,
        },
      });

      res.json(relations);
    } catch (error) {
      console.error('Error fetching family relations:', error);
      res.status(500).send("Error fetching family relations");
    }
  });

  app.post("/api/family", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { parentId, relationType, targetUserId } = req.body;
    const childId = targetUserId || req.user.id;

    const validRelationTypes = ['parent', 'child', 'sibling', 'spouse'];
    if (!validRelationTypes.includes(relationType)) {
      return res.status(400).send("Invalid relation type");
    }

    const relationTypeMap = {
      parent: 'child',
      child: 'parent',
      spouse: 'spouse',
      sibling: 'sibling'
    } as const;

    try {
      console.log('Creating family relation:', {
        parentId,
        childId,
        relationType,
        targetUserId
      });

      // For parent relationships
      if (relationType === 'parent') {
        console.log('Creating parent-child relationship:', {
          parent: parentId,
          child: childId
        });

        // Create the parent -> child relation
        const [parentChildRelation] = await db
          .insert(familyRelations)
          .values({
            fromUserId: parentId,    // The parent
            toUserId: childId,       // The current user
            relationType: 'parent',  // The parent is the parent
          })
          .returning();

        console.log('Created parent->child relation:', parentChildRelation);

        // Create the corresponding child -> parent relation
        const [childParentRelation] = await db
          .insert(familyRelations)
          .values({
            fromUserId: childId,     // The current user
            toUserId: parentId,      // The parent
            relationType: 'child',   // The current user is the child
          })
          .returning();

        console.log('Created child->parent relation:', childParentRelation);

        return res.json(parentChildRelation);
      }

      // For all other relationship types
      console.log('Creating non-parent relationship:', {
        fromUserId: req.user.id,
        toUserId: parentId,
        type: relationType
      });

      // Create the primary relation
      const [relation] = await db
        .insert(familyRelations)
        .values({
          fromUserId: req.user.id,  // Always use the authenticated user as fromUserId
          toUserId: parentId,       // The target user as toUserId
          relationType,             // The specified relationship type
        })
        .returning();

      console.log('Created primary relation:', relation);

      // Create the reciprocal relation
      const reciprocalType = relationTypeMap[relationType];
      const [reciprocalRelation] = await db
        .insert(familyRelations)
        .values({
          fromUserId: parentId,       // The target user
          toUserId: req.user.id,      // The authenticated user
          relationType: reciprocalType,// The reciprocal relationship type
        })
        .returning();

      console.log('Created reciprocal relation:', reciprocalRelation);

      res.json(relation);
    } catch (error) {
      console.error('Error creating family relation:', {
        error,
        childId,
        parentId,
        relationType,
        targetUserId
      });
      res.status(500).send("Error creating family relation");
    }
  });

  app.delete("/api/family/:relationId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { relationId } = req.params;

    try {
      // Get the initial relation
      const [relation] = await db
        .select()
        .from(familyRelations)
        .where(eq(familyRelations.id, parseInt(relationId)));

      if (!relation) {
        return res.status(404).send("Relation not found");
      }

      // Check if the user is involved in the relationship
      if (relation.fromUserId !== req.user.id && relation.toUserId !== req.user.id) {
        return res.status(403).send("Not authorized to delete this relation");
      }

      // Delete both directions of the relationship
      await db
        .delete(familyRelations)
        .where(
          or(
            // Original relationship pair
            and(
              eq(familyRelations.fromUserId, relation.fromUserId),
              eq(familyRelations.toUserId, relation.toUserId)
            ),
            // Reciprocal relationship pair
            and(
              eq(familyRelations.fromUserId, relation.toUserId),
              eq(familyRelations.toUserId, relation.fromUserId)
            )
          )
        );

      res.json({ message: "Relations deleted successfully" });
    } catch (error) {
      console.error('Error deleting family relation:', error);
      res.status(500).send("Error deleting family relation");
    }
  });

  app.post("/api/family/create-member", async (req, res) => {
    try {
      const { username, password, displayName, email, birthday } = req.body;
      const autoLogin = req.query.autoLogin !== 'false';

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          displayName,
          email,
          dateOfBirth: birthday ? new Date(birthday) : null,
        })
        .returning();

      if (autoLogin) {
        req.login(newUser, (err) => {
          if (err) {
            console.error('Error logging in new user:', err);
            return res.status(500).send("Error during login");
          }
          return res.json({
            message: "Family member created and logged in successfully",
            user: {
              id: newUser.id,
              username: newUser.username,
              displayName: newUser.displayName,
              email: newUser.email,
            },
          });
        });
      } else {
        return res.json({
          message: "Family member created successfully",
          user: {
            id: newUser.id,
            username: newUser.username,
            displayName: newUser.displayName,
            email: newUser.email,
          },
        });
      }
    } catch (error) {
      console.error('Error creating family member:', error);
      res.status(500).send("Error creating family member");
    }
  });

  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { dateOfBirth, email } = req.body;

    try {
      const [updatedUser] = await db
        .update(users)
        .set({          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          email,
        })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).send("Error updating profile");
    }
  });

  // Add new profile picture upload endpoint
  app.post("/api/users/profile-picture", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    try {
      // Get file info and update permissions
      const url = `/uploads/${req.file.filename}`;
      const stats = await fs.promises.stat(req.file.path);
      console.log('File stats:', {
        size: stats.size,
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid
      });

      await fs.promises.chmod(req.file.path, 0o644);

      // Update user's profile picture URL in database
      const [updatedUser] = await db
        .update(users)
        .set({
          profilePicture: url,
        })
        .where(eq(users.id, req.user.id))
        .returning();

      // Remove previous profile picture if it exists
      if (req.user.profilePicture && req.user.profilePicture.startsWith('/uploads/')) {
        const oldFilePath = path.join(process.cwd(), req.user.profilePicture.slice(1));
        try {
          await fs.promises.unlink(oldFilePath);
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(500).send("Error uploading profile picture");
    }
  });
  app.post("/api/users/story", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { story } = req.body;

    try {
      const [updatedUser] = await db
        .update(users)
        .set({ story })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user story:', error);
      res.status(500).send("Error updating user story");
    }
  });

  app.get("/api/memories", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user.id;

      const userMemories = await db.query.memories.findMany({
        where: eq(memories.userId, userId),
        orderBy: [desc(memories.createdAt)],
        with: {
          user: {
            columns: {
              username: true,
              displayName: true,
            }
          }
        }
      });

      res.json(userMemories);
    } catch (error) {
      console.error('Error fetching memories:', error);
      res.status(500).send("Error fetching memories");
    }
  });

  app.post("/api/memories", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { title, content } = req.body;

      if (!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required");
      }

      const [memory] = await db
        .insert(memories)
        .values({
          userId: req.user.id,
          title: title.trim(),
          content: content.trim(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(memory);
    } catch (error) {
      console.error('Error creating memory:', error);
      res.status(500).send("Error creating memory");
    }
  });

  app.delete("/api/memories/:memoryId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { memoryId } = req.params;

    try {
      const [memory] = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.id, parseInt(memoryId)),
            eq(memories.userId, req.user.id)
          )
        )
        .limit(1);

      if (!memory) {
        return res.status(404).send("Memory not found or unauthorized");
      }

      await db
        .delete(memories)
        .where(
          and(
            eq(memories.id, parseInt(memoryId)),
            eq(memories.userId, req.user.id)
          )
        );

      res.json({ message: "Memory deleted successfully" });
    } catch (error) {
      console.error('Error deleting memory:', error);
      res.status(500).send("Error deleting memory");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}