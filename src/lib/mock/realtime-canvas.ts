import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * ARCHITECTURE BLUEPRINT: REAL-TIME COLLABORATIVE CANVAS
 * ============================================================================
 * A Figma/Miro-style multiplayer architecture on Cloudflare's edge:
 *
 * 1. CLOUDFLARE DURABLE OBJECTS (CRDT Synchronization & WebSocket Hub)
 *    - `DocumentRoomDO` acts as the single point of coordination for each active canvas.
 *    - Ingests binary Yjs/Automerge CRDT update packets over WebSockets.
 *    - Broadcasts live collaborator cursor positions and triggers compaction alarms.
 *
 * 2. CLOUDFLARE R2 OBJECT STORAGE (Binary Compaction Snapshots)
 *    - Periodic CRDT document compaction writes complete state snapshots to `CANVAS_SNAPSHOTS_R2`.
 *    - Generates WebP vector thumbnails with configured CDN custom domains.
 *
 * 3. CLOUDFLARE KV NAMESPACE (Ephemeral Presence & Heartbeats)
 *    - `USER_PRESENCE_KV` provides low-latency presence lookups with 300s TTL expiration.
 *
 * 4. D1 RELATIONAL CORE (Document Metadata & Permissions)
 *    - Relational hierarchy for workspaces, canvas files, and revision timestamps.
 */

// ============================================================================
// SECTION 1: D1 RELATIONAL SQL TABLES
// ============================================================================

/**
 * Team Collaborative Workspaces
 * Root container for shared projects and canvas boards.
 * @strata { "target": "d1", "x": 100, "y": 140 }
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Canvas Documents (Whiteboards / Design Files)
 * Represents individual collaborative artboards.
 * @strata { "target": "d1", "x": 560, "y": 140 }
 */
export const canvasDocuments = sqliteTable("canvas_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  version: integer("version").default(1).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Document Revision Snapshots
 * Point-in-time state ledger pointing to compacted binary blobs in R2.
 * @strata { "target": "d1", "x": 560, "y": 520 }
 */
export const documentRevisions = sqliteTable("document_revisions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text("document_id").notNull().references(() => canvasDocuments.id, { onDelete: "cascade" }),
  snapshotKey: text("snapshot_key").notNull(), // Object Key in CANVAS_SNAPSHOTS_R2
  byteSize: integer("byte_size").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SECTION 2: DRIZZLE RELATIONS
// ============================================================================

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  documents: many(canvasDocuments),
}));

export const canvasDocumentsRelations = relations(canvasDocuments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [canvasDocuments.workspaceId],
    references: [workspaces.id],
  }),
  revisions: many(documentRevisions),
}));

export const documentRevisionsRelations = relations(documentRevisions, ({ one }) => ({
  document: one(canvasDocuments, {
    fields: [documentRevisions.documentId],
    references: [canvasDocuments.id],
  }),
}));

// ============================================================================
// SECTION 3: CLOUDFLARE EDGE INFRASTRUCTURE
// ============================================================================

/**
 * Multiplayer Room Coordinator (Cloudflare Durable Object)
 * Coordinates live WebSocket connections, merges binary CRDT state, and broadcasts cursor positions.
 * @strata { "target": "do", "binding": "DocumentRoomDO", "x": 1040, "y": 140, "relations": [{ "to": "canvasDocuments" }], "path": "./src/do/DocumentRoomDO.ts", "class": "DocumentRoomDO", "methods": ["handleWebSocketUpgrade", "applyCrdtUpdate", "broadcastCursorMovement", "persistSnapshotToR2"] }
 */
export const DocumentRoomDO = {};

/**
 * Ephemeral Collaborator Presence (Cloudflare KV)
 * Stores active session heartbeats, selected canvas node IDs, and viewport coordinates with 5-minute TTL.
 * @strata { "target": "kv", "binding": "USER_PRESENCE_KV", "ttl": 300, "x": 100, "y": 520, "relations": [{ "to": "canvasDocuments" }], "schema": { "userId": "string", "documentId": "string", "cursorX": "number", "cursorY": "number", "lastSeen": "number" } }
 */
export const USER_PRESENCE_KV = {};

/**
 * Compressed Document Blobs & Thumbnails (Cloudflare R2 Bucket)
 * Stores compacted binary document state and generated WebP artboard previews.
 * @strata { "target": "r2", "binding": "CANVAS_SNAPSHOTS_R2", "x": 1040, "y": 520, "relations": [{ "to": "documentRevisions" }], "public": false, "cors": true, "customDomain": "cdn.canvas.internal", "folders": { "revisions": "application/octet-stream", "thumbnails": "image/webp" } }
 */
export const CANVAS_SNAPSHOTS_R2 = {};
