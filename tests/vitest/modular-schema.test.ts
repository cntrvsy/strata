import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSchema } from '../../src/lib/parser/core';
import { createD1ModuleCode, addReExportToBarrel } from '../../src/lib/parser';
import { schemaState } from '../../src/lib/state';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: vi.fn()
}));

describe('Modular Schema & Multi-File Module Identity (Phase 2)', () => {
  beforeEach(() => {
    schemaState.reset();
    vi.clearAllMocks();
  });

  it('should assign isRootFile: true to monolith schema tables', () => {
    const monolith = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey(),
        name: text("name")
      });
    `;

    const result = parseSchema(monolith, undefined, undefined, undefined, '/project/db/schema.ts');
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);

    const userNode = result.nodes[0];
    expect(userNode.id).toBe('users');
    const moduleInfo = (userNode.data as any).moduleInfo;
    expect(moduleInfo).toBeDefined();
    expect(moduleInfo.isRootFile).toBe(true);
    expect(moduleInfo.moduleName).toBe('schema.ts');
    expect(moduleInfo.sourceFilePath).toBe('/project/db/schema.ts');
  });

  it('should assign first-class module identity to imported and re-exported entities', () => {
    const barrelRoot = `
      export * from './users';
      export * from './posts';
    `;

    const usersContent = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey(),
        email: text("email")
      });
    `;

    const postsContent = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        title: text("title")
      });
    `;

    const externalMap = new Map<string, string>();
    externalMap.set('/project/db/users.ts', usersContent);
    externalMap.set('/project/db/posts.ts', postsContent);

    const result = parseSchema(barrelRoot, externalMap, undefined, undefined, '/project/db/index.ts');
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(2);

    const usersNode = result.nodes.find(n => n.id === 'users');
    expect(usersNode).toBeDefined();
    expect((usersNode?.data as any).moduleInfo.isRootFile).toBe(false);
    expect((usersNode?.data as any).moduleInfo.moduleName).toBe('users.ts');
    expect((usersNode?.data as any).moduleInfo.sourceFilePath).toBe('/project/db/users.ts');

    const postsNode = result.nodes.find(n => n.id === 'posts');
    expect(postsNode).toBeDefined();
    expect((postsNode?.data as any).moduleInfo.isRootFile).toBe(false);
    expect((postsNode?.data as any).moduleInfo.moduleName).toBe('posts.ts');
    expect((postsNode?.data as any).moduleInfo.sourceFilePath).toBe('/project/db/posts.ts');
  });

  it('should route column mutations directly to the modular source file', async () => {
    const barrelRoot = `
      export * from './users';
    `;

    const usersContent = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});
`;

    const writtenFiles: Record<string, string> = {};

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/project/db/index.ts') return barrelRoot;
        if (args.path.endsWith('users.ts')) return usersContent;
      }
      if (cmd === 'write_schema_file') {
        writtenFiles[args.path] = args.content;
        return;
      }
      return '';
    });

    schemaState.filePath = '/project/db/index.ts';
    await schemaState.syncWithFile();

    expect(schemaState.nodes).toHaveLength(1);
    expect(schemaState.nodes[0].id).toBe('users');

    // Add a column to users
    await schemaState.addColumn('users', 'avatarUrl', 'text');

    // Verify index.ts was NOT modified with column definitions
    expect(writtenFiles['/project/db/index.ts']).toBeUndefined();

    // Verify /project/db/users.ts was directly mutated
    const usersPath = Object.keys(writtenFiles).find(p => p.endsWith('users.ts'));
    expect(usersPath).toBeDefined();
    expect(writtenFiles[usersPath!]).toContain('avatarUrl: text("avatarUrl")');
  });

  it('should parse relations from dedicated relations.ts file across modules', () => {
    const barrelRoot = `
      export * from './users';
      export * from './posts';
      export * from './relations';
    `;

    const usersContent = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey(),
        name: text("name")
      });
    `;

    const postsContent = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        title: text("title"),
        authorId: integer("author_id")
      });
    `;

    const relationsContent = `
      import { relations } from "drizzle-orm";
      import { users } from "./users";
      import { posts } from "./posts";

      export const usersRelations = relations(users, ({ many }) => ({
        posts: many(posts)
      }));

      export const postsRelations = relations(posts, ({ one }) => ({
        author: one(users, {
          fields: [posts.authorId],
          references: [users.id]
        })
      }));
    `;

    const externalMap = new Map<string, string>();
    externalMap.set('/project/db/users.ts', usersContent);
    externalMap.set('/project/db/posts.ts', postsContent);
    externalMap.set('/project/db/relations.ts', relationsContent);

    const result = parseSchema(barrelRoot, externalMap, undefined, undefined, '/project/db/index.ts');
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(2);
    // There should be edges connecting users and posts from relations.ts
    expect(result.edges.length).toBeGreaterThanOrEqual(1);
    const edge = result.edges.find(e => (e.source === 'users' && e.target === 'posts') || (e.source === 'posts' && e.target === 'users'));
    expect(edge).toBeDefined();
  });

  it('should insert cross-module import and references foreign key when dragging edge between different files', async () => {
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
  id: integer("id").primaryKey(),
  title: text("title")
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

    // Add foreign key from posts.authorId -> users.id
    await schemaState.addForeignKeyRelation('posts', 'authorId', 'users', 'id');

    // Verify posts.ts was updated with the column, references, AND the import { users } from "./users"
    const postsPath = Object.keys(writtenFiles).find(p => p.endsWith('posts.ts'));
    expect(postsPath).toBeDefined();
    const updatedPosts = writtenFiles[postsPath!];
    expect(updatedPosts).toContain('import { users } from "./users"');
    expect(updatedPosts).toContain('authorId: integer("authorId").references(() => users.id)');
  });

  it('should sync changes when an external domain module file changes on disk even if index.ts is untouched', async () => {
    const barrelRoot = `
      export * from './users';
    `;

    let usersContent = `import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});`;

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/project/db/index.ts') return barrelRoot;
        if (args.path.endsWith('users.ts')) return usersContent;
      }
      return '';
    });

    schemaState.filePath = '/project/db/index.ts';
    await schemaState.syncWithFile();

    expect(schemaState.nodes).toHaveLength(1);
    expect((schemaState.nodes[0].data as any).columns).toHaveLength(1);

    // Simulate external editor modifying users.ts without touching index.ts
    usersContent = `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  email: text("email")
});`;

    // syncWithFile should detect the change in externalFilesMap and reload
    await schemaState.syncWithFile();

    expect(schemaState.nodes).toHaveLength(1);
    expect((schemaState.nodes[0].data as any).columns).toHaveLength(2);
    expect((schemaState.nodes[0].data as any).columns.some((c: any) => c.name === 'email')).toBe(true);
  });

  it('should delete cross-module foreign key relation and clean up unused import in domain module file', async () => {
    const barrelRoot = `
      export * from './users';
      export * from './posts';
    `;

    const usersContent = `import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});`;

    const postsContent = `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  title: text("title"),
  authorId: integer("author_id").references(() => users.id)
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
    expect(schemaState.edges.length).toBeGreaterThanOrEqual(1);

    // Delete relation from posts.authorId -> users
    await schemaState.deleteRelation('posts', 'users', 'authorId');

    const postsPath = Object.keys(writtenFiles).find(p => p.endsWith('posts.ts'));
    expect(postsPath).toBeDefined();
    const updatedPosts = writtenFiles[postsPath!];

    // Verify .references() was removed
    expect(updatedPosts).not.toContain('references(');
    // Verify unused import of users was cleaned up
    expect(updatedPosts).not.toContain('import { users }');
  });

  it('should delete logical relation from dedicated relations.ts and clean up unused imports', async () => {
    const barrelRoot = `
      export * from './users';
      export * from './posts';
      export * from './relations';
    `;

    const usersContent = `import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});`;

    const postsContent = `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  title: text("title")
});`;

    const relationsContent = `import { relations } from "drizzle-orm";
