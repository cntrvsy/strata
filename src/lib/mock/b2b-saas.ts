/**
 * @strata-layout {
 *   "user": { "x": 100, "y": 140 },
 *   "session": { "x": 100, "y": 560 },
 *   "account": { "x": 100, "y": 940 },
 *   "verification": { "x": 100, "y": 1300 },
 *   "organizations": { "x": 620, "y": 140 },
 *   "memberships": { "x": 620, "y": 560 },
 *   "subscriptions": { "x": 620, "y": 940 },
 *   "TenantRateLimiterDO": { "x": 1120, "y": 140, "relations": [{ "to": "organizations" }] },
 *   "API_KEY_CACHE_KV": { "x": 1120, "y": 560, "relations": [{ "to": "memberships" }] },
 *   "TENANT_ASSETS_R2": { "x": 1120, "y": 940, "relations": [{ "to": "organizations" }] }
 * }
 */
import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * ARCHITECTURE BLUEPRINT: MULTI-TENANT B2B SAAS WITH BETTER AUTH & IDP BRIDGES
 * ============================================================================
 * Enterprise SaaS architecture showcasing Strata's native identity & layout features:
 *
 * 1. GIT-CLEAN LAYOUT MANIFEST (@strata-layout)
 *    - Notice the root @strata-layout manifest at the top of the file!
 *    - Node coordinates live EXCLUSIVELY in the root header manifest.
 *    - Individual domain tables remain pure Drizzle code with zero Git merge conflicts.
 *
 * 2. BETTER AUTH 4-TABLE CLUSTER DETECTION
 *    - Strata automatically recognizes the standard Better Auth cluster:
 *      `user`, `session`, `account`, `verification`.
 *    - Inspect the canvas to see core fields (`isAuthCore`) distinct from custom SaaS fields.
 *
 * 3. THIRD-PARTY IDENTITY BOUNDARIES (CLERK & WORKOS)
 *    - `user.clerkUserId` triggers Strata's virtual Clerk Identity boundary node.
 *    - `organizations.workosOrgId` triggers the WorkOS Enterprise Directory Sync boundary node.
 *    - Click these virtual nodes to inspect webhook mirror table scaffolding!
 *
 * 4. EDGE MULTI-TENANCY
 *    - Per-organization sliding-window rate-limiting in Durable Objects.
 *    - Sub-millisecond API key validation in Cloudflare KV.
 *    - Tenant brand assets & CSV reporting in Cloudflare R2.
 */

// ============================================================================
// SECTION 1: BETTER AUTH CLUSTER (D1 SQL)
// ============================================================================

/**
 * User Identity Table (Better Auth Core + Custom SaaS Extensions)
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  clerkUserId: text("clerk_user_id"), // Triggers Strata Clerk Identity Boundary Node
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Active Authentication Sessions (Better Auth Core)
 */
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

/**
 * Social & OAuth Accounts (Better Auth Core)
 */
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Email & OTP Verification Tokens (Better Auth Core)
 */
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SECTION 2: MULTI-TENANT SAAS & BILLING CORE
// ============================================================================

/**
 * Tenant Organizations
 */
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  workosOrgId: text("workos_org_id"), // Triggers Strata WorkOS Directory Sync Boundary Node
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("org_slug_idx").on(table.slug),
]);

/**
 * Tenant Team Memberships & Role-Based Access Control
 */
export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member"] }).default("member").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Stripe Billing Subscriptions
 */
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  plan: text("plan", { enum: ["starter", "pro", "enterprise"] }).default("starter").notNull(),
  priceCents: integer("price_cents").notNull(),
  status: text("status", { enum: ["active", "past_due", "canceled"] }).default("active").notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SECTION 3: DRIZZLE QUERY BUILDER RELATIONS
// ============================================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(memberships),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  memberships: many(memberships),
  subscription: one(subscriptions),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(user, {
    fields: [memberships.userId],
    references: [user.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));


