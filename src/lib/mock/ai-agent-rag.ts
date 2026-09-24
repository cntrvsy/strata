/**
 * @strata-layout {
 *   "users": { "x": 100, "y": 120 },
 *   "agentSessions": { "x": 560, "y": 120 },
 *   "chatMessages": { "x": 560, "y": 480 },
 *   "documentEmbeddings": { "x": 100, "y": 480 },
 *   "PROMPT_REGISTRY_KV": { "x": 100, "y": 860, "relations": [{ "to": "agentSessions" }] },
 *   "AgentSessionDO": { "x": 1020, "y": 480, "relations": [{ "to": "chatMessages" }] },
 *   "KNOWLEDGE_BASE_R2": { "x": 1020, "y": 860, "relations": [{ "to": "documentEmbeddings" }] }
 * }
 */
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * ARCHITECTURE BLUEPRINT: AI AGENT & RAG PIPELINE
 * ============================================================================
 * An edge-native AI architecture demonstrating the full hybrid Cloudflare stack:
 *
 * 1. D1 RELATIONAL CORE (SQL Database)
 *    - ACID persistence for users, agent conversational sessions, and streaming message turns.
 *    - SQLite-compatible timestamps via `integer("...", { mode: "timestamp" })`.
 *    - Enumerated model tiers and message roles via Drizzle `{ enum: [...] }`.
 *
 * 2. CLOUDFLARE DURABLE OBJECTS (Stateful WebSocket & Tool Coordinator)
 *    - `AgentSessionDO` maintains active WebSocket streaming connections to the client.
 *    - Manages short-term conversation context, vector similarity tool calling, and abort signals.
 *
 * 3. CLOUDFLARE KV NAMESPACE (Low-Latency Global Prompts)
 *    - `PROMPT_REGISTRY_KV` caches system instructions, model hyper-parameters, and tool schemas
 *      at sub-millisecond edge latency with TTL invalidation.
 *
 * 4. CLOUDFLARE R2 OBJECT STORAGE (Unstructured Document Corpus)
 *    - `KNOWLEDGE_BASE_R2` stores raw customer PDFs, audio transcripts, and chunk indexes for embeddings.
 *
 * 5. SYNTHETIC JSDOC CROSS-STORAGE RELATIONSHIPS
 *    - Links non-relational targets (KV, DO, R2) to D1 SQL tables without sidecar configuration files.
 */

// ============================================================================
// SECTION 1: D1 RELATIONAL SQL TABLES
// ============================================================================

/**
 * User Accounts & AI Token Quotas
 * Tracks customer usage and billing tiers for rate-limiting model calls.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["user", "pro", "admin"] }).default("user").notNull(),
  tokenQuota: integer("token_quota").default(100000).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Agent Conversational Sessions
 * Stateful execution run linking users to ongoing chat threads.
 */
export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  model: text("model", { enum: ["llama-3.3-70b", "deepseek-r1", "gpt-4o"] }).default("llama-3.3-70b").notNull(),
  status: text("status", { enum: ["idle", "streaming", "awaiting_tool", "closed"] }).default("idle").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Chat Message History & Token Accounting
 * Granular dialogue turn log capturing inputs, generated outputs, and tool responses.
 */
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
  content: text("content").notNull(),
  tokensUsed: integer("tokens_used").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Document Knowledge Base Metadata
 * Tracks source documents ingested from R2 and cataloged for vector semantic search.
 */
export const documentEmbeddings = sqliteTable("document_embeddings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  sourceKey: text("source_key").notNull(), // S3/R2 Object Key in KNOWLEDGE_BASE_R2
  chunkCount: integer("chunk_count").notNull(),
  embeddingModel: text("embedding_model").default("bge-large-en-v1.5").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SECTION 2: DRIZZLE QUERY BUILDER LOGICAL RELATIONS (DASHED EDGES)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  agentSessions: many(agentSessions),
}));

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [agentSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(agentSessions, {
    fields: [chatMessages.sessionId],
    references: [agentSessions.id],
  }),
}));

