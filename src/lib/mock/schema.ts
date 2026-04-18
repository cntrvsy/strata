import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/** 
 * @strata { "x": 100, "y": 100 } 
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

/** 
 * @strata { "x": 500, "y": 100 } 
 */
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  authorId: integer("author_id").references(() => users.id),
});

/** 
 * @strata { "x": 300, "y": 400 } 
 */
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey(),
  text: text("text").notNull(),
  userId: integer("user_id").references(() => users.id),
  postId: integer("post_id").references(() => posts.id),
});

// Advanced Relation Parsing Test
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
