import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSchema } from '../../src/lib/parser/core';
import {
  extractStrataLayoutManifest,
  updateLayoutManifestInSchema,
  removeTableFromLayoutManifest,
  renameTableInLayoutManifest,
  updateAllNodePositionsInSchema,
  parseDrizzleConfigSchemaPath
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
});
