import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * STRATA FORGE - EXAMPLE SCHEMA
 * 
 * This file demonstrates how Strata Forge visualizes a hybrid Cloudflare architecture:
 * 1. D1 Databases: Standard relational tables (sqliteTable)
 * 2. KV Storage: High-performance key-value pairs (plain objects)
 * 3. Durable Objects: State-persistent objects (plain objects with target: "do")
 */

// --- D1 TABLES (Relational Core) ---

/** 
 * @strata {"x":15,"y":0} 
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});

/** 
 * @strata {"x":435,"y":-75} 
 */
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").default("free"),
});

/** 
 * Join table for many-to-many relationship between users and organizations
 * @strata {"x":45,"y":420} 
 */
export const memberships = sqliteTable("memberships", {
  userId: integer("user_id").notNull().references(() => users.id),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  role: text("role").default("member"),
});

/** 
 * @strata {"x":700,"y":350} 
 */
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  status: text("status").default("active"),
});

// --- KV STORAGE (Key-Value Pairs) ---

/** 
 * User sessions stored in Cloudflare KV for global performance.
 * We use @strata relations to link this logical entity to our D1 users.
 * @strata {"x":-315,"y":180,"target":"kv","relations":[{"to":"users"}]} 
 */
export const userSessions = {
  sessionId: "string",
  userId: "number",
  userAgent: "string",
  expiresAt: "number",
};

/** 
 * Cached billing data to avoid frequent D1 lookups.
 * @strata {"x":375,"y":510,"target":"kv","relations":[{"to":"organizations"}]} 
 */
export const billingCache = {
  orgId: "number",
  stripeStatus: "string",
  lastCheck: "number",
};

// --- DURABLE OBJECTS (Stateful Entities) ---

/** 
 * Real-time collaboration state managed by a Durable Object.
 * DOs are perfect for synchronized state like editor presence.
 * @strata {"x":750,"y":30,"target":"do","relations":[{"to":"projects"}]} 
 */
export const collaborativeEditor = {
  projectId: "string",
  activeUsers: "array",
  lastEdit: "number",
};

// --- RELATIONS (Drizzle Logical Layer) ---

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
