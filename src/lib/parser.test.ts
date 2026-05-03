import { describe, it, expect } from 'vitest';
import { parseSchema, updateNodePositionInSchema, addEdgeToSchema, addColumnToSchema, removeTableFromSchema, renameTableInSchema, renameColumnInSchema } from './parser';

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
});

describe('Mutation Logic', () => {
  it('should update node position without breaking code', () => {
    const code = `/** @strata {"x":0,"y":0} */\nexport const t = sqliteTable("t", { id: integer("id") });`;
    const newCode = updateNodePositionInSchema(code, 't', 150, 250);
    expect(newCode).toContain('"x":150,"y":250');
    expect(newCode).toContain('export const t = sqliteTable');
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
});
