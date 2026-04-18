import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * @strata { "x": 100, "y": 100 }
 */
export const users = sqliteTable("users", {
	id: integer("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
});

/**
 * @strata { "x": 400, "y": 100 }
 */
export const posts = sqliteTable("posts", {
	id: integer("id").primaryKey(),
	title: text("title").notNull(),
	authorId: integer("author_id").references(() => users.id),
});
