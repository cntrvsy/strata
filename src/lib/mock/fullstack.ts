import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * ============================================================================
 * STRATA LESSON 3: HYBRID CLOUDFLARE STACK (D1 + KV + DO + R2)
 * ============================================================================
 * Strata isn't just an ERD for SQL databases—it visualizes your ENTIRE Cloudflare architecture!
 *
 * CONCEPT 1: CLOUDFLARE BINDING TARGETS IN JSDOC
 * - `"target": "d1"` ➔ Relational D1 Database Table
 * - `"target": "kv"` ➔ Cloudflare Key-Value (KV) Storage Namespace
 * - `"target": "do"` ➔ Stateful Durable Object (DO) Class
 * - `"target": "r2"` ➔ Cloudflare R2 Object Storage Bucket
 *
 * CONCEPT 2: SYNTHETIC JSDOC CROSS-STORAGE RELATIONSHIPS
 * - Non-SQL entities (KV, DO, R2) cannot have database foreign keys.
 * - Strata lets you link SQL tables to KV/DO/R2 targets using `@strata` synthetic relations:
 *   `"relations": [{ "to": "USER_KV" }, { "to": "AVATARS_R2" }]`
 * - This renders clean cross-storage connection lines in your diagram without engine overhead!
 *
 * TRY IT IN THE SANDBOX:
 * 1. Click on `USER_KV`, `UserDO`, or `AVATARS_R2` in the diagram to inspect their properties in the visual inspector drawer.
 * 2. Add or remove synthetic targets in `users` JSDoc to add or remove connection lines visually.
 * 3. Inspect public methods on `UserDO` or bucket CORS settings on `AVATARS_R2`!
 */

/**
 * D1 Relational Core Table
 * Linked to USER_KV and AVATARS_R2 via synthetic JSDoc cross-storage relations!
 * @strata { "target": "d1", "x": 120, "y": 140, "relations": [{ "to": "USER_KV" }, { "to": "AVATARS_R2" }] }
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Cloudflare KV Namespace (Key-Value Storage)
 * Stores fast session tokens and login failure counters globally.
 * @strata { "target": "kv", "x": 560, "y": 140, "schema": { "sessionToken": "string", "failedAttempts": "number" } }
 */
export const USER_KV = {};

/**
 * Cloudflare Durable Object (Stateful Realtime Object)
 * Manages active user sessions, WebSockets, and stateful presence.
 * @strata { "target": "do", "x": 560, "y": 420, "path": "./src/do/UserDO.ts", "class": "UserDO", "methods": ["getUserInfo", "updateStatus"] }
 */
export const UserDO = {};

/**
 * Cloudflare R2 Bucket (Object Storage)
 * Publicly readable bucket hosting avatars and attachments.
 * @strata { "target": "r2", "x": 120, "y": 460, "public": true, "cors": true, "folders": { "avatars": "image/*", "documents": "application/pdf" } }
 */
export const AVATARS_R2 = {};
