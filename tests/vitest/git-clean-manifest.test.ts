import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSchema } from '../../src/lib/parser/core';
import {
  extractStrataLayoutManifest,
  updateLayoutManifestInSchema,
  removeTableFromLayoutManifest,
  renameTableInLayoutManifest,
  updateAllNodePositionsInSchema,
  parseDrizzleConfigSchemaPath,
  consolidateDummyBindingsIntoManifest,
  removeUnusedImportFromSchema,
  addEdgeToSchema,
  removeEdgeFromSchema
} from '../../src/lib/parser/mutators';
import { schemaState } from '../../src/lib/state';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: vi.fn()
}));

describe('Git-Clean Layout Manifest & Workspace Ingestion (Phase 5)', () => {
  beforeEach(() => {
    schemaState.reset();
    vi.clearAllMocks();
  });

  it('should extract and update consolidated @strata-layout manifest', () => {
    const rootCode = `
      export * from './users';
      export * from './posts';
    `;

    const positions = {
      users: { x: 120, y: 340 },
      posts: { x: 500, y: 340 }
    };

    const withManifest = updateLayoutManifestInSchema(rootCode, positions);
    expect(withManifest).toContain('@strata-layout');
    expect(withManifest).toContain('"users"');
    expect(withManifest).toContain('"posts"');

    const extracted = extractStrataLayoutManifest(withManifest);
    expect(extracted).toBeDefined();
    expect(extracted?.users.x).toBe(120);
    expect(extracted?.users.y).toBe(340);
    expect(extracted?.posts.x).toBe(500);
    expect(extracted?.posts.y).toBe(340);
  });

  it('should apply @strata-layout manifest coordinates to modular nodes on parse', () => {
    const rootWithManifest = `
      /**
       * @strata-layout {
       *   "users": { "x": 150, "y": 250 },
       *   "posts": { "x": 600, "y": 250 }
       * }
       */
      export * from './users';
      export * from './posts';
    `;

    const usersContent = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey()
      });
    `;

    const postsContent = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey()
      });
    `;

    const externalMap = new Map<string, string>();
    externalMap.set('/project/db/users.ts', usersContent);
    externalMap.set('/project/db/posts.ts', postsContent);

    const result = parseSchema(rootWithManifest, externalMap, undefined, undefined, '/project/db/index.ts');
    expect(result.success).toBe(true);

    const usersNode = result.nodes.find(n => n.id === 'users');
    const postsNode = result.nodes.find(n => n.id === 'posts');

    expect(usersNode?.position.x).toBe(150);
    expect(usersNode?.position.y).toBe(250);
    expect(postsNode?.position.x).toBe(600);
    expect(postsNode?.position.y).toBe(250);
  });

  it('should update layout manifest in index.ts and leave domain files 100% clean in Git on node drag/save', async () => {
    const barrelRoot = `
      export * from './users';
      export * from './posts';
    `;

    const usersContent = `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});`;

    const postsContent = `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey()
});`;

    const writtenFiles: Record<string, string> = {};

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/project/db/index.ts') return barrelRoot;
        if (args.path.endsWith('users.ts')) return usersContent;
        if (args.path.endsWith('posts.ts')) return postsContent;
      }
      if (cmd === 'write_schema_file') {
        writtenFiles[args.path] = args.content;
        return;
      }
      return '';
    });

    schemaState.filePath = '/project/db/index.ts';
    await schemaState.syncWithFile();

    expect(schemaState.nodes).toHaveLength(2);

    // Simulate dragging the users node
    const userNode = schemaState.nodes.find(n => n.id === 'users')!;
    userNode.position = { x: 300, y: 400 };

    // Save diagram positions
    await schemaState.saveToFile();

    // Verify index.ts received the @strata-layout manifest
    expect(writtenFiles['/project/db/index.ts']).toBeDefined();
    expect(writtenFiles['/project/db/index.ts']).toContain('@strata-layout');
    expect(writtenFiles['/project/db/index.ts']).toContain('"x": 300');

    // CRITICAL: Verify users.ts and posts.ts were NEVER written to (0 Git diffs!)
    const usersPath = Object.keys(writtenFiles).find(p => p.endsWith('users.ts'));
    const postsPath = Object.keys(writtenFiles).find(p => p.endsWith('posts.ts'));
    expect(usersPath).toBeUndefined();
    expect(postsPath).toBeUndefined();
  });

  it('should resolve schema paths from drizzle.config.ts across diverse syntax formats', () => {
    // 1. Glob barrel with double quotes
    const barrelConfig = `
      import { defineConfig } from "drizzle-kit";
      export default defineConfig({
        dialect: "sqlite",
        schema: "./src/db/schema/*",
        out: "./drizzle"
      });
    `;
    expect(parseDrizzleConfigSchemaPath(barrelConfig, '/app/drizzle.config.ts')).toBe('/app/src/db/schema/index.ts');

    // 2. Single file with double quotes
    const singleConfig = `
      import { defineConfig } from "drizzle-kit";
      export default defineConfig({
        dialect: "sqlite",
        schema: "./src/db/schema.ts"
      });
    `;
    expect(parseDrizzleConfigSchemaPath(singleConfig, '/app/drizzle.config.ts')).toBe('/app/src/db/schema.ts');

    // 3. Backtick template literal
    const backtickConfig = `
      export default {
        schema: \`./src/db/schema.ts\`
      };
    `;
    expect(parseDrizzleConfigSchemaPath(backtickConfig, '/app/drizzle.config.ts')).toBe('/app/src/db/schema.ts');

    // 4. Array of schemas with glob
    const arrayConfig = `
      export default defineConfig({
        schema: [
          "./src/db/schema/*.ts",
          "./src/db/relations.ts"
        ]
      });
    `;
    expect(parseDrizzleConfigSchemaPath(arrayConfig, '/app/drizzle.config.ts')).toBe('/app/src/db/schema/index.ts');

    // 5. Trailing slash directory
    const trailingSlashConfig = `
      export default defineConfig({
        schema: "./src/db/schema/"
      });
    `;
    expect(parseDrizzleConfigSchemaPath(trailingSlashConfig, '/app/drizzle.config.ts')).toBe('/app/src/db/schema/index.ts');
  });

  it('should automatically redirect openFileDirectly to schema file when drizzle.config.ts is selected', async () => {
    const configContent = `
      import { defineConfig } from "drizzle-kit";
      export default defineConfig({
        schema: "./src/db/schema.ts"
      });
    `;

    const schemaContent = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", { id: integer("id").primaryKey() });
    `;

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path.endsWith('drizzle.config.ts')) return configContent;
        if (args.path.endsWith('schema.ts')) return schemaContent;
      }
      return '';
    });

    await schemaState.openFileDirectly('/my-project/drizzle.config.ts');

    expect(schemaState.filePath).toBe('/my-project/src/db/schema.ts');
    expect(schemaState.nodes).toHaveLength(1);
    expect(schemaState.nodes[0].id).toBe('users');
  });

  it('should cleanly remove a table key from @strata-layout manifest when table is deleted', () => {
    const code = `
      /**
       * @strata-layout {
       *   "users": { "x": 100, "y": 200 },
       *   "posts": { "x": 400, "y": 200 }
       * }
       */
      export * from './users';
      export * from './posts';
    `;

    const updated = removeTableFromLayoutManifest(code, 'users');
    const manifest = extractStrataLayoutManifest(updated);

    expect(manifest).toBeDefined();
    expect(manifest?.users).toBeUndefined();
    expect(manifest?.posts).toEqual({ x: 400, y: 200 });
  });

  it('should migrate table key in @strata-layout manifest when table is renamed', () => {
    const code = `
      /**
       * @strata-layout {
       *   "users": { "x": 125, "y": 250 },
       *   "posts": { "x": 500, "y": 250 }
       * }
       */
      export * from './users';
      export * from './posts';
    `;

    const updated = renameTableInLayoutManifest(code, 'users', 'profiles');
    const manifest = extractStrataLayoutManifest(updated);

    expect(manifest).toBeDefined();
    expect(manifest?.users).toBeUndefined();
    expect(manifest?.profiles).toEqual({ x: 125, y: 250 });
    expect(manifest?.posts).toEqual({ x: 500, y: 250 });
  });

  it('should prune removed tables in updateLayoutManifestInSchema when pruneMissing is true', () => {
    const code = `
      /**
       * @strata-layout {
       *   "users": { "x": 100, "y": 100 },
       *   "posts": { "x": 200, "y": 200 },
       *   "comments": { "x": 300, "y": 300 }
       * }
       */
      export * from './posts';
    `;

    // Active nodes only have 'posts'
    const activePositions = {
      posts: { x: 220, y: 220 }
    };

    const updated = updateLayoutManifestInSchema(code, activePositions, true);
    const manifest = extractStrataLayoutManifest(updated);

    expect(manifest).toBeDefined();
    expect(manifest?.posts).toEqual({ x: 220, y: 220 });
    expect(manifest?.users).toBeUndefined();
    expect(manifest?.comments).toBeUndefined();
  });

  it('should persist virtual identity node positions in @strata-layout in updateAllNodePositionsInSchema', () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        clerkUserId: text("clerk_user_id").notNull()
      });
    `;

    const nodes: any[] = [
      {
        id: 'posts',
        type: 'table',
        position: { x: 100, y: 100 },
        data: { target: 'd1' }
      },
      {
        id: '__clerk_identity__',
        type: 'identity',
        position: { x: 50, y: 250 },
        data: { provider: 'clerk' }
      }
    ];

    const updated = updateAllNodePositionsInSchema(code, nodes);
    expect(updated).toContain('@strata-layout');
    expect(updated).toContain('__clerk_identity__');

    const manifest = extractStrataLayoutManifest(updated);
    expect(manifest?.__clerk_identity__).toEqual({ x: 50, y: 250 });
  });

  it('should apply @strata-layout manifest coordinates to external wrangler bindings on cold parse', async () => {
    const rootWithManifest = `
      /**
       * @strata-layout {
       *   "users": { "x": 100, "y": 150 },
       *   "RATE_LIMITER_DO": { "x": 620, "y": 280 }
       * }
       */
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey()
      });
    `;

    const wranglerJson = JSON.stringify({
      name: "my-worker",
      main: "src/index.ts",
      durable_objects: {
        bindings: [
          { name: "RATE_LIMITER_DO", class_name: "RateLimiterDO" }
        ]
      }
    });

    const mockFiles: Record<string, string> = {
      '/app/schema/index.ts': rootWithManifest,
      '/app/wrangler.jsonc': wranglerJson
    };

    const { PlatformService } = await import('../../src/lib/services/platform');
    vi.spyOn(PlatformService, 'readText').mockImplementation(async (path: string) => {
      const norm = path.replace(/\\/g, '/');
      if (mockFiles[norm]) return mockFiles[norm];
      throw new Error(`File not found: ${path}`);
    });

    schemaState.filePath = '/app/schema/index.ts';
    await schemaState.syncWithFile();

    const doNode = schemaState.nodes.find(n => n.id === 'RATE_LIMITER_DO');
    expect(doNode).toBeDefined();
    expect(doNode?.position.x).toBe(620);
    expect(doNode?.position.y).toBe(280);
  });

  it('should follow Worker main entrypoint to resolve DO class and extract RPC methods (Option 1)', async () => {
    const rootSchema = `
      /**
       * @strata-layout {
       *   "users": { "x": 100, "y": 150 },
       *   "SESSION_DO": { "x": 550, "y": 150 }
       * }
       */
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey()
      });
    `;

    const wranglerConfig = JSON.stringify({
      name: "worker-app",
      main: "src/index.ts",
      durable_objects: {
        bindings: [
          { name: "SESSION_DO", class_name: "SessionDO" }
        ]
      }
    });

    const workerIndex = `
      import { DurableObject } from "cloudflare:workers";
      export { SessionDO } from "./durable-objects/SessionDO";

      export default {
        async fetch(request, env) { return new Response("OK"); }
      };
    `;

    const sessionDoClass = `
      import { DurableObject } from "cloudflare:workers";

      export class SessionDO extends DurableObject {
        async getSession(token: string): Promise<any> { return {}; }
        async invalidate(token: string): Promise<void> {}
      }
    `;

    const mockFiles: Record<string, string> = {
      '/project/src/schema/index.ts': rootSchema,
      '/project/wrangler.jsonc': wranglerConfig,
      '/project/src/index.ts': workerIndex,
      '/project/src/durable-objects/SessionDO.ts': sessionDoClass
    };

    const { PlatformService } = await import('../../src/lib/services/platform');
    vi.spyOn(PlatformService, 'readText').mockImplementation(async (path: string) => {
      const norm = path.replace(/\\/g, '/');
      if (mockFiles[norm]) return mockFiles[norm];
      throw new Error(`File not found: ${path}`);
    });

    schemaState.filePath = '/project/src/schema/index.ts';
    await schemaState.syncWithFile();

    const doNode = schemaState.nodes.find(n => n.id === 'SESSION_DO');
    expect(doNode).toBeDefined();
    expect(doNode?.position).toEqual({ x: 550, y: 150 });
    
    // Check RPC methods extracted via Option 1
    const methodNames = (doNode?.data as any)?.columns.map((c: any) => c.name);
    expect(methodNames).toContain('getSession(token: string)');
    expect(methodNames).toContain('invalidate(token: string)');
  });

  it('should insert @strata-layout safely below shebangs and directives', () => {
    const codeWithDirective = `"use server";\n\nimport { sqliteTable, integer } from "drizzle-orm/sqlite-core";\nexport const users = sqliteTable("users", { id: integer("id") });`;
    const updated = updateLayoutManifestInSchema(codeWithDirective, { users: { x: 100, y: 200 } });
    
    expect(updated.startsWith('"use server";\n\n/**\n * @strata-layout')).toBe(true);
    expect(updated).toContain('"users"');
  });

  it('should save monolith schema positions to @strata-layout and keep table declarations pure Drizzle code', () => {
    const monolith = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", { id: integer("id").primaryKey() });
      export const posts = sqliteTable("posts", { id: integer("id").primaryKey() });
    `;

    const nodes = [
      { id: 'users', position: { x: 120, y: 180 } },
      { id: 'posts', position: { x: 450, y: 180 } }
    ] as any;

    const saved = updateAllNodePositionsInSchema(monolith, nodes);
    expect(saved).toContain('@strata-layout');
    expect(saved).not.toContain('@strata {');
    
    // Declarations remain pure Drizzle code
    expect(saved).toContain('export const users = sqliteTable("users"');
    expect(saved).toContain('export const posts = sqliteTable("posts"');

    const manifest = extractStrataLayoutManifest(saved);
    expect(manifest?.users).toEqual({ x: 120, y: 180 });
    expect(manifest?.posts).toEqual({ x: 450, y: 180 });
  });

  it('should cleanly consolidate dummy binding declarations and strip unused imports from modular barrels', () => {
    const dirtyBarrel = `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * @strata-layout {
 *   "user": { "x": 3698, "y": 1196 },
 *   "session": { "x": 3307, "y": 50 },
 *   "account": { "x": 3297, "y": 474 },
 *   "verification": { "x": 996, "y": 50 },
 *   "organizations": { "x": 3268, "y": 1225 },
 *   "organizationMemberships": { "x": 2755, "y": 949 },
 *   "organizationInvites": { "x": 2796, "y": 1262 },
 *   "profile": { "x": 3321, "y": 1958 },
 *   "projects": { "x": 2784, "y": 1612 },
 *   "projectAccessKeys": { "x": 2266, "y": 1335 },
 *   "projectQuotas": { "x": 2298, "y": 1757 },
 *   "gameBuilds": { "x": 2290, "y": 948 },
 *   "telemetrySessions": { "x": 1776, "y": 1355 },
 *   "payments": { "x": 2339, "y": 2178 },
 *   "processedWebhooks": { "x": 600, "y": 50 },
 *   "GAMES_BUCKET": { 
 *     "x": 1825, 
 *     "y": 950,
 *     "relations": [{ "to": "gameBuilds" }]
 *   },
 *   "TELEMETRY_BUFFER": { 
 *     "x": 1320, 
 *     "y": 1443,
 *     "relations": [{ "to": "telemetrySessions" }, { "to": "GAMES_BUCKET" }]
 *   },
 *   "ISITFUN_KV": { "x": 50, "y": 50 },
 *   "DRIFTER_CONTROL": { "x": 310, "y": 50 }
 * }
 */

export const GAMES_BUCKET = {};
export const TELEMETRY_BUFFER = {};
export const ISITFUN_KV = {};
export const DRIFTER_CONTROL = {};

export * from './utils';
export * from './auth';
export * from './orgs';
export * from './projects';
export * from './builds';
export * from './telemetry';
export * from './payments';
`;

    // 1. Audit detects dummy bindings & unused imports
    const auditParsed = parseSchema(dirtyBarrel, new Map(), undefined, undefined, '/project/schema/index.ts');
    const dummyWarnings = (auditParsed.auditIssues || []).filter(i => i.code === 'BARREL_DUMMY_BINDING');
    const unusedImportWarnings = (auditParsed.auditIssues || []).filter(i => i.code === 'UNUSED_BARREL_IMPORT');

    expect(dummyWarnings.length).toBe(4);
    expect(dummyWarnings[0].suggestedFix?.action).toBe('migrate_dummy_to_manifest');
    expect(unusedImportWarnings.length).toBe(1);
    expect(unusedImportWarnings[0].suggestedFix?.action).toBe('remove_unused_import');

    // 2. Consolidate into clean manifest
    const cleaned = consolidateDummyBindingsIntoManifest(dirtyBarrel);

    // Dummy declarations must be gone
    expect(cleaned).not.toContain('export const GAMES_BUCKET = {};');
    expect(cleaned).not.toContain('export const TELEMETRY_BUFFER = {};');
    expect(cleaned).not.toContain('export const ISITFUN_KV = {};');
    expect(cleaned).not.toContain('export const DRIFTER_CONTROL = {};');

    // Unused drizzle-orm import must be gone
    expect(cleaned).not.toContain('drizzle-orm/sqlite-core');

    // Re-exports must be preserved
    expect(cleaned).toContain("export * from './utils';");
    expect(cleaned).toContain("export * from './auth';");
    expect(cleaned).toContain("export * from './orgs';");
    expect(cleaned).toContain("export * from './projects';");
    expect(cleaned).toContain("export * from './builds';");
    expect(cleaned).toContain("export * from './telemetry';");
    expect(cleaned).toContain("export * from './payments';");

    // Manifest retains coordinates and synthetic relations
    const manifest = extractStrataLayoutManifest(cleaned);
    expect(manifest?.GAMES_BUCKET.x).toBe(1825);
    expect(manifest?.GAMES_BUCKET.y).toBe(950);
    expect(manifest?.GAMES_BUCKET.relations).toEqual([{ to: 'gameBuilds' }]);

    expect(manifest?.TELEMETRY_BUFFER.x).toBe(1320);
    expect(manifest?.TELEMETRY_BUFFER.y).toBe(1443);
    expect(manifest?.TELEMETRY_BUFFER.relations).toEqual([
      { to: 'telemetrySessions' },
      { to: 'GAMES_BUCKET' }
    ]);

    expect(manifest?.ISITFUN_KV.x).toBe(50);
    expect(manifest?.DRIFTER_CONTROL.x).toBe(310);

    // 3. Re-auditing the cleaned barrel yields zero dummy or unused import warnings!
    const cleanAudit = parseSchema(cleaned, new Map(), undefined, undefined, '/project/schema/index.ts');
    expect((cleanAudit.auditIssues || []).filter(i => i.code === 'BARREL_DUMMY_BINDING')).toHaveLength(0);
    expect((cleanAudit.auditIssues || []).filter(i => i.code === 'UNUSED_BARREL_IMPORT')).toHaveLength(0);
  });

  it('should preserve synthetic relations during node drag position updates', () => {
    const cleanBarrel = `/**
 * @strata-layout {
 *   "GAMES_BUCKET": {
 *     "x": 1825,
 *     "y": 950,
 *     "relations": [{ "to": "gameBuilds" }]
 *   }
 * }
 */
export * from './builds';`;

    const updated = updateLayoutManifestInSchema(
      cleanBarrel,
      { GAMES_BUCKET: { x: 2000, y: 1100 } },
      true // pruneMissing
    );

    const manifest = extractStrataLayoutManifest(updated);
    expect(manifest?.GAMES_BUCKET.x).toBe(2000);
    expect(manifest?.GAMES_BUCKET.y).toBe(1100);
    expect(manifest?.GAMES_BUCKET.relations).toEqual([{ to: 'gameBuilds' }]);
  });

  it('should add and remove synthetic relations in @strata-layout without dummy code', () => {
    const barrel = `/**
 * @strata-layout {
 *   "TELEMETRY_BUFFER": {
 *     "x": 1320,
 *     "y": 1443,
 *     "relations": [{ "to": "telemetrySessions" }, { "to": "GAMES_BUCKET" }]
 *   },
 *   "ISITFUN_KV": { "x": 50, "y": 50 }
 * }
 */
export * from './telemetry';`;

    // Remove edge between TELEMETRY_BUFFER and GAMES_BUCKET
    const afterRemoval = removeEdgeFromSchema(barrel, 'TELEMETRY_BUFFER', 'GAMES_BUCKET');
    const manifestAfterRemoval = extractStrataLayoutManifest(afterRemoval);
    expect(manifestAfterRemoval?.TELEMETRY_BUFFER.relations).toEqual([{ to: 'telemetrySessions' }]);

    // Add synthetic edge from ISITFUN_KV to TELEMETRY_BUFFER
    const afterAdd = addEdgeToSchema(barrel, 'ISITFUN_KV', 'TELEMETRY_BUFFER', undefined, 'synthetic');
    const manifestAfterAdd = extractStrataLayoutManifest(afterAdd);
    expect(manifestAfterAdd?.ISITFUN_KV.relations).toEqual([{ to: 'TELEMETRY_BUFFER' }]);

    // Ensure no dummy code was added
    expect(afterAdd).not.toContain('export const ISITFUN_KV');
    expect(afterAdd).not.toContain('sqliteTable');
  });
});

