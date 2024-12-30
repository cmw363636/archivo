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
  albums: many(albums, { relationName: "createdAlbums" }),
  albumMemberships: many(albumMembers),
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

// Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertMediaItemSchema = createInsertSchema(mediaItems);
export const selectMediaItemSchema = createSelectSchema(mediaItems);
export const insertAlbumSchema = createInsertSchema(albums);
export const selectAlbumSchema = createSelectSchema(albums);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = typeof mediaItems.$inferInsert;
export type Album = typeof albums.$inferSelect;
export type InsertAlbum = typeof albums.$inferInsert;