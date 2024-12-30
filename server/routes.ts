import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { mediaItems, mediaTags, familyRelations } from "@db/schema";
import { and, eq, or } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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

  app.post("/api/media", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { type, title, description, url, metadata } = req.body;
    const [item] = await db
      .insert(mediaItems)
      .values({
        userId: req.user.id,
        type,
        title,
        description,
        url,
        metadata,
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