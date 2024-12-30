import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { mediaItems, mediaTags, familyRelations } from "@db/schema";
import { and, eq, or } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from 'express';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
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

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

    const { type, title, description } = req.body;
    const url = `/uploads/${req.file.filename}`;

    const [item] = await db
      .insert(mediaItems)
      .values({
        userId: req.user.id,
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

  const httpServer = createServer(app);
  return httpServer;
}