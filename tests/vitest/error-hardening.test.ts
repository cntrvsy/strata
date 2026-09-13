import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizePlatformError, PlatformService } from '#lib/services/platform';
import { parseSchema } from '#lib/parser/core';
import { schemaState } from '#lib/state';

describe('Pre-Launch Edge Case & Error Hardening', () => {
	beforeEach(() => {
		schemaState.reset();
		vi.resetAllMocks();
	});

	describe('Platform IPC Error Normalization', () => {
		it('should normalize Rust FileNotFound error into actionable message with file path', () => {
			const rawErr = { type: 'FileNotFound', message: '/projects/schema.ts' };
			const normalized = normalizePlatformError(rawErr, '/projects/schema.ts');

			expect(normalized.kind).toBe('file_not_found');
			expect(normalized.message).toContain('Could not find schema file "schema.ts"');
			expect(normalized.message).not.toContain('[object Object]');
		});

		it('should normalize legacy untagged FileNotFound object correctly', () => {
			const rawErr = { FileNotFound: '/projects/schema/index.ts' };
			const normalized = normalizePlatformError(rawErr);

			expect(normalized.kind).toBe('file_not_found');
			expect(normalized.message).toContain('Could not find schema file "index.ts"');
		});

		it('should identify permission denied I/O errors and provide actionable permissions guidance', () => {
			const rawErr = { type: 'Io', message: 'Permission denied (os error 13)' };
			const normalized = normalizePlatformError(rawErr, '/repo/schema.ts');

			expect(normalized.kind).toBe('permission_denied');
			expect(normalized.message).toContain('Permission denied accessing "schema.ts"');
			expect(normalized.message).toContain('write-protected');
		});

		it('should identify file locked errors and advise closing conflicting processes', () => {
			const rawErr = { Io: 'The process cannot access the file because it is being used by another process' };
			const normalized = normalizePlatformError(rawErr, 'C:/repo/schema.ts');

			expect(normalized.kind).toBe('file_locked');
			expect(normalized.message).toContain('locked by another process or editor');
		});

		it('should handle wrangler config mutation errors gracefully', () => {
			const rawErr = { type: 'WranglerConfig', message: 'Syntax error in wrangler.toml line 14' };
			const normalized = normalizePlatformError(rawErr, '/repo/wrangler.toml');

			expect(normalized.kind).toBe('wrangler_config');
			expect(normalized.message).toContain('Wrangler config update failed');
			expect(normalized.message).toContain('Syntax error in wrangler.toml line 14');
		});

		it('should never produce "[object Object]" for arbitrary unknown error objects', () => {
			const rawErr = { unexpectedCode: 500, detail: 'network timeout' };
			const normalized = normalizePlatformError(rawErr, '/repo/schema.ts');

			expect(normalized.message).not.toBe('[object Object]');
			expect(normalized.message).toContain('unexpected');
		});
	});

	describe('Parser Diagnostics & Actionable Guidance', () => {
		it('should emit MISSING_FOREIGN_KEY_TARGET audit issue when physical FK points to missing table', () => {
			const code = `
				import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

				export const orders = sqliteTable("orders", {
					id: integer("id").primaryKey(),
					user_id: integer("user_id").references(() => non_existent_users.id),
				});
			`;

			const result = parseSchema(code);
			expect(result.success).toBe(true);
			expect(result.edges).toHaveLength(0); // Edge dropped safely
			expect(result.auditIssues).toBeDefined();

			const issue = result.auditIssues?.find(i => i.code === 'MISSING_FOREIGN_KEY_TARGET');
			expect(issue).toBeDefined();
			expect(issue?.symbolName).toBe('orders');
			expect(issue?.message).toContain('orders.user_id');
			expect(issue?.message).toContain('non_existent_users');
			expect(issue?.message).toContain('Ensure "non_existent_users" is defined, exported, or imported');
		});

		it('should emit INVALID_TARGET audit issue with supported targets list on invalid JSDoc target', () => {
			const code = `
				import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

				/**
				 * @strata { "target": "redis", "x": 100, "y": 100 }
				 */
				export const cache = sqliteTable("cache", {
					id: integer("id").primaryKey(),
				});
			`;

			const result = parseSchema(code);
			expect(result.success).toBe(true);
			const invalidTargetIssue = result.auditIssues?.find(i => i.code === 'INVALID_TARGET');
			expect(invalidTargetIssue).toBeDefined();
			expect(invalidTargetIssue?.message).toContain('Unrecognized storage target "redis"');
			expect(invalidTargetIssue?.message).toContain("'d1', 'kv', 'do', 'r2'");
		});

		it('should emit MALFORMED_LAYOUT_MANIFEST audit issue when root @strata-layout has invalid JSON', () => {
			const code = `
				/**
				 * @strata-layout {
				 *   "users": { "x": 100, "y": 
				 * }
				 */
				import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
				export const users = sqliteTable("users", { id: integer("id").primaryKey() });
			`;

			const result = parseSchema(code);
			expect(result.success).toBe(true);
			const layoutIssue = result.auditIssues?.find(i => i.code === 'MALFORMED_LAYOUT_MANIFEST');
			expect(layoutIssue).toBeDefined();
			expect(layoutIssue?.message).toContain('Malformed @strata-layout JSON manifest');
		});

		it('should emit D1_TYPE_COMPATIBILITY warning when columns use raw timestamp() without SQLite mode', () => {
			const code = `
				import { sqliteTable, integer, timestamp } from "drizzle-orm/sqlite-core";

				export const events = sqliteTable("events", {
					id: integer("id").primaryKey(),
					created_at: timestamp("created_at"),
				});
			`;

			const result = parseSchema(code);
			expect(result.success).toBe(true);
			const typeIssue = result.auditIssues?.find(i => i.code === 'D1_TYPE_COMPATIBILITY');
			expect(typeIssue).toBeDefined();
			expect(typeIssue?.message).toContain('Cloudflare D1 lacks native Date');
			expect(typeIssue?.message).toContain('mode: "timestamp"');
		});

		it('should emit D1_TYPE_COMPATIBILITY warning when columns use raw boolean() without SQLite mode', () => {
			const code = `
				import { sqliteTable, integer, boolean } from "drizzle-orm/sqlite-core";

				export const flags = sqliteTable("flags", {
					id: integer("id").primaryKey(),
					is_active: boolean("is_active"),
				});
			`;

			const result = parseSchema(code);
			expect(result.success).toBe(true);
			const typeIssue = result.auditIssues?.find(i => i.code === 'D1_TYPE_COMPATIBILITY');
			expect(typeIssue).toBeDefined();
			expect(typeIssue?.message).toContain('Cloudflare D1 lacks native Boolean');
			expect(typeIssue?.message).toContain('mode: "boolean"');
		});

		it('should provide clear, instructive error message when opening an empty or non-Drizzle file', () => {
			const emptyCode = `
				export const config = { port: 8080 };
			`;

			const result = parseSchema(emptyCode, undefined, undefined, undefined, '/projects/config.ts');
			expect(result.success).toBe(false);
			expect(result.error).toContain('No Drizzle tables or Cloudflare entities found in "config.ts"');
			expect(result.error).toContain('Expected sqliteTable() declarations or barrel re-exports');
		});
	});

	describe('Store Mutation Error Classification', () => {
		it('should classify AST mutation failures without false disk alarms', async () => {
			schemaState.isSandboxMode = true;
			schemaState.nodes = [
				{
					id: 'users',
					type: 'table',
					data: {
						label: 'users',
						columns: [{ name: 'id', definition: 'integer("id").primaryKey()', isPk: true }],
						target: 'd1'
					},
					position: { x: 0, y: 0 }
				}
			];

			// Attempting to add a column that triggers a duplicate warning
			await schemaState.addColumn('users', 'id', 'text');
			// Verified duplicate was prevented without crashing
			expect((schemaState.nodes[0].data as any).columns).toHaveLength(1);
		});
	});
});
