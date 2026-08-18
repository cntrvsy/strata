import { describe, it, expect } from 'vitest';
import { addTableToSchema, sanitizeIdentifier } from '$lib/parser/mutators';
import { parseSchema } from '$lib/parser';

describe('Entity Creation & Identifier Safeguards', () => {
	it('should sanitize invalid JS identifiers (spaces, hyphens, leading numbers)', () => {
		expect(sanitizeIdentifier('user-data')).toBe('user_data');
		expect(sanitizeIdentifier('user data')).toBe('user_data');
		expect(sanitizeIdentifier('2026_data')).toBe('entity_2026_data');
		expect(sanitizeIdentifier('  orders  ')).toBe('orders');
		expect(sanitizeIdentifier('special@#$name')).toBe('special___name');
		expect(sanitizeIdentifier('')).toBe('entity');
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
