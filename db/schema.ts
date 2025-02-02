import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),  // Optional email field
  dateOfBirth: timestamp("date_of_birth"),
  bio: text("bio"),
  profilePicture: text("profile_picture"),
  story: text("story"),
});

export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const familyRelations = pgTable("family_relations", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  relationType: text("relation_type").notNull(),
});

export const albums = pgTable("albums", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isShared: boolean("is_shared").default(false).notNull(),
});

export const albumMembers = pgTable("album_members", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id").references(() => albums.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
});

export const mediaItems = pgTable("media_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  albumId: integer("album_id").references(() => albums.id),
  type: text("type").notNull(), // photo, video, audio, document, post
  title: text("title"),
  description: text("description"),
  url: text("url").notNull(),
  website_url: text("website_url"), // For post type
  content: text("content"), // For post type
  metadata: jsonb("metadata"),
  mediaDate: timestamp("media_date").defaultNow().notNull(),
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
  albums: many(albums, { relationName: "createdAlbums" }),
  albumMemberships: many(albumMembers),
  memories: many(memories),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  creator: one(users, {
    fields: [albums.createdBy],
    references: [users.id],
  }),
  members: many(albumMembers),
  mediaItems: many(mediaItems),
}));

export const albumMembersRelations = relations(albumMembers, ({ one }) => ({
  album: one(albums, {
    fields: [albumMembers.albumId],
    references: [albums.id],
  }),
  user: one(users, {
    fields: [albumMembers.userId],
    references: [users.id],
  }),
}));

export const mediaItemsRelations = relations(mediaItems, ({ one, many }) => ({
  user: one(users, {
    fields: [mediaItems.userId],
    references: [users.id],
  }),
  album: one(albums, {
    fields: [mediaItems.albumId],
    references: [albums.id],
  }),
  tags: many(mediaTags),
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

export const memoriesRelations = relations(memories, ({ one }) => ({
  user: one(users, {
    fields: [memories.userId],
    references: [users.id],
  }),
}));


// Schemas with custom types
export const insertUserSchema = createInsertSchema(users, {
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional(),
  profilePicture: z.string().optional(),
  story: z.string().optional(),
});
export const selectUserSchema = createSelectSchema(users, {
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional(),
  profilePicture: z.string().optional(),
  story: z.string().optional(),
});

export const insertMemorySchema = createInsertSchema(memories);
export const selectMemorySchema = createSelectSchema(memories);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = typeof mediaItems.$inferInsert;
export type Album = typeof albums.$inferSelect;
export type InsertAlbum = typeof albums.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type InsertMemory = typeof memories.$inferInsert;