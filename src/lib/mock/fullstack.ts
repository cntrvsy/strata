import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

/**
 * ============================================================================
 * EDUSTRATA LEVEL 4: FULL-STACK ENTERPRISE CAMPUS ECOSYSTEM
 * ============================================================================
 * The flagship EduStrata architecture! Level 4 demonstrates a complete hybrid
 * Cloudflare stack (D1 + KV + DO + R2) powering interactive campus operations.
 *
 * CONCEPT 1: STATEFUL DURABLE OBJECTS (target: "do")
 * - `ClassroomSmartBoardDO` represents a stateful Cloudflare Durable Object class.
 * - Strata parses TS class methods (`getBoardState`, `broadcastDrawLine`, `submitExamAnswer`)
 *   and renders public RPC method signatures in the Inspector drawer.
 *
 * CONCEPT 2: FULL HYBRID CLOUDFLARE ARCHITECTURE
 * - D1 SQL (`tuition_invoices`) handles ACID financial billing records.
 * - KV (`CAFETERIA_POS_KV`) handles sub-millisecond meal plan balance lookups.
 * - Durable Object (`ClassroomSmartBoardDO`) handles realtime classroom WebSocket sessions.
 * - R2 (`LECTURE_MEDIA_R2`) hosts recorded lecture streams and media assets.
 *
 * CONCEPT 3: FRAMEWORK AGNOSTIC ECOSYSTEM
 * - Fully compatible whether your API is built with Hono, React, Remix, SvelteKit, Astro, or Workers!
 *
 * TRY IT IN THE SANDBOX:
 * 1. Double-click `ClassroomSmartBoardDO` to view its RPC method signatures in the Inspector.
 * 2. Click `CAFETERIA_POS_KV` or `LECTURE_MEDIA_R2` to view KV schemas and R2 bucket CORS rules.
 * 3. Add a new RPC method signature to `ClassroomSmartBoardDO` in the Inspector!
 */

/**
 * Tuition & Fee Invoices (D1 Database Table)
 * @strata { "target": "d1", "x": 120, "y": 140, "relations": [{ "to": "CAFETERIA_POS_KV" }, { "to": "LECTURE_MEDIA_R2" }] }
 */
export const tuition_invoices = sqliteTable("tuition_invoices", {
  id: integer("id").primaryKey(),
  student_id: integer("student_id").notNull(),
  amount_due: real("amount_due").notNull(),
  status: text("status").notNull(), // e.g. "PENDING", "PAID", "OVERDUE"
  due_date: integer("due_date", { mode: "timestamp" }).notNull(),
});

/**
 * Cafeteria Point-of-Sale Cache (Cloudflare KV)
 * Sub-millisecond lookup for student meal plan card balances and daily menu items.
 * @strata { "target": "kv", "x": 580, "y": 140, "schema": { "mealPlanBalance": "number", "dailyMenu": "string", "isEligible": "boolean" } }
 */
export const CAFETERIA_POS_KV = {};

/**
 * Realtime Classroom Smart Board & Exam Engine (Cloudflare Durable Object)
 * Manages stateful WebSocket connections for live interactive classroom displays & online exams.
 * @strata { "target": "do", "x": 580, "y": 420, "path": "./src/do/ClassroomSmartBoardDO.ts", "class": "ClassroomSmartBoardDO", "methods": ["getBoardState", "broadcastDrawLine", "submitExamAnswer"] }
 */
export const ClassroomSmartBoardDO = {};

/**
 * Lecture Media Archives (Cloudflare R2 Bucket)
 * High-capacity object storage bucket holding recorded lecture streams and media assets.
 * @strata { "target": "r2", "x": 120, "y": 460, "public": true, "cors": true, "folders": { "video_lectures": "video/mp4", "audio_podcasts": "audio/mpeg" } }
 */
export const LECTURE_MEDIA_R2 = {};
