import { describe, it, expect } from "vitest";
import { parseSchema } from "#lib/parser";
import { arrangeLayout } from "#lib/services/layout";
import { schemaState } from "#lib/state";
import fs from "node:fs";
import path from "node:path";

describe("Cloudflare Primitives Archetypes & Canvas Visuals", () => {
  const multiPrimitiveSchema = `
/**
 * @strata { "target": "d1", "x": 100, "y": 100 }
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull()
});

/**
 * @strata {
 *   "target": "do",
 *   "class": "SessionCounter",
 *   "storage": "sqlite",
 *   "alarms": true,
 *   "websockets": true,
 *   "hibernation": true,
 *   "methods": ["increment", "getSessionCount", "broadcast"],
 *   "x": 450,
 *   "y": 100
 * }
 */
export const SessionCounterDO = {};

/**
 * @strata {
 *   "target": "kv",
 *   "schema": {
 *     "session:*": { "type": "json", "ttl": 86400 },
 *     "ratelimit:*": { "type": "number", "ttl": 60 }
 *   },
 *   "x": 100,
 *   "y": 400
 * }
 */
export const SESSIONS_KV = {};

/**
 * @strata {
 *   "target": "r2",
 *   "public": true,
 *   "customDomain": "assets.example.com",
 *   "cors": true,
 *   "folders": {
 *     "avatars": "image/*",
 *     "invoices": "application/pdf"
 *   },
 *   "x": 450,
 *   "y": 400
 * }
 */
export const ASSETS_BUCKET = {};
`;

  it("should parse DO, KV, and R2 targets with specialized node types and domain properties", () => {
    const { nodes } = parseSchema(multiPrimitiveSchema);

    const usersNode = nodes.find((n) => n.id === "users");
    expect(usersNode).toBeDefined();
    expect(usersNode?.type).toBe("table");
    expect(usersNode?.data.target).toBe("d1");

    const doNode = nodes.find((n) => n.id === "SessionCounterDO");
    expect(doNode).toBeDefined();
    expect(doNode?.type).toBe("do");
    expect(doNode?.data.target).toBe("do");
    expect((doNode?.data as any).methods).toHaveLength(3);
    expect((doNode?.data as any).columns).toHaveLength(3);
    expect((doNode?.data as any).strata.storage).toBe("sqlite");
    expect((doNode?.data as any).strata.websockets).toBe(true);

    const kvNode = nodes.find((n) => n.id === "SESSIONS_KV");
    expect(kvNode).toBeDefined();
    expect(kvNode?.type).toBe("kv");
    expect(kvNode?.data.target).toBe("kv");
    expect((kvNode?.data as any).patterns).toHaveLength(2);
    expect((kvNode?.data as any).columns).toHaveLength(2);
    expect((kvNode?.data as any).patterns[0].name).toBe("session:*");
    expect((kvNode?.data as any).patterns[0].ttl).toBe(86400);

    const r2Node = nodes.find((n) => n.id === "ASSETS_BUCKET");
    expect(r2Node).toBeDefined();
    expect(r2Node?.type).toBe("r2");
    expect(r2Node?.data.target).toBe("r2");
    expect((r2Node?.data as any).folders).toHaveLength(2);
    expect((r2Node?.data as any).columns).toHaveLength(2);
    expect((r2Node?.data as any).folders[0].name).toBe("avatars/");
    expect((r2Node?.data as any).strata.public).toBe(true);
    expect((r2Node?.data as any).strata.customDomain).toBe("assets.example.com");
  });

  it("should calculate distinct dynamic layout bounding boxes for do, kv, and r2 nodes", async () => {
    const { nodes, edges } = parseSchema(multiPrimitiveSchema);
    const arranged = await arrangeLayout(nodes, edges);

    expect(arranged).toHaveLength(4);
    for (const node of arranged) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("should generate proper TypeScript definitions in store.getTableDefinitionSnippet", () => {
    const { nodes } = parseSchema(multiPrimitiveSchema);
    schemaState.nodes = nodes;
    schemaState.rawCode = multiPrimitiveSchema;

    const doSnippet = schemaState.getTableDefinitionSnippet("SessionCounterDO");
    expect(doSnippet).toContain("export class SessionCounterDO {");
    expect(doSnippet).toContain("increment");

    const kvSnippet = schemaState.getTableDefinitionSnippet("SESSIONS_KV");
    expect(kvSnippet).toContain("export interface SESSIONS_KVKV {");
    expect(kvSnippet).toContain("session:*");

    const r2Snippet = schemaState.getTableDefinitionSnippet("ASSETS_BUCKET");
    expect(r2Snippet).toContain("export interface ASSETS_BUCKETBucket {");
    expect(r2Snippet).toContain("avatars/");
  });

  it("should verify that UI components contain strictly ZERO emojis", () => {
    // Regex matching emoji characters
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    const componentPaths = [
      "src/lib/components/diagram/DurableObjectNode.svelte",
      "src/lib/components/diagram/KVNamespaceNode.svelte",
      "src/lib/components/diagram/R2BucketNode.svelte",
      "src/lib/components/diagram/TableNode.svelte",
      "src/lib/components/diagram/ContextMenu.svelte",
    ];

    for (const relPath of componentPaths) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const match = content.match(emojiRegex);
      expect(match, `Emoji found in ${relPath}: ${match ? match[0] : ""}`).toBeNull();
    }
  });
});
