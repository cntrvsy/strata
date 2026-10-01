import { describe, it, expect } from 'vitest';
import { addTableToSchema, addColumnToSchema, sanitizeIdentifier, generateD1TableColumns, createD1ModuleCode } from '#lib/parser/mutators';
import { parseSchema } from '#lib/parser';

describe('Entity Creation & Identifier Safeguards', () => {
	it('should sanitize invalid JS identifiers (spaces, hyphens, leading numbers)', () => {
		expect(sanitizeIdentifier('user-data')).toBe('user_data');
		expect(sanitizeIdentifier('user data')).toBe('user_data');
		expect(sanitizeIdentifier('2026_data')).toBe('entity_2026_data');
		expect(sanitizeIdentifier('  orders  ')).toBe('orders');
		expect(sanitizeIdentifier('special@#$name')).toBe('special___name');
		expect(sanitizeIdentifier('')).toBe('entity');
	});

	it('should generate table columns based on architectural presets', () => {
		// Default / autoIncrement
		const autoInc = generateD1TableColumns('posts', { primaryKey: 'autoIncrement' });
		expect(autoInc.code).toContain('id: integer("id").primaryKey({ autoIncrement: true }),');

		// UUID
		const uuid = generateD1TableColumns('sessions', { primaryKey: 'uuid' });
		expect(uuid.code).toContain('id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),');

		// Timestamps
		const withTs = generateD1TableColumns('audit_logs', { timestamps: true });
		expect(withTs.code).toContain('createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),');
		expect(withTs.code).toContain('updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),');

		// Soft Delete
		const withSoftDel = generateD1TableColumns('accounts', { softDelete: true });
		expect(withSoftDel.code).toContain('deletedAt: integer("deleted_at", { mode: "timestamp" }),');
	});

	it('should scaffold a table with presets in schema code', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
		`;

		const result = addTableToSchema(code, 'orders', 'd1', {
			presets: {
				primaryKey: 'uuid',
				timestamps: true,
				softDelete: true
			}
		});

		expect(result).toContain('export const orders = sqliteTable("orders", {');
		expect(result).toContain('id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),');
		expect(result).toContain('createdAt: integer("created_at", { mode: "timestamp" })');
		expect(result).toContain('deletedAt: integer("deleted_at", { mode: "timestamp" })');

		const parsed = parseSchema(result);
		expect(parsed.success).toBe(true);
		expect(parsed.nodes).toHaveLength(1);
	});

	it('should reject duplicate column additions safely in addColumnToSchema', async () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			export const users = sqliteTable("users", {
				id: integer("id").primaryKey(),
				email: text("email"),
			});
		`;

		// Adding email again should return unchanged code and not corrupt AST
		const updated = await addColumnToSchema(code, 'users', 'email', 'text');
		expect(updated).toBe(code);
	});

	it('should auto-suffix duplicate variable declarations to prevent AST collisions', () => {
		const code = `
			import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
			export const users = sqliteTable("users", {
				id: integer("id").primaryKey(),
			});
		`;

		const result = addTableToSchema(code, 'users', 'd1');
		expect(result).toContain('export const users_2 = sqliteTable("users_2"');

		const parsed = parseSchema(result);
		expect(parsed.success).toBe(true);
		expect(parsed.nodes).toHaveLength(2);
		expect(parsed.nodes.some(n => n.id === 'users')).toBe(true);
		expect(parsed.nodes.some(n => n.id === 'users_2')).toBe(true);
	});

	it('should handle multi-level name collisions (users, users_2 -> users_3)', () => {
		const code = `
			import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
			export const users = sqliteTable("users", { id: integer("id").primaryKey() });
			export const users_2 = sqliteTable("users_2", { id: integer("id").primaryKey() });
		`;

		const result = addTableToSchema(code, 'users', 'd1');
		expect(result).toContain('export const users_3 = sqliteTable("users_3"');

		const parsed = parseSchema(result);
		expect(parsed.success).toBe(true);
		expect(parsed.nodes).toHaveLength(3);
		expect(parsed.nodes.some(n => n.id === 'users_3')).toBe(true);
	});
});
