import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSchema } from '../../src/lib/parser/core';
import {
  scaffoldBetterAuthClusterInSchema,
  scaffoldClerkMirrorTableInSchema,
  scaffoldWorkOSMirrorTableInSchema
} from '../../src/lib/parser/mutators';
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

  it('should scaffold complete Better Auth cluster in schema', () => {
    const initial = `import { sqliteTable, integer } from "drizzle-orm/sqlite-core";`;
    const updated = scaffoldBetterAuthClusterInSchema(initial);

    expect(updated).toContain('export const user = sqliteTable("user"');
    expect(updated).toContain('export const session = sqliteTable("session"');
    expect(updated).toContain('export const account = sqliteTable("account"');
    expect(updated).toContain('export const verification = sqliteTable("verification"');

    // Re-parsing should now detect the full Better Auth cluster
    const result = parseSchema(updated);
    expect(result.success).toBe(true);
    expect(result.nodes.filter(n => (n.data as any).isBetterAuth)).toHaveLength(4);
  });

  it('should scaffold Clerk webhook mirror table', () => {
    const initial = `import { sqliteTable } from "drizzle-orm/sqlite-core";`;
    const updated = scaffoldClerkMirrorTableInSchema(initial, 'users');

    expect(updated).toContain('export const users = sqliteTable("users"');
    expect(updated).toContain('clerkUserId: text("clerk_user_id").notNull().unique()');
  });

  it('should scaffold WorkOS SSO mirror table', () => {
    const initial = `import { sqliteTable } from "drizzle-orm/sqlite-core";`;
    const updated = scaffoldWorkOSMirrorTableInSchema(initial, 'workosUsers');

    expect(updated).toContain('export const workosUsers = sqliteTable("workosUsers"');
    expect(updated).toContain('workosUserId: text("workos_user_id").notNull().unique()');
    expect(updated).toContain('workosOrgId: text("workos_org_id")');
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

  it('should scaffold webhook mirror table directly through schemaState', async () => {
    const code = `
      import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        clerkUserId: text("clerk_user_id").notNull()
      });
    `;

    const writtenFiles: Record<string, string> = {};

    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') return writtenFiles['/project/schema.ts'] || code;
      if (cmd === 'write_schema_file') {
        writtenFiles[args.path] = args.content;
        return;
      }
      return '';
    });

    schemaState.filePath = '/project/schema.ts';
    await schemaState.syncWithFile();

    await schemaState.scaffoldWebhookMirror('clerk');

    expect(writtenFiles['/project/schema.ts']).toBeDefined();
    expect(writtenFiles['/project/schema.ts']).toContain('export const clerkUsers = sqliteTable("clerkUsers"');
    expect(schemaState.nodes.some(n => n.id === 'clerkUsers')).toBe(true);
  });
});
