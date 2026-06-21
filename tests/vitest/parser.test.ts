import { describe, it, expect } from 'vitest';
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
  wrapCode
} from '../../src/lib/parser';

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

  it('should add a column to an existing D1 table', () => {
    const code = `export const users = sqliteTable("users", { id: integer("id") });`;
    const newCode = addColumnToSchema(code, 'users', 'email', 'text');
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

  it('should rename a column and its database identifier', () => {
    const code = `export const users = sqliteTable("users", { name: text("name") });`;
    const newCode = renameColumnInSchema(code, 'users', 'name', 'fullName');
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

    it('should rename a column in a KV object', () => {
      const code = `export const sessions = { id: "string", user: "string" };`;
      const newCode = renameColumnInSchema(code, 'sessions', 'user', 'userId');
      expect(newCode).toContain('userId: "string"');
    });

    it('should add a column to a KV object', () => {
      const code = `export const sessions = { id: "string" };`;
      const newCode = addColumnToSchema(code, 'sessions', 'ttl', 'number');
      expect(newCode).toContain('ttl: "string"'); // Current implementation defaults to "string" for KV
    });

    it('should remove a column from a KV object', () => {
      const code = `export const sessions = { id: "string", trash: "any" };`;
      const newerCode = removeColumnFromSchema(code, 'sessions', 'trash');
      expect(newerCode).not.toContain('trash: "any"');
    });

    it('should remove a column from a D1 table', () => {
      const code = `export const users = sqliteTable("users", { id: integer("id"), bio: text("bio") });`;
      const newCode = removeColumnFromSchema(code, 'users', 'bio');
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

    it('should handle complex sqliteTable initializers (descendants check)', () => {
      const code = `export const users = someWrapper(sqliteTable("users", { id: integer("id") }));`;
      const result = renameColumnInSchema(code, 'users', 'id', 'newId');
      expect(result).toContain('newId: integer("newId")');
    });

    it('should handle source decl not being a table in addEdgeToSchema', () => {
      const code = `/** @strata {"target":"kv"} */\nexport const a = { id: "s" };\nexport const b = { id: "s" };`;
      // This should trigger the synthetic branch
      const newCode = addEdgeToSchema(code, 'a', 'b');
      expect(newCode).toContain('"relations":[{"to":"b"}]');
    });

    it('should add a column with references', () => {
      const code = `export const users = sqliteTable("users", { id: integer("id") }); export const posts = sqliteTable("posts", { id: integer("id") });`;
      const newCode = addColumnToSchema(code, 'posts', 'authorId', 'integer', 'users', 'id');
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
});
