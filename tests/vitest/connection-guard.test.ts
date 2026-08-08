import { describe, it, expect } from 'vitest';
import { addForeignKeyToColumnInSchema, parseSchema } from '$lib/parser';

describe('Connection Safety Guard', () => {
	it('should append .references() to an existing column definition without creating duplicates', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			
			export const users = sqliteTable("users", {
				id: integer("id").primaryKey(),
			});

			export const orders = sqliteTable("orders", {
				id: integer("id").primaryKey(),
				user_id: integer("user_id"),
			});
		`;

		const result = addForeignKeyToColumnInSchema(code, 'orders', 'user_id', 'users', 'id');
		expect(result).toContain('user_id: integer("user_id").references(() => users.id)');
		
		const parsed = parseSchema(result);
		expect(parsed.success).toBe(true);
		expect(parsed.edges.some(e => e.source === 'orders' && e.target === 'users')).toBe(true);
	});

	it('should create a new foreign key column with .references() when sourceCol does not exist', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			
			export const authors = sqliteTable("authors", {
				id: integer("id").primaryKey(),
			});

			export const books = sqliteTable("books", {
				id: integer("id").primaryKey(),
				title: text("title"),
			});
		`;

		const result = addForeignKeyToColumnInSchema(code, 'books', 'author_id', 'authors', 'id');
		expect(result).toContain('author_id: integer("author_id").references(() => authors.id)');
		
		const parsed = parseSchema(result);
		expect(parsed.success).toBe(true);
		expect((parsed.nodes.find(n => n.id === 'books')?.data as any)?.columns.some((c: any) => c.name === 'author_id')).toBe(true);
	});


	it('should support self-referencing foreign keys (e.g. parent_id in categories table)', () => {
		const code = `
			import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
			
			export const categories = sqliteTable("categories", {
				id: integer("id").primaryKey(),
				name: text("name"),
			});
		`;

		const result = addForeignKeyToColumnInSchema(code, 'categories', 'parent_id', 'categories', 'id');
		expect(result).toContain('parent_id: integer("parent_id").references(() => categories.id)');
		
		const parsed = parseSchema(result);
		expect(parsed.success).toBe(true);
	});
});
