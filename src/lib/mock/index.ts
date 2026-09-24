/**
 * index.ts
 *
 * Summary: Centralized mock schemas module loading production Cloudflare architecture templates.
 */

import aiAgentCode from "./ai-agent-rag.ts?raw";
import b2bSaasCode from "./b2b-saas.ts?raw";
import realtimeCanvasCode from "./realtime-canvas.ts?raw";
import ecommerceCode from "./ecommerce-edge.ts?raw";
import starterMinimalCode from "./starter-minimal.ts?raw";

export interface SchemaTemplate {
  key: string;
  name: string;
  badge: string;
  description: string;
  code: string;
  wranglerBindings?: { type: 'kv' | 'do' | 'r2'; name: string; extra?: any }[];
}

export const PRIMARY_TEMPLATES: SchemaTemplate[] = [
  {
    key: "ai-agent-rag",
    name: "AI Agent & RAG Pipeline",
    badge: "Flagship • D1 + KV + DO + R2",
    description: "Full hybrid Cloudflare stack featuring D1 conversational history, KV prompt registry, stateful AgentSession Durable Object for streaming WebSockets, and R2 document knowledge base.",
    code: aiAgentCode,
    wranglerBindings: [
      { type: "kv", name: "PROMPT_REGISTRY_KV", extra: { id: "prompt_registry_local" } },
      { type: "do", name: "AgentSessionDO", extra: { class: "AgentSessionDO" } },
      { type: "r2", name: "KNOWLEDGE_BASE_R2", extra: { bucket_name: "knowledge-base" } }
    ]
  },
  {
    key: "b2b-saas",
    name: "Multi-Tenant B2B SaaS",
    badge: "Better Auth • Clerk/WorkOS • @strata-layout",
    description: "Enterprise SaaS architecture with Git-clean @strata-layout header, Better Auth 4-table cluster, Clerk & WorkOS identity boundaries, Stripe billing, and tenant rate limiter DO.",
    code: b2bSaasCode,
    wranglerBindings: [
      { type: "do", name: "TenantRateLimiterDO", extra: { class: "TenantRateLimiterDO" } },
      { type: "kv", name: "API_KEY_CACHE_KV", extra: { id: "api_key_cache" } },
      { type: "r2", name: "TENANT_ASSETS_R2", extra: { bucket_name: "tenant-assets" } }
    ]
  },
  {
    key: "realtime-canvas",
    name: "Real-Time Collaborative Canvas",
    badge: "Multiplayer • D1 + DO WebSockets + R2",
    description: "Figma/Miro-style multiplayer collaborative canvas with D1 document trees, Durable Object Yjs/CRDT sync room, presence cursors, and R2 binary snapshot archives.",
    code: realtimeCanvasCode,
    wranglerBindings: [
      { type: "do", name: "DocumentRoomDO", extra: { class: "DocumentRoomDO" } },
      { type: "kv", name: "USER_PRESENCE_KV", extra: { id: "user_presence" } },
      { type: "r2", name: "CANVAS_SNAPSHOTS_R2", extra: { bucket_name: "canvas-snapshots" } }
    ]
  },
  {
    key: "ecommerce-edge",
    name: "Global Edge E-Commerce",
    badge: "Transactional • D1 Cents + Cart DO + R2",
    description: "High-concurrency global storefront with integer-cent monetary precision in D1, atomic flash-sale inventory reservation in Durable Objects, and R2 product media.",
    code: ecommerceCode,
    wranglerBindings: [
      { type: "kv", name: "DISCOUNT_RULES_KV", extra: { id: "discount_rules" } },
      { type: "do", name: "CartCheckoutLockDO", extra: { class: "CartCheckoutLockDO" } },
      { type: "r2", name: "PRODUCT_MEDIA_R2", extra: { bucket_name: "product-media" } }
    ]
  },
  {
    key: "starter-minimal",
    name: "Idiomatic D1 Minimal Starter",
    badge: "Pure SQL • D1 Core & Relations",
    description: "Pristine 3-table relational starter (users, posts, comments) demonstrating SQLite foreign keys, bidirectional Drizzle relations, and clean D1 timestamps without infrastructure noise.",
    code: starterMinimalCode,
    wranglerBindings: []
  },
];

export const SAMPLE_TEMPLATES: Record<string, SchemaTemplate> = {
  "ai-agent-rag": PRIMARY_TEMPLATES[0],
  "b2b-saas": PRIMARY_TEMPLATES[1],
  "realtime-canvas": PRIMARY_TEMPLATES[2],
  "ecommerce-edge": PRIMARY_TEMPLATES[3],
  "starter-minimal": PRIMARY_TEMPLATES[4],
};

// Non-enumerable aliases for backwards compatibility with legacy sandbox references & tests
const legacyAliases: Record<string, SchemaTemplate> = {
  master: PRIMARY_TEMPLATES[0],
  fullstack: PRIMARY_TEMPLATES[0],
  academics: PRIMARY_TEMPLATES[1],
  infrastructure: PRIMARY_TEMPLATES[2],
  basic: PRIMARY_TEMPLATES[4],
};

for (const [aliasKey, template] of Object.entries(legacyAliases)) {
  Object.defineProperty(SAMPLE_TEMPLATES, aliasKey, {
    value: template,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}