import { users } from "./users";
import { posts } from "./posts";

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.id],
    references: [users.id]
  })
}));`;

    const writtenFiles: Record<string, string> = {};

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/project/db/index.ts') return barrelRoot;
        if (args.path.endsWith('users.ts')) return usersContent;
        if (args.path.endsWith('posts.ts')) return postsContent;
        if (args.path.endsWith('relations.ts')) return relationsContent;
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
    expect(schemaState.edges.length).toBeGreaterThanOrEqual(1);

    // Delete relation from relations.ts
    await schemaState.deleteRelation('posts', 'users', 'author');

    const relPath = Object.keys(writtenFiles).find(p => p.endsWith('relations.ts'));
    expect(relPath).toBeDefined();
    const updatedRelations = writtenFiles[relPath!];

    // author relation should be gone
    expect(updatedRelations).not.toContain('author: one(users');
    // unused imports should be cleaned up
    expect(updatedRelations).not.toContain('import { users }');
    expect(updatedRelations).not.toContain('import { posts }');
    expect(updatedRelations).not.toContain('import { relations }');
  });

  it('should generate clean standalone module code with createD1ModuleCode', () => {
    const code = createD1ModuleCode('comments');
    expect(code).toContain('import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";');
    expect(code).toContain('export const comments = sqliteTable("comments", {');
    expect(code).toContain('id: integer("id").primaryKey()');
  });

  it('should cleanly add re-exports to barrel files with addReExportToBarrel', () => {
    const initialBarrel = `export * from "./users";\n`;
    const updated = addReExportToBarrel(initialBarrel, './comments');
    expect(updated).toBe(`export * from "./users";\nexport * from "./comments";\n`);

    // Idempotent: should not add duplicate
    const again = addReExportToBarrel(updated, './comments');
    expect(again).toBe(updated);

    // Handles without leading ./ and with .ts extension
    const noPrefix = addReExportToBarrel(initialBarrel, 'posts.ts');
    expect(noPrefix).toBe(`export * from "./users";\nexport * from "./posts";\n`);
  });

  it('should scaffold a new domain module file when adding an entity with mode=new', async () => {
    const barrelRoot = `
