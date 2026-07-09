import { describe, it, expect, vi } from 'vitest';
import { 
  parseSchema, 
  updateNodePositionInSchema, 
  updateAllNodePositionsInSchema,
  addEdgeToSchema, 
  addColumnToSchema, 
  removeTableFromSchema, 
  renameTableInSchema, 
  renameColumnInSchema,
  removeColumnFromSchema,
  updateColumnModifiersInSchema,
  removeEdgeFromSchema,
  wrapCode,
  updateProjectConfigInSchema,
  updateTableMetadataInSchema
} from '../../src/lib/parser';
import { PlatformService } from '../../src/lib/services/platform';

describe('Parser Core', () => {
  it('should parse simple D1 tables', () => {
    const code = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey(),
        name: text("name").notNull(),
      });
    `;
    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('users');
    expect(result.nodes[0].data.target).toBe('d1');
  });

  it('should parse KV objects with @strata metadata', () => {
    const code = `
      /** @strata {"target": "kv", "x": 10, "y": 20} */
      export const sessions = {
        id: "string",
      };
    `;
    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect((result.nodes[0].data as any).target).toBe('kv');
    expect(result.nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('should handle nested JSON in @strata (Fix for the recent bug)', () => {
    const code = `
      /** 
       * @strata {"x":180,"y":-45,"target":"kv","relations":[{"to":"activeSessions"}]} 
       */
      export const lucas = {
        id: "string",
      };
    `;
    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect((result.nodes[0].data as any).strata.relations).toHaveLength(1);
    expect((result.nodes[0].data as any).strata.relations[0].to).toBe('activeSessions');
  });

  it('should handle multi-line @strata JSDoc', () => {
    const code = `
      /** 
       * @strata {
       *   "x": 100,
       *   "target": "do"
       * } 
       */
      export const counter = {
        val: "number"
      };
    `;
    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect((result.nodes[0].data as any).target).toBe('do');
    expect(result.nodes[0].position.x).toBe(100);
  });

  it('should parse Drizzle relations() as edges', () => {
    const code = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      import { relations } from "drizzle-orm";
      export const users = sqliteTable("users", { id: integer("id") });
      export const posts = sqliteTable("posts", { id: integer("id") });
      export const usersRelations = relations(users, ({ many }) => ({
        posts: many(posts)
      }));
    `;
    const result = parseSchema(code);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('users');
    expect(result.edges[0].target).toBe('posts');
  });

  it('should detect physical Foreign Keys via .references()', () => {
    const code = `
      export const posts = sqliteTable("posts", {
        authorId: integer("author_id").references(() => users.id)
      });
    `;
    const result = parseSchema(code);
    const postNode = result.nodes.find(n => n.id === 'posts');
    const authorCol = (postNode?.data as any).columns.find((c: any) => c.name === 'authorId');
    expect(authorCol.isReferences).toBe(true);
  });

  it('should attach closed arrowhead markers (markerEnd) to relation edges', () => {
    const code = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      import { relations } from "drizzle-orm";
      export const users = sqliteTable("users", { id: integer("id") });
      export const posts = sqliteTable("posts", { id: integer("id") });
      export const usersRelations = relations(users, ({ many }) => ({
        posts: many(posts)
      }));
    `;
    const result = parseSchema(code);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].markerEnd).toBeDefined();
    expect((result.edges[0].markerEnd as any)?.type).toBe('arrowclosed');
  });

  it('should parse relation cardinality (1:1 vs 1:N vs N:1)', () => {
    const code = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      import { relations } from "drizzle-orm";
      export const users = sqliteTable("users", { id: integer("id") });
      export const posts = sqliteTable("posts", { id: integer("id") });
      export const profiles = sqliteTable("profiles", { id: integer("id") });
      
      export const usersRelations = relations(users, ({ many, one }) => ({
        posts: many(posts),
        profile: one(profiles)
      }));
      export const profilesRelations = relations(profiles, ({ one }) => ({
        user: one(users)
      }));
    `;
    const result = parseSchema(code);
    const usersToPosts = result.edges.find(e => e.source === 'users' && e.target === 'posts');
    const usersToProfiles = result.edges.find(e => e.source === 'users' && e.target === 'profiles');
    
    expect(usersToPosts?.data?.cardinality).toBe('1:N');
    expect(usersToProfiles?.data?.cardinality).toBe('1:1');
  });

  it('should detect relative imports and expose them in externalImports', () => {
    const code = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      import { user } from "./auth.schema";
      export const sessions = sqliteTable("sessions", {
        userId: integer("user_id").references(() => user.id)
      });
    `;
    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect(result.externalImports).toBeDefined();
    expect(result.externalImports).toHaveLength(1);
    expect(result.externalImports?.[0].filePath).toBe('./auth.schema');
    expect(result.externalImports?.[0].importNames).toContain('user');
  });

  it('should parse external tables from externalFilesMap safely', () => {
    const code = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      import { user } from "./auth.schema";
      export const sessions = sqliteTable("sessions", {
        userId: integer("user_id").references(() => user.id)
      });
    `;
    const externalFilesMap = new Map<string, string>();
    externalFilesMap.set('./auth.schema', `
      import { sqliteTable, text } from "drizzle-orm/sqlite-core";
      export const user = sqliteTable("user", {
        id: text("id").primaryKey(),
        name: text("name")
      });
    `);

    const result = parseSchema(code, externalFilesMap);
    console.log("DEBUG TEST RESULT:", JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(2);

    const userNode = result.nodes.find(n => n.id === 'user');
    expect(userNode).toBeDefined();
    expect(userNode?.data.isExternal).toBe(true);
    expect((userNode?.data as any).columns).toHaveLength(2);
    expect((userNode?.data as any).columns[0].name).toBe('id');
  });

  it('should handle missing external file values gracefully without failing the parse', () => {
    const code = `
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      import { user } from "./auth.schema";
      export const sessions = sqliteTable("sessions", {
        userId: integer("user_id").references(() => user.id)
      });
    `;
    const externalFilesMap = new Map<string, string>(); // Empty map, simulate missing file
    const result = parseSchema(code, externalFilesMap);
    
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1); // Only sessions table parsed
  });
});

