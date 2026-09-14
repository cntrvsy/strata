import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSchema } from '../../src/lib/parser/core';
import { schemaState } from '../../src/lib/state';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: vi.fn()
}));

describe('Modern Identity Integration (Phase 4: Better Auth, Clerk, WorkOS)', () => {
  beforeEach(() => {
    schemaState.reset();
    vi.clearAllMocks();
  });
  it('should detect Better Auth cluster, mark core auth columns and custom fields', () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const user = sqliteTable("user", {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        email: text("email").notNull().unique(),
        emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
        image: text("image"),
        role: text("role"), // custom field!
        stripeCustomerId: text("stripe_customer_id"), // custom field!
        createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
      });

      export const session = sqliteTable("session", {
        id: text("id").primaryKey(),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        token: text("token").notNull().unique(),
        createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id").notNull().references(() => user.id)
      });
    `;

    const result = parseSchema(code);
    expect(result.success).toBe(true);

    const userNode = result.nodes.find(n => n.id === 'user');
    const sessionNode = result.nodes.find(n => n.id === 'session');

    expect(userNode).toBeDefined();
    expect(sessionNode).toBeDefined();

    expect((userNode?.data as any).isBetterAuth).toBe(true);
    expect((sessionNode?.data as any).isBetterAuth).toBe(true);

    const userCols = (userNode?.data as any).columns;
    const roleCol = userCols.find((c: any) => c.name === 'role');
    const emailVerifiedCol = userCols.find((c: any) => c.name === 'emailVerified');

    expect(roleCol?.isCustomField).toBe(true);
    expect(emailVerifiedCol?.isAuthCore).toBe(true);
  });

  it('should detect Clerk foreign key columns and create virtual IdentityNode with boundary edge', () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        title: text("title"),
        clerkUserId: text("clerk_user_id").notNull()
      });
    `;

    const result = parseSchema(code);
    expect(result.success).toBe(true);

    // Verify virtual identity node was created
    const identityNode = result.nodes.find(n => n.type === 'identity');
    expect(identityNode).toBeDefined();
    expect((identityNode?.data as any).provider).toBe('clerk');

    // Verify boundary edge connects __clerk_identity__ -> posts
    const boundaryEdge = result.edges.find(e => (e.data as any)?.isIdentityBoundary && e.target === 'posts');
    expect(boundaryEdge).toBeDefined();
    expect((boundaryEdge?.data as any)?.provider).toBe('clerk');
    expect((boundaryEdge?.data as any)?.targetCol).toBe('clerkUserId');
  });

  it('should detect WorkOS SSO columns and create virtual IdentityNode with boundary edge', () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const organizations = sqliteTable("organizations", {
        id: text("id").primaryKey(),
        name: text("name"),
        workosOrgId: text("workos_org_id").notNull()
      });
    `;

    const result = parseSchema(code);
    expect(result.success).toBe(true);

    const identityNode = result.nodes.find(n => n.type === 'identity');
    expect(identityNode).toBeDefined();
    expect((identityNode?.data as any).provider).toBe('workos');

    const boundaryEdge = result.edges.find(e => (e.data as any)?.isIdentityBoundary && e.target === 'organizations');
    expect(boundaryEdge).toBeDefined();
    expect((boundaryEdge?.data as any)?.provider).toBe('workos');
  });

  it('should parse complete Better Auth cluster schema cleanly', () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const user = sqliteTable("user", {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        email: text("email").notNull().unique(),
        emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
        image: text("image"),
        createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
      });

      export const session = sqliteTable("session", {
        id: text("id").primaryKey(),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        token: text("token").notNull().unique(),
        createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id").notNull().references(() => user.id)
      });

      export const account = sqliteTable("account", {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id").notNull().references(() => user.id),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
        refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
        scope: text("scope"),
        password: text("password"),
        createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
      });

      export const verification = sqliteTable("verification", {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
        createdAt: integer("created_at", { mode: "timestamp" }),
        updatedAt: integer("updated_at", { mode: "timestamp" })
      });
    `;

    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect(result.nodes.filter(n => (n.data as any).isBetterAuth)).toHaveLength(4);
  });

  it('should parse Clerk and WorkOS mirror schemas cleanly', () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const users = sqliteTable("users", {
        id: integer("id").primaryKey(),
        clerkUserId: text("clerk_user_id").notNull().unique()
      });

      export const workosUsers = sqliteTable("workosUsers", {
        id: text("id").primaryKey(),
        workosUserId: text("workos_user_id").notNull().unique(),
        workosOrgId: text("workos_org_id")
      });
    `;

    const result = parseSchema(code);
    expect(result.success).toBe(true);
    expect(result.nodes.some(n => (n.data as any).provider === 'clerk')).toBe(true);
    expect(result.nodes.some(n => (n.data as any).provider === 'workos')).toBe(true);
  });

  it('should support selecting virtual IdentityNode in schemaState.activeInspectorNodeId', async () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        clerkUserId: text("clerk_user_id").notNull()
      });
    `;

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') return code;
      return '';
    });

    schemaState.filePath = '/project/schema.ts';
    await schemaState.syncWithFile();

    const clerkNode = schemaState.nodes.find(n => n.type === 'identity');
    expect(clerkNode).toBeDefined();

    schemaState.activeInspectorNodeId = clerkNode!.id;
    expect(schemaState.activeInspectorNodeId).toBe('__clerk_identity__');
    expect(schemaState.selectedNode?.type).toBe('identity');
    expect((schemaState.selectedNode?.data as any).provider).toBe('clerk');
  });
});
