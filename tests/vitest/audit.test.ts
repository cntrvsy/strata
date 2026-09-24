import { describe, it, expect } from 'vitest';
import { extractStrataMetadata } from '#lib/parser/helpers';
import { parseSchema } from '#lib/parser/core';

describe('JSDoc Audit & Fault-Tolerant Engine', () => {
	it('should auto-repair single quotes and trailing commas in @strata JSON', () => {
		const text = `
			/** 
			 * @strata { 'target': 'kv', 'x': 100, 'y': 200, } 
			 */
		`;
		const result = extractStrataMetadata(text);
		expect(result).not.toBeNull();
		expect(result?.data).toEqual({ target: 'kv', x: 100, y: 200 });
		expect(result?.issue).toBeDefined();
		expect(result?.issue?.code).toBe('JSDOC_SYNTAX_ERROR');
	});

	it('should emit a JSDOC_SYNTAX_ERROR audit issue on unclosed or broken JSON without dropping the node', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			
			/** 
			 * @strata { "target": "d1", "x": 100, 
			 */
			export const users = sqliteTable("users", {
				id: integer("id").primaryKey(),
			});
		`;
		const result = parseSchema(code);
		expect(result.success).toBe(true);
		expect(result.nodes).toHaveLength(1);
		expect(result.nodes[0].id).toBe('users');
		expect(result.auditIssues).toBeDefined();
		expect(result.auditIssues?.some(i => i.code === 'JSDOC_SYNTAX_ERROR')).toBe(true);
	});

	it('should emit DANGLING_RELATION audit issue when synthetic relation points to missing target', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			
			/** 
			 * @strata { "target": "d1", "x": 100, "y": 100, "relations": [{ "to": "ghost_table" }] } 
			 */
			export const orders = sqliteTable("orders", {
				id: integer("id").primaryKey(),
			});
		`;
		const result = parseSchema(code);
		expect(result.success).toBe(true);
		expect(result.auditIssues).toBeDefined();
		const danglingIssue = result.auditIssues?.find(i => i.code === 'DANGLING_RELATION');
		expect(danglingIssue).toBeDefined();
		expect(danglingIssue?.symbolName).toBe('orders');
		expect(danglingIssue?.severity).toBe('warning');
	});

	it('should produce 0 audit issues for valid JSDoc schemas', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			
			/** 
			 * @strata { "target": "d1", "x": 100, "y": 200 } 
			 */
			export const users = sqliteTable("users", {
				id: integer("id").primaryKey(),
			});
		`;
		const result = parseSchema(code);
		expect(result.success).toBe(true);
		expect(result.auditIssues).toHaveLength(0);
	});

	it('should auto-repair unquoted object keys in @strata JSDoc leniently', () => {
		const text = `
			/** 
			 * @strata { target: 'd1', x: 150, y: 250, relations: [{ to: 'products' }] } 
			 */
		`;
		const result = extractStrataMetadata(text);
		expect(result).not.toBeNull();
		expect(result?.data).toEqual({
			target: 'd1',
			x: 150,
			y: 250,
			relations: [{ to: 'products' }]
		});
		expect(result?.issue?.code).toBe('JSDOC_SYNTAX_ERROR');
	});

	it('should handle non-numeric x/y coordinates in @strata JSDoc gracefully', () => {
		const text = `
			/** 
			 * @strata { "target": "d1", "x": "invalid_num", "y": null } 
			 */
		`;
		const result = extractStrataMetadata(text);
		expect(result).not.toBeNull();
	});

	it('should emit D1_TYPE_COMPATIBILITY audit issue for timestamp() and boolean() columns lacking SQLite mode', () => {
		const code = `
			import { sqliteTable, integer, text, timestamp, boolean } from "drizzle-orm/sqlite-core";

			export const users = sqliteTable("users", {
				id: integer("id").primaryKey(),
				createdAt: timestamp("created_at").notNull(),
				isActive: boolean("is_active").default(true),
			});
		`;
		const result = parseSchema(code);
		expect(result.success).toBe(true);
		expect(result.auditIssues).toBeDefined();
		const typeIssues = result.auditIssues?.filter(i => i.code === 'D1_TYPE_COMPATIBILITY');
		expect(typeIssues).toHaveLength(2);

		const tsIssue = typeIssues?.find(i => i.id.includes('timestamp'));
		expect(tsIssue).toBeDefined();
		expect(tsIssue?.suggestedFix?.action).toBe('fix_d1_type');
		expect(tsIssue?.suggestedFix?.payload).toEqual({
			columnName: 'createdAt',
			targetMode: 'timestamp',
		});

		const boolIssue = typeIssues?.find(i => i.id.includes('boolean'));
		expect(boolIssue).toBeDefined();
		expect(boolIssue?.suggestedFix?.action).toBe('fix_d1_type');
		expect(boolIssue?.suggestedFix?.payload).toEqual({
			columnName: 'isActive',
			targetMode: 'boolean',
		});
	});

	it('should fix D1 column types using fixD1ColumnTypeInSchema', async () => {
		const { fixD1ColumnTypeInSchema } = await import('#lib/parser');
		const code = `import { sqliteTable, integer, text, timestamp, boolean } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey(),
	createdAt: timestamp("created_at").notNull(),
	isActive: boolean("is_active").default(true),
});
`;
		// Fix createdAt -> timestamp mode
		let fixed = fixD1ColumnTypeInSchema(code, 'users', 'createdAt', 'timestamp');
		expect(fixed).toContain('integer("created_at", { mode: "timestamp" }).notNull()');
		expect(fixed).not.toContain('timestamp("created_at")');

		// Fix isActive -> boolean mode
		fixed = fixD1ColumnTypeInSchema(fixed, 'users', 'isActive', 'boolean');
		expect(fixed).toContain('integer("is_active", { mode: "boolean" }).default(true)');
		expect(fixed).not.toContain('boolean("is_active")');
	});
});