/**
 * @strata-layout { "users": { "x": 100, "y": 150 } }
 */
export * from './users';
`;

    const usersContent = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});
`;

    const writtenFiles: Record<string, string> = {};

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/project/db/index.ts') return writtenFiles['/project/db/index.ts'] || barrelRoot;
        if (args.path.endsWith('users.ts')) return usersContent;
        if (args.path.endsWith('comments.ts')) return writtenFiles['/project/db/comments.ts'];
      }
      if (cmd === 'write_schema_file') {
        writtenFiles[args.path] = args.content;
        return;
      }
      return '';
    });

    schemaState.filePath = '/project/db/index.ts';
    await schemaState.syncWithFile();

    expect(schemaState.isModular).toBe(true);
    expect(schemaState.availableModules).toHaveLength(1);
    expect(schemaState.availableModules[0].name).toBe('users.ts');

    // Add table to new module file
    await schemaState.addTable('comments', 'd1', undefined, {
      mode: 'new',
      targetModule: 'comments.ts'
    });

    // 1. comments.ts was written to disk
    expect(writtenFiles['/project/db/comments.ts']).toBeDefined();
    expect(writtenFiles['/project/db/comments.ts']).toContain('export const comments = sqliteTable("comments"');

    // 2. index.ts was updated with export * from "./comments" and @strata-layout
    expect(writtenFiles['/project/db/index.ts']).toBeDefined();
    expect(writtenFiles['/project/db/index.ts']).toContain('export * from "./comments"');
    expect(writtenFiles['/project/db/index.ts']).toContain('"comments":');

    // 3. schemaState nodes updated
    const commentNode = schemaState.nodes.find(n => n.id === 'comments');
    expect(commentNode).toBeDefined();
    expect((commentNode?.data as any).moduleInfo.moduleName).toBe('comments.ts');
  });

  it('should append an entity to an existing domain module file when mode=existing', async () => {
    const barrelRoot = `
/**
 * @strata-layout { "users": { "x": 100, "y": 150 } }
 */
export * from './users';
`;

    const usersContent = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});
`;

    const writtenFiles: Record<string, string> = {};

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/project/db/index.ts') return writtenFiles['/project/db/index.ts'] || barrelRoot;
        if (args.path.endsWith('users.ts')) return writtenFiles['/project/db/users.ts'] || usersContent;
      }
      if (cmd === 'write_schema_file') {
        writtenFiles[args.path] = args.content;
        return;
      }
      return '';
    });

    schemaState.filePath = '/project/db/index.ts';
    await schemaState.syncWithFile();

    // Add table to existing users.ts
    await schemaState.addTable('profiles', 'd1', undefined, {
      mode: 'existing',
      targetModule: '/project/db/users.ts'
    });

    // 1. users.ts was updated with profiles
    expect(writtenFiles['/project/db/users.ts']).toBeDefined();
    expect(writtenFiles['/project/db/users.ts']).toContain('export const profiles = sqliteTable("profiles"');

    // 2. index.ts recorded profiles in @strata-layout
    expect(writtenFiles['/project/db/index.ts']).toBeDefined();
    expect(writtenFiles['/project/db/index.ts']).toContain('"profiles":');

    // 3. schemaState nodes updated
    const profileNode = schemaState.nodes.find(n => n.id === 'profiles');
    expect(profileNode).toBeDefined();
    expect((profileNode?.data as any).moduleInfo.moduleName).toBe('users.ts');
  });

  it('should discover and load wrangler.toml bindings from project root when opening a nested modular barrel', async () => {
    const barrelRoot = `
      export * from './users';
    `;
    const usersContent = `import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: integer("id").primaryKey()
});`;
    const wranglerToml = `
name = "modular-worker"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "xxxx-xxxx"

[[durable_objects.bindings]]
name = "ROOM_DO"
class_name = "RoomDO"

[[r2_buckets]]
binding = "UPLOADS_BUCKET"
bucket_name = "my-uploads"
`;

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/my-project/src/db/schema/index.ts') return barrelRoot;
        if (args.path.endsWith('users.ts')) return usersContent;
        if (args.path === '/my-project/wrangler.toml') return wranglerToml;
      }
      return '';
    });

    schemaState.filePath = '/my-project/src/db/schema/index.ts';
    await schemaState.syncWithFile();

    // 1. Verify wrangler file was discovered at the project root 3 levels up
    expect(schemaState.wranglerConfigFilePath).toBe('/my-project/wrangler.toml');

    // 2. Verify all 3 bindings (kv, do, r2) were ingested
    expect(schemaState.wranglerBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'kv', name: 'SESSIONS_KV' }),
        expect.objectContaining({ type: 'do', name: 'ROOM_DO', extra: { class: 'RoomDO' } }),
        expect.objectContaining({ type: 'r2', name: 'UPLOADS_BUCKET' })
      ])
    );

    // 3. Verify external visual nodes are spawned on the canvas alongside Drizzle tables
    expect(schemaState.nodes.some(n => n.id === 'users')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'SESSIONS_KV')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'ROOM_DO')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'UPLOADS_BUCKET')).toBe(true);
  });
});

