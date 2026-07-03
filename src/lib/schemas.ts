/**
 * schemas.ts
 *
 * Summary: Validation schemas for user input (table and column creation).
 * Expects: User configurations from forms (names, types).
 * Output: Valibot validation results.
 */
import * as v from "valibot";

/**
 * Validation schema for forging a new table or entity.
 */
export const tableSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Table name is required"),
    v.regex(/^[a-z_][a-z0-9_]*$/, "Use snake_case (lowercase, numbers, underscores)")
  ),
  target: v.optional(v.picklist(["d1", "do", "kv", "r2"]), "d1"),
});

/**
 * Validation schema for forging a new column or field.
 */
export const columnSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Column name is required"),
    v.regex(/^[a-z_][a-z0-9_]*$/, "Use snake_case")
  ),
  type: v.optional(v.picklist(["text", "integer", "blob", "real", "string", "number", "boolean", "any"]), "text"),
  isPk: v.optional(v.boolean(), false),
  notNull: v.optional(v.boolean(), true),
  referencesTable: v.optional(v.string()),
  referencesColumn: v.optional(v.string()),
});

/**
 * Validation schema for forging a new relationship (edge).
 */
export const relationSchema = v.object({
  source: v.pipe(v.string(), v.minLength(1, "Source table is required")),
  target: v.pipe(v.string(), v.minLength(1, "Target table is required")),
});

export type TableSchema = typeof tableSchema;
export type ColumnSchema = typeof columnSchema;
export type RelationSchema = typeof relationSchema;
