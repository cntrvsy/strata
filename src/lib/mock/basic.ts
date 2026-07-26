import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * ============================================================================
 * STRATA LESSON 1: RELATIONAL D1 CORE & PHYSICAL FOREIGN KEYS
 * ============================================================================
 * Welcome to the Strata Sandbox! This template teaches you basic D1 SQL tables.
 *
 * CONCEPT 1: D1 TABLES (sqliteTable)
 * - Strata parses Drizzle `sqliteTable()` declarations into visual ERD nodes.
 * - The `@strata` JSDoc comment directly above each entity stores its visual (x, y) coordinates.
 *
 * CONCEPT 2: PHYSICAL FOREIGN KEYS (.references)
 * - `author_id` uses `.references(() => users.id)`.
 * - Strata automatically renders physical foreign keys as SOLID relationship lines with arrowheads pointing to the parent table.
 *
 * TRY IT IN THE SANDBOX:
 * 1. Drag the `users` or `posts` nodes on the canvas — notice how @strata (x, y) coordinates update!
 * 2. Add a new table or column in the Code Editor on the left to see the diagram render instantly.
 * 3. Use the "+ New Table" or "Reset Schema" buttons in the top navbar at any time.
 */

/**
 * Parent Entity: Users Table
 * @strata { "target": "d1", "x": 140, "y": 180 }
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  // SQLite does not have native booleans. Drizzle maps booleans using integer mode:
  is_active: integer("is_active", { mode: "boolean" }).notNull(),
});

/**
 * Child Entity: Posts Table
 * Linked to `users` via `author_id` physical foreign key reference.
 * @strata { "target": "d1", "x": 520, "y": 180 }
 */
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  // Solid line relationship: Points directly to users.id
  author_id: integer("author_id").notNull().references(() => users.id),
  // SQLite dates map as timestamps in integer mode:
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});
