/**
 * @strata-layout {
 *   "users": { "x": 100, "y": 140 },
 *   "posts": { "x": 560, "y": 140 },
 *   "comments": { "x": 560, "y": 520 }
 * }
 */
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * ARCHITECTURE BLUEPRINT: IDIOMATIC D1 MINIMAL STARTER
 * ============================================================================
 * A pure relational baseline demonstrating standard Drizzle + Cloudflare D1 best practices:
 *
 * 1. PHYSICAL FOREIGN KEYS WITH CASCADE DELETIONS
 *    - `posts.authorId` references `users.id` with `{ onDelete: "cascade" }`.
 *    - `comments.postId` references `posts.id` with `{ onDelete: "cascade" }`.
 *    - Renders solid relational connection lines with arrowheads pointing to the parent table.
 *
 * 2. BIDIRECTIONAL DRIZZLE RELATIONS (relations())
 *    - Connects tables for Drizzle's relational query builder (`db.query.posts.findMany(...)`).
 *    - Renders dashed animated connection lines on the ERD canvas with 1:N cardinality badges.
 *
 * 3. ZERO INFRASTRUCTURE NOISE
 *    - No KV, DO, or R2 bindings—pure, pristine SQLite for clean project scaffolding.
 */

/**
 * User Accounts
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  bio: text("bio"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Published Blog Posts
 */
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  published: integer("published", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Post Reader Comments
 */
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// DRIZZLE QUERY BUILDER RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