describe('Mutation Logic', () => {
  it('should update node position without breaking code', () => {
    const code = `/** @strata {"x":0,"y":0} */\nexport const t = sqliteTable("t", { id: integer("id") });`;
    const newCode = updateNodePositionInSchema(code, 't', 150, 250);
    expect(newCode).toContain('"x":150,"y":250');
    expect(newCode).toContain('export const t = sqliteTable');
  });

  it('should update multiple node positions in a single pass', () => {
    const code = `
      /** @strata {"x":0,"y":0} */
      export const users = sqliteTable("users", { id: integer("id") });
      /** @strata {"x":10,"y":10} */
      export const posts = sqliteTable("posts", { id: integer("id") });
    `;
    const newCode = updateAllNodePositionsInSchema(code, [
      { id: 'users', position: { x: 100, y: 150 } },
      { id: 'posts', position: { x: 200, y: 250 } }
    ] as any);
    expect(newCode).toContain('"x":100,"y":150');
    expect(newCode).toContain('"x":200,"y":250');
  });

  it('should add synthetic relations to existing @strata tags', () => {
    const code = `/** @strata {"target":"kv"} */\nexport const a = { id: "s" };\nexport const b = { id: "s" };`;
    const newCode = addEdgeToSchema(code, 'a', 'b');
    expect(newCode).toContain('"relations":[{"to":"b"}]');
  });

  it('should surgically remove a table and its relations', () => {
    const code = `
      export const users = sqliteTable("users", { id: integer("id") });
      export const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }));
    `;
    const newCode = removeTableFromSchema(code, 'users');
    expect(newCode).not.toContain('export const users');
    expect(newCode).not.toContain('export const usersRelations');
  });

  it('should add a column to an existing D1 table', async () => {
    const code = `export const users = sqliteTable("users", { id: integer("id") });`;
    const newCode = await addColumnToSchema(code, 'users', 'email', 'text');
    expect(newCode).toContain('email: text("email")');
  });

  it('should rename a table and its associated relations() block', () => {
    const code = `
      export const users = sqliteTable("users", { id: integer("id") });
      export const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }));
    `;
    const newCode = renameTableInSchema(code, 'users', 'customers');
    expect(newCode).toContain('export const customers = sqliteTable("customers"');
    expect(newCode).toContain('export const customersRelations = relations(customers');
  });

  it('should rename a column and its database identifier', async () => {
    const code = `export const users = sqliteTable("users", { name: text("name") });`;
    const newCode = await renameColumnInSchema(code, 'users', 'name', 'fullName');
    expect(newCode).toContain('fullName: text("fullName")');
  });

  describe('Edge Cases & Preservation', () => {
    it('should preserve other JSDoc tags when updating @strata', () => {
      const code = `
        /**
         * @description The user profile table
         * @strata {"x":0,"y":0}
         */
        export const users = sqliteTable("users", { id: integer("id") });
      `;
      const newCode = updateNodePositionInSchema(code, 'users', 100, 200);
      expect(newCode).toContain('@description The user profile table');
      expect(newCode).toContain('"x":100,"y":200');
    });

    it('should handle multiple relations() blocks in one file', () => {
      const code = `
        import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
        import { relations } from "drizzle-orm";
        export const a = sqliteTable("a", { id: integer("id") });
        export const b = sqliteTable("b", { id: integer("id") });
        export const c = sqliteTable("c", { id: integer("id") });
        
        export const aRelations = relations(a, ({ many }) => ({ bs: many(b) }));
        export const bRelations = relations(b, ({ one }) => ({ c: one(c) }));
      `;
      const result = parseSchema(code);
      expect(result.edges).toHaveLength(2);
      expect(result.edges.some(e => e.source === 'a' && e.target === 'b')).toBe(true);
      expect(result.edges.some(e => e.source === 'b' && e.target === 'c')).toBe(true);
    });

    it('should handle adding an edge when relations() already exists for the source', () => {
      const code = `
        export const users = sqliteTable("users", { id: integer("id") });
        export const posts = sqliteTable("posts", { id: integer("id") });
        export const comments = sqliteTable("comments", { id: integer("id") });
        export const usersRelations = relations(users, ({ many }) => ({
          posts: many(posts)
        }));
      `;
      const newCode = addEdgeToSchema(code, 'users', 'comments');
      expect(newCode).toContain('posts: many(posts)');
      expect(newCode).toContain('comments: many(comments)');
    });

    it('should rename a column in a KV object', async () => {
      const code = `export const sessions = { id: "string", user: "string" };`;
      const newCode = await renameColumnInSchema(code, 'sessions', 'user', 'userId');
      expect(newCode).toContain('userId: "string"');
    });

    it('should add a column to a KV object', async () => {
      const code = `export const sessions = { id: "string" };`;
      const newCode = await addColumnToSchema(code, 'sessions', 'ttl', 'number');
      expect(newCode).toContain('ttl: "number"');
    });

    it('should remove a column from a KV object', async () => {
      const code = `export const sessions = { id: "string", trash: "any" };`;
      const newerCode = await removeColumnFromSchema(code, 'sessions', 'trash');
      expect(newerCode).not.toContain('trash: "any"');
    });

    it('should remove a column from a D1 table', async () => {
      const code = `export const users = sqliteTable("users", { id: integer("id"), bio: text("bio") });`;
      const newCode = await removeColumnFromSchema(code, 'users', 'bio');
      expect(newCode).not.toContain('bio: text("bio")');
    });

    it('should create a JSDoc with @strata if none exists when updating position', () => {
      const code = `export const t = sqliteTable("t", { id: integer("id") });`;
      const newCode = updateNodePositionInSchema(code, 't', 10, 20);
      expect(newCode).toContain('@strata { "x": 10, "y": 20 }');
    });

    it('should handle invalid JSON in @strata gracefully', () => {
      const code = `/** @strata {invalid} */\nexport const t = sqliteTable("t", { id: integer("id") });`;
      const result = parseSchema(code);
      expect(result.success).toBe(true); // Should fallback to defaults
      expect(result.nodes[0].position.x).toBeGreaterThanOrEqual(0);
    });

    it('should return error if no tables found in non-empty code', () => {
      const code = `const x = 1;`;
      const result = parseSchema(code);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No tables or schema objects found');
    });


    it('should wrap code correctly', () => {
      expect(wrapCode('const x = 1;')).toBe('<pre><code>const x = 1;</code></pre>');
    });

    it('should handle complex sqliteTable initializers (descendants check)', async () => {
      const code = `export const users = someWrapper(sqliteTable("users", { id: integer("id") }));`;
      const result = await renameColumnInSchema(code, 'users', 'id', 'newId');
      expect(result).toContain('newId: integer("newId")');
    });

    it('should handle source decl not being a table in addEdgeToSchema', () => {
      const code = `/** @strata {"target":"kv"} */\nexport const a = { id: "s" };\nexport const b = { id: "s" };`;
      // This should trigger the synthetic branch
      const newCode = addEdgeToSchema(code, 'a', 'b');
      expect(newCode).toContain('"relations":[{"to":"b"}]');
    });

    it('should add a column with references', async () => {
      const code = `export const users = sqliteTable("users", { id: integer("id") }); export const posts = sqliteTable("posts", { id: integer("id") });`;
      const newCode = await addColumnToSchema(code, 'posts', 'authorId', 'integer', 'users', 'id');
      expect(newCode).toContain('.references(() => users.id)');
    });

    it('should surgically add, update, and remove column modifiers (pk, notNull, default)', () => {
      const baseCode = `export const users = sqliteTable("users", { id: integer("id") });`;
      
      // Add primaryKey and notNull
      let code = updateColumnModifiersInSchema(baseCode, 'users', 'id', { isPk: true, notNull: true });
      expect(code).toContain('id: integer("id").primaryKey().notNull()');

      // Add default value
      code = updateColumnModifiersInSchema(code, 'users', 'id', { defaultVal: '10' });
      expect(code).toContain('id: integer("id").primaryKey().notNull().default(10)');

      // Update default value
      code = updateColumnModifiersInSchema(code, 'users', 'id', { defaultVal: '"test"' });
      expect(code).toContain('id: integer("id").primaryKey().notNull().default("test")');

      // Remove primaryKey, notNull, and default
      code = updateColumnModifiersInSchema(code, 'users', 'id', { isPk: false, notNull: false, defaultVal: null });
      expect(code).toContain('id: integer("id")');
      expect(code).not.toContain('.primaryKey()');
      expect(code).not.toContain('.notNull()');
      expect(code).not.toContain('.default(');
    });

    it('should remove a table and clean up references/relations from other tables', () => {
      const code = `
        import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
        import { relations } from "drizzle-orm";
        export const users = sqliteTable("users", {
          id: integer("id").primaryKey()
        });
        export const posts = sqliteTable("posts", {
          id: integer("id").primaryKey(),
          authorId: integer("author_id").references(() => users.id)
        });
        export const postsRelations = relations(posts, ({ one }) => ({
          author: one(users, {
            fields: [posts.authorId],
            references: [users.id]
          })
        }));
      `;
      const newCode = removeTableFromSchema(code, 'users');
      expect(newCode).not.toContain('export const users');
      expect(newCode).toContain('export const posts');
      expect(newCode).not.toContain('.references(');
      expect(newCode).not.toContain('postsRelations');
    });

    it('should remove a physical foreign key edge/relationship', () => {
      const code = `
        import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
        export const users = sqliteTable("users", { id: integer("id") });
        export const posts = sqliteTable("posts", {
          id: integer("id"),
          authorId: integer("author_id").references(() => users.id)
        });
      `;
      const newCode = removeEdgeFromSchema(code, 'posts', 'users');
      expect(newCode).not.toContain('.references(() => users.id)');
      expect(newCode).toContain('authorId: integer("author_id")');
    });

    it('should remove a logical Drizzle relations edge', () => {
      const code = `
        import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
        import { relations } from "drizzle-orm";
        export const users = sqliteTable("users", { id: integer("id") });
        export const posts = sqliteTable("posts", { id: integer("id") });
        export const usersRelations = relations(users, ({ many }) => ({
          posts: many(posts)
        }));
      `;
      const newCode = removeEdgeFromSchema(code, 'users', 'posts', 'posts');
      expect(newCode).not.toContain('posts: many(posts)');
      expect(newCode).not.toContain('usersRelations');
    });

    it('should remove a synthetic JSDoc connection edge', () => {
      const code = `
        /** @strata {"target":"kv","relations":[{"to":"users"}]} */
        export const sessions = { id: "string" };
        export const users = { id: "string" };
      `;
      const newCode = removeEdgeFromSchema(code, 'sessions', 'users');
      expect(newCode).not.toContain('"relations"');
      expect(newCode).toContain('"target":"kv"');
    });
  });

  describe('Cloudflare Storage Targets & Schema Pointers', () => {
    it('should parse R2 target with folders mapping', () => {
      const code = `
        /**
         * @strata {
         *   "target": "r2",
         *   "folders": {
         *     "avatars": "image/*",
         *     "backups": "application/zip"
         *   }
         * }
         */
        export const myBucket = {};
      `;
      const result = parseSchema(code);
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];
      const data = node.data as any;
      expect(data.target).toBe('r2');
      expect(data.columns).toHaveLength(2);
      expect(data.columns[0]).toEqual({
        name: 'avatars/',
        definition: 'image/*',
        isPk: false,
        isReferences: false
      });
    });

    it('should parse KV target with JSDoc schema field mappings', () => {
      const code = `
        /**
         * @strata {
         *   "target": "kv",
         *   "schema": {
         *     "sessionToken": "string",
         *     "userId": "string",
         *     "expires": "number"
         *   }
         * }
         */
        export const myKv = {};
      `;
      const result = parseSchema(code);
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];
      const data = node.data as any;
      expect(data.target).toBe('kv');
      expect(data.columns).toHaveLength(3);
      expect(data.columns[0].name).toBe('sessionToken');
      expect(data.columns[0].definition).toBe('string');
    });

    it('should parse DO target and load class methods from external file contents', () => {
      const code = `
        /**
         * @strata {
         *   "target": "do",
         *   "class": "Counter",
         *   "path": "./src/Counter.ts"
         * }
         */
      	export const counterDO = {};
      `;
      const externalFiles = new Map<string, string>();
      externalFiles.set('./src/Counter.ts', `
        export class Counter {
          public async increment(amount: number): Promise<void> {}
          public async getValue(): Promise<number> { return 0; }
          private internalHelper() {}
        }
      `);
      const result = parseSchema(code, externalFiles);
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];
      const data = node.data as any;
      expect(data.target).toBe('do');
      // Should extract public methods increment and getValue, but not private internalHelper
      expect(data.columns).toHaveLength(2);
      expect(data.columns[0].name).toBe('increment(amount: number)');
      expect(data.columns[0].definition).toBe('Promise<void>');
      expect(data.columns[1].name).toBe('getValue()');
      expect(data.columns[1].definition).toBe('Promise<number>');
    });

    it('should collect schema pointers in externalPaths during first pass', () => {
      const code = `
        /** @strata { "target": "schema", "path": "./auth.ts" } */
        export const authSchema = {};
      `;
      const result = parseSchema(code);
      expect(result.success).toBe(false); // No nodes defined in the main file
      expect(result.externalPaths).toContain('./auth.ts');
    });

    it('should parse variables from custom schema pointer files on second pass', () => {
      const code = `
        /** @strata { "target": "schema", "path": "./auth.ts" } */
        export const authSchema = {};
      `;
      const externalFiles = new Map<string, string>();
      externalFiles.set('./auth.ts', `
        import { sqliteTable, text } from "drizzle-orm/sqlite-core";
        export const users = sqliteTable("users", {
          id: text("id").primaryKey()
        });
      `);
      const result = parseSchema(code, externalFiles);
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('users');
      expect(result.nodes[0].data.target).toBe('d1');
    });
  });

  describe('Target-Specific Schema CRUD Operations', () => {
    it('should correctly mutate D1 table columns', async () => {
      const code = `export const users = sqliteTable("users", { id: integer("id") });`;
      let mutated = await addColumnToSchema(code, 'users', 'email', 'text');
      expect(mutated).toContain('email: text("email")');
      
      mutated = await renameColumnInSchema(mutated, 'users', 'email', 'userEmail');
      expect(mutated).toContain('userEmail: text("userEmail")');
      expect(mutated).not.toContain('email: text("email")');
      
      mutated = await removeColumnFromSchema(mutated, 'users', 'userEmail');
      expect(mutated).not.toContain('userEmail');
    });

    it('should correctly mutate KV object fields in inline definitions and JSDoc schemas', async () => {
      // Inline literal mutation
      const inlineCode = `export const kv = { val: "string" };`;
      let mutated = await addColumnToSchema(inlineCode, 'kv', 'expires', 'number');
      expect(mutated).toContain('expires: "number"');
      
      mutated = await renameColumnInSchema(mutated, 'kv', 'expires', 'expiresAt');
      expect(mutated).toContain('expiresAt: "number"');
      
      mutated = await removeColumnFromSchema(mutated, 'kv', 'expiresAt');
      expect(mutated).not.toContain('expiresAt');

      // JSDoc schema metadata mutation
      const jsdocCode = `/** @strata { "target": "kv", "schema": { "val": "string" } } */\nexport const kv = {};`;
      mutated = await addColumnToSchema(jsdocCode, 'kv', 'expires', 'number');
      expect(mutated).toContain('"expires":"number"');
      
      mutated = await renameColumnInSchema(mutated, 'kv', 'expires', 'expiresAt');
      expect(mutated).toContain('"expiresAt":"number"');
      expect(mutated).not.toContain('"expires":');
      
      mutated = await removeColumnFromSchema(mutated, 'kv', 'expiresAt');
      expect(mutated).not.toContain('expiresAt');
    });

    it('should correctly mutate R2 folder structures in JSDoc', async () => {
      const code = `/** @strata { "target": "r2", "folders": { "avatars": "image/*" } } */\nexport const bucket = {};`;
      let mutated = await addColumnToSchema(code, 'bucket', 'backups', 'application/zip');
      expect(mutated).toContain('"backups":"application/zip"');
      
      mutated = await renameColumnInSchema(mutated, 'bucket', 'backups', 'archives');
      expect(mutated).toContain('"archives":"application/zip"');
      expect(mutated).not.toContain('backups');
      
      mutated = await removeColumnFromSchema(mutated, 'bucket', 'archives');
      expect(mutated).not.toContain('archives');
    });

    it('should parse strataConfig project wranglerPath correctly', () => {
      const code = `/** @strata { "target": "project", "wranglerPath": "../wrangler.toml" } */\nexport const strataConfig = {};`;
      const result = parseSchema(code);
      expect(result.wranglerPath).toBe('../wrangler.toml');
    });

    it('should write and update project configuration JSDoc metadata', () => {
      const baseCode = `export const users = sqliteTable("users", { id: integer("id") });`;
      let mutated = updateProjectConfigInSchema(baseCode, { wranglerPath: '../../wrangler.toml' });
      expect(mutated).toContain('"target":"project"');
      expect(mutated).toContain('"wranglerPath":"../../wrangler.toml"');

      // Update existing config
      mutated = updateProjectConfigInSchema(mutated, { wranglerPath: './wrangler.toml' });
      expect(mutated).toContain('"wranglerPath":"./wrangler.toml"');
    });

    it('should correctly mutate DO methods using JSDoc fallbacks', async () => {
      const code = `/** @strata { "target": "do", "methods": ["getValue"] } */\nexport const Counter = {};`;
      let mutated = await addColumnToSchema(code, 'Counter', 'increment(by: number)', 'Promise<void>');
      expect(mutated).toContain('"methods":["getValue","increment"]');

      mutated = await renameColumnInSchema(mutated, 'Counter', 'increment', 'add');
      expect(mutated).toContain('"methods":["getValue","add"]');

      mutated = await removeColumnFromSchema(mutated, 'Counter', 'add');
      expect(mutated).toContain('"methods":["getValue"]');
    });

    it('should correctly mutate external DO class files directly', async () => {
      const schemaCode = `/** @strata { "target": "do", "path": "./Counter.ts", "class": "Counter" } */\nexport const Counter = {};`;
      const classContent = `export class Counter {\n  public async getCount(): Promise<number> {\n    return 0;\n  }\n}`;

      const readSpy = vi.spyOn(PlatformService, 'readText').mockResolvedValue(classContent);
      const writeSpy = vi.spyOn(PlatformService, 'writeText').mockResolvedValue(undefined);

      // Add a method
      let mutated = await addColumnToSchema(schemaCode, 'Counter', 'increment(by: number)', 'Promise<void>', undefined, undefined, '/projects/schema.ts');
      expect(readSpy).toHaveBeenCalledWith('/projects/Counter.ts');
      expect(writeSpy).toHaveBeenCalled();
      const writtenClass = writeSpy.mock.calls[0][1];
      expect(writtenClass).toContain('increment(by: number)');
      expect(writtenClass).toContain('Promise<void>');

      // Rename method
      writeSpy.mockClear();
      readSpy.mockResolvedValue(writtenClass);
      mutated = await renameColumnInSchema(mutated, 'Counter', 'increment(by: number)', 'add(by: number)', '/projects/schema.ts');
      expect(writeSpy).toHaveBeenCalled();
      const renamedClass = writeSpy.mock.calls[0][1];
      expect(renamedClass).toContain('add(by: number)');
      expect(renamedClass).not.toContain('increment');

      // Remove method
      writeSpy.mockClear();
      readSpy.mockResolvedValue(renamedClass);
      mutated = await removeColumnFromSchema(mutated, 'Counter', 'add(by: number)', '/projects/schema.ts');
      expect(writeSpy).toHaveBeenCalled();
      const removedClass = writeSpy.mock.calls[0][1];
      expect(removedClass).not.toContain('add');

      readSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });

  describe('KV Structured Schemas', () => {
    it('should correctly parse structured KV definitions from JSDoc', () => {
      const code = `
        /**
         * @strata { "target": "kv", "schema": { "config": { "type": "any", "ttl": 3600, "metadata": "config-tag" }, "version": "number" } }
         */
        export const kv = {};
      `;
      const result = parseSchema(code);
      expect(result.success).toBe(true);
      const kvNode = result.nodes.find(n => n.id === 'kv') as any;
      expect(kvNode).toBeDefined();
      const configCol = kvNode?.data.columns.find((c: any) => c.name === 'config');
      expect(configCol).toBeDefined();
      expect(configCol.definition).toBe('any');
      expect(configCol.ttl).toBe(3600);
      expect(configCol.metadata).toBe('config-tag');

      const versionCol = kvNode?.data.columns.find((c: any) => c.name === 'version');
      expect(versionCol).toBeDefined();
      expect(versionCol.definition).toBe('number');
      expect(versionCol.ttl).toBeUndefined();
    });

    it('should update TTL, metadata, and type of structured KV keys in JSDoc', () => {
      const code = `/** @strata { "target": "kv", "schema": { "key": "string" } } */\nexport const kv = {};`;

      // Update TTL
      let mutated = updateColumnModifiersInSchema(code, 'kv', 'key', { ttl: 86400 });
      expect(mutated).toContain('"ttl":86400');
      expect(mutated).toContain('"type":"string"');

      // Update Metadata
      mutated = updateColumnModifiersInSchema(mutated, 'kv', 'key', { metadata: 'my-tag' });
      expect(mutated).toContain('"metadata":"my-tag"');

      // Update Type
      mutated = updateColumnModifiersInSchema(mutated, 'kv', 'key', { defaultVal: 'number' });
      expect(mutated).toContain('"type":"number"');

      // Remove TTL and Metadata (should fall back to flat string type)
      mutated = updateColumnModifiersInSchema(mutated, 'kv', 'key', { ttl: null, metadata: null });
      expect(mutated).toContain('"key":"number"');
      expect(mutated).not.toContain('ttl');
      expect(mutated).not.toContain('metadata');
    });
  });

  describe('Synthetic Relationship Validation', () => {
    it('should generate warning when synthetic relations target missing nodes', () => {
      const code = `
        /** @strata { "target": "d1", "relations": [{ "to": "missing_kv" }] } */
        export const users = sqliteTable("users", {});
      `;
      const result = parseSchema(code);
      expect(result.success).toBe(true);
      expect(result.warnings || []).toHaveLength(1);
      expect((result.warnings || [])[0]).toContain('Synthetic relationship in "users" points to missing target "missing_kv"');
    });

    it('should not generate warnings if target exists', () => {
      const code = `
        /** @strata { "target": "d1", "relations": [{ "to": "my_kv" }] } */
        export const users = sqliteTable("users", {});
        
        /** @strata { "target": "kv", "schema": {} } */
        export const my_kv = {};
      `;
      const result = parseSchema(code);
      expect(result.success).toBe(true);
      expect(result.warnings || []).toHaveLength(0);
    });
  });

  describe('R2 Bucket Configurations', () => {
    it('should update JSDoc metadata for R2 bucket configurations', () => {
      const code = `/** @strata { "target": "r2", "folders": {} } */\nexport const images = {};`;
      
      // Update public and customDomain
      let mutated = updateTableMetadataInSchema(code, 'images', { public: true, customDomain: 'cdn.my-app.com' });
      expect(mutated).toContain('"public":true');
      expect(mutated).toContain('"customDomain":"cdn.my-app.com"');

      // Update CORS rules
      mutated = updateTableMetadataInSchema(mutated, 'images', { cors: true });
      expect(mutated).toContain('"cors":true');

      // Toggle public off
      mutated = updateTableMetadataInSchema(mutated, 'images', { public: false, customDomain: null });
      expect(mutated).not.toContain('public');
      expect(mutated).not.toContain('customDomain');
    });
  });
});
