import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  bio: text("bio"),
});

export const familyRelations = pgTable("family_relations", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  relationType: text("relation_type").notNull(), // parent, child, spouse, sibling
});

export const mediaItems = pgTable("media_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // photo, video, audio, document
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mediaTags = pgTable("media_tags", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").references(() => mediaItems.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  mediaItems: many(mediaItems),
  mediaTags: many(mediaTags),
  familyRelationsFrom: many(familyRelations, { relationName: "fromUser" }),
  familyRelationsTo: many(familyRelations, { relationName: "toUser" }),
}));

export const mediaItemsRelations = relations(mediaItems, ({ one, many }) => ({
  user: one(users, {
    fields: [mediaItems.userId],
    references: [users.id],
  }),
  tags: many(mediaTags, {
    fields: [mediaItems.id],
    references: [mediaTags.mediaId],
  }),
}));

export const mediaTagsRelations = relations(mediaTags, ({ one }) => ({
  mediaItem: one(mediaItems, {
    fields: [mediaTags.mediaId],
    references: [mediaItems.id],
  }),
  user: one(users, {
    fields: [mediaTags.userId],
    references: [users.id],
  }),
}));

export const familyRelationsRelations = relations(familyRelations, ({ one }) => ({
  fromUser: one(users, {
    fields: [familyRelations.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [familyRelations.toUserId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertMediaItemSchema = createInsertSchema(mediaItems);
export const selectMediaItemSchema = createSelectSchema(mediaItems);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = typeof mediaItems.$inferInsert;