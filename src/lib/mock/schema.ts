import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * STRATA MASTER ARCHITECTURE BENCHMARK SCHEMA
 * ============================================================================
 * Welcome to the Strata Master Benchmark Schema!
 *
 * This file demonstrates how Strata visualizes a full Cloudflare hybrid architecture:
 * 1. D1 Relational SQL Tables (`sqliteTable`)
 * 2. Drizzle Logical Query Relations (`relations()`)
 * 3. Cloudflare KV Key-Value Storage (`@strata { "target": "kv" }`)
 * 4. Cloudflare Durable Objects (`@strata { "target": "do" }`)
 * 5. Synthetic Cross-Storage Relationships (`"relations": [...]`)
 *
 * HOW STRATA WORKS (ZERO SIDE CARS, SINGLE SOURCE OF TRUTH):
 * - All visual coordinates (x, y) and target metadata are stored cleanly in standard JSDoc `@strata` tags.
 * - Editing or dragging node entities on the canvas updates the JSDoc comments directly.
 * - Saving code in VS Code / Cursor updates the ERD canvas in real time.
 */

// ============================================================================
// SECTION 1: D1 RELATIONAL CORE (SQL TABLES & PHYSICAL FKs)
// ============================================================================

/** 
 * Users Table
 * @strata {"x":700,"y":265} 
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});

/** 
 * Organizations Table
 * @strata {"x":700,"y":515} 
 */
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").default("free"),
});

/** 
 * Join table for Many-to-Many relationship between Users and Organizations.
 * Uses `.references()` physical foreign keys.
 * @strata {"x":370,"y":306} 
 */
export const memberships = sqliteTable("memberships", {
  userId: integer("user_id").notNull().references(() => users.id),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  role: text("role").default("member"),
});

/** 
 * Projects Table
 * Linked to `organizations` via `orgId` physical foreign key.
 * @strata {"x":370,"y":762} 
 */
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  status: text("status").default("active"),
});

// ============================================================================
// SECTION 2: CLOUDFLARE KV STORAGE (KEY-VALUE PAIRS)
// ============================================================================

/** 
 * User sessions stored in Cloudflare KV for sub-millisecond global access.
 * We use `@strata` synthetic relations to link this entity visually to D1 `users`.
 * @strata {"x":370,"y":40,"target":"kv","relations":[{"to":"users"}]} 
 */
export const userSessions = {
  sessionId: "string",
  userId: "number",
  userAgent: "string",
  expiresAt: "number",
};

/** 
 * Cached billing data to avoid frequent D1 database lookups.
 * @strata {"x":370,"y":534,"target":"kv","relations":[{"to":"organizations"}]} 
 */
export const billingCache = {
  orgId: "number",
  stripeStatus: "string",
  lastCheck: "number",
};

// ============================================================================
// SECTION 3: CLOUDFLARE DURABLE OBJECTS (STATEFUL REALTIME OBJECTS)
// ============================================================================

/** 
 * Real-time collaboration state managed by a Durable Object.
 * DOs handle stateful WebSockets and presence for active projects.
 * @strata {"x":40,"y":781,"target":"do","relations":[{"to":"projects"}]} 
 */
export const collaborativeEditor = {
  projectId: "string",
  activeUsers: "array",
  lastEdit: "number",
};

// ============================================================================
// SECTION 4: DRIZZLE QUERY BUILDER LOGICAL RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
}));
