import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * ============================================================================
 * EDUSTRATA LEVEL 3: CAMPUS OPERATIONS, REALTIME KV & R2 ASSETS
 * ============================================================================
 * Strata isn't limited to relational databases—it models your ENTIRE Cloudflare stack!
 * Level 3 adds Cloudflare KV Namespaces and R2 Object Storage buckets to EduStrata.
 *
 * CONCEPT 1: CLOUDFLARE BINDINGS IN JSDOC
 * - `"target": "d1"` ➔ Relational D1 Database Table
 * - `"target": "kv"` ➔ Cloudflare Key-Value (KV) Storage Namespace
 * - `"target": "r2"` ➔ Cloudflare R2 Object Storage Bucket
 *
 * CONCEPT 2: SYNTHETIC JSDOC CROSS-STORAGE RELATIONSHIPS
 * - Non-relational targets (KV, R2) cannot have SQL foreign keys.
 * - Strata links D1 relational tables to KV/R2 targets using `@strata` synthetic relations:
 *   `"relations": [{ "to": "BELL_SCHEDULE_KV" }, { "to": "STUDENT_DOCS_R2" }]`
 * - This renders clean cross-storage connection lines in your ERD diagram!
 *
 * TRY IT IN THE SANDBOX:
 * 1. Select `BELL_SCHEDULE_KV` or `STUDENT_DOCS_R2` to view their configuration attributes in Inspector.
 * 2. Look at the synthetic connection line linking `staff` to `BELL_SCHEDULE_KV`.
 * 3. Configure folder MIME types or public access toggles on `STUDENT_DOCS_R2` in the Inspector!
 */

/**
 * Staff Roster (D1 Database Table)
 * Linked to BELL_SCHEDULE_KV and STUDENT_DOCS_R2 via synthetic JSDoc cross-storage relations!
 * @strata { "target": "d1", "x": 120, "y": 140, "relations": [{ "to": "BELL_SCHEDULE_KV" }, { "to": "STUDENT_DOCS_R2" }] }
 */
export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey(),
  full_name: text("full_name").notNull(),
  role: text("role").notNull(), // e.g. Principal, Administrator, Janitor, Cafeteria Manager
  email: text("email").notNull(),
  hired_at: integer("hired_at", { mode: "timestamp" }).notNull(),
});

/**
 * Cloudflare KV Namespace (Key-Value Storage)
 * Stores real-time campus bell schedules, daily period timings, and emergency broadcast flags.
 * @strata { "target": "kv", "x": 580, "y": 140, "schema": { "bellSchedule": "string", "emergencyLockdown": "boolean", "periodIndex": "number" } }
 */
export const BELL_SCHEDULE_KV = {};

/**
 * Cloudflare R2 Bucket (Object Storage)
 * Public & private campus document storage hosting student transcripts, ID card badges, and health records.
 * @strata { "target": "r2", "x": 120, "y": 460, "public": false, "cors": true, "folders": { "transcripts": "application/pdf", "badges": "image/*", "health_records": "application/pdf" } }
 */
export const STUDENT_DOCS_R2 = {};
