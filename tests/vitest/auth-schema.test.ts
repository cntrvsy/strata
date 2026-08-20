import { describe, it, expect } from 'vitest';
import { parseSchema } from '#lib/parser';

describe('Auth Schema & Multi-Dialect Discovery', () => {
  it('should find imported user and session tables from relative external files', () => {
    const mainCode = `
      import { user, session } from "./auth-schema";
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        authorId: text("author_id").references(() => user.id)
      });
    `;

    const authContent = `
      import { sqliteTable, text } from "drizzle-orm/sqlite-core";
      export const user = sqliteTable("user", {
        id: text("id").primaryKey(),
        name: text("name")
      });
      export const session = sqliteTable("session", {
        id: text("id").primaryKey(),
        userId: text("user_id").references(() => user.id)
      });
    `;

    const externalFiles = new Map<string, string>([
      ['./auth-schema', authContent]
    ]);

    const result = parseSchema(mainCode, externalFiles);
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(3);

    const userNode = result.nodes.find(n => n.id === 'user');
    expect(userNode).toBeDefined();
    expect(userNode?.data.isExternal).toBe(true);

    const sessionNode = result.nodes.find(n => n.id === 'session');
    expect(sessionNode).toBeDefined();
    expect(sessionNode?.data.isExternal).toBe(true);
  });

  it('should detect tables created with pgTable or mysqlTable dialects', () => {
    const pgCode = `
      import { pgTable, serial, text } from "drizzle-orm/pg-core";
      export const userProfile = pgTable("user_profile", {
        id: serial("id").primaryKey(),
        bio: text("bio")
      });
    `;

    const result = parseSchema(pgCode);
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('userProfile');
  });

  it('should resolve import aliases (import { user as customUser })', () => {
    const mainCode = `
      import { user as authUser } from "./auth";
      export const comments = sqliteTable("comments", {
        id: integer("id").primaryKey()
      });
    `;

    const authContent = `
      import { sqliteTable, text } from "drizzle-orm/sqlite-core";
      export const authUser = sqliteTable("user", {
        id: text("id").primaryKey()
      });
    `;

    const externalFiles = new Map<string, string>([
      ['./auth', authContent]
    ]);

    const result = parseSchema(mainCode, externalFiles);
    expect(result.success).toBe(true);
    const authNode = result.nodes.find(n => n.id === 'authUser');
    expect(authNode).toBeDefined();
  });

  it('should handle missing external files gracefully without crashing', () => {
    const mainCode = `
      import { user } from "./missing-schema";
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey()
      });
    `;

    const externalFiles = new Map<string, string>();
    const result = parseSchema(mainCode, externalFiles);
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('posts');
  });

  it('should handle circular external imports without infinite loops', () => {
    const mainCode = `
      import { tableA } from "./fileA";
      import { tableB } from "./fileB";
    `;

    const fileA = `
      import { tableB } from "./fileB";
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      export const tableA = sqliteTable("table_a", { id: integer("id").primaryKey() });
    `;

    const fileB = `
      import { tableA } from "./fileA";
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
      export const tableB = sqliteTable("table_b", { id: integer("id").primaryKey() });
    `;

    const externalFiles = new Map<string, string>([
      ['./fileA', fileA],
      ['./fileB', fileB]
    ]);

    const result = parseSchema(mainCode, externalFiles);
    expect(result.success).toBe(true);
    expect(result.nodes.some(n => n.id === 'tableA')).toBe(true);
    expect(result.nodes.some(n => n.id === 'tableB')).toBe(true);
  });
});
