/**
 * schemas.ts
 *
 * Summary: Validation schemas for user input across D1, DO, KV, and R2 primitives.
 * Expects: User configurations from forms (names, types, presets, paths).
 * Output: Valibot validation results & slugification helpers.
 */
import * as v from "valibot";

/**
 * JavaScript & TypeScript reserved keywords that cannot be used as variable identifiers.
 */
export const JS_RESERVED_WORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "export", "extends", "finally", "for", "function",
  "if", "import", "in", "instanceof", "new", "return", "super", "switch",
  "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield",
  "let", "static", "enum", "await", "implements", "package", "protected",
  "interface", "private", "public", "null", "true", "false", "NaN", "undefined"
]);

/**
 * Checks if a string identifier matches any reserved JS/TS keyword.
 */
export function isJsReservedKeyword(name: string): boolean {
  return JS_RESERVED_WORDS.has(name.trim().toLowerCase());
}

/**
 * Intelligently transforms arbitrary human input into a valid identifier.
 */
export function slugifyIdentifier(
  input: string,
  mode: "snake" | "pascal" | "screaming_snake" = "snake"
): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Split by non-alphanumeric characters, keeping camelCase boundaries
  const words = trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return "";

  if (mode === "snake") {
    let res = words.map((w) => w.toLowerCase()).join("_");
    if (/^[0-9]/.test(res)) res = `t_${res}`;
    if (isJsReservedKeyword(res)) res = `${res}_tbl`;
    return res;
  }

  if (mode === "screaming_snake") {
    let res = words.map((w) => w.toUpperCase()).join("_");
    if (/^[0-9]/.test(res)) res = `B_${res}`;
    return res;
  }

  if (mode === "pascal") {
    let res = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    if (/^[0-9]/.test(res)) res = `Class_${res}`;
    if (isJsReservedKeyword(res)) res = `${res}Service`;
    return res;
  }

  return trimmed;
}

// -----------------------------------------------------------------------------
// D1 Schemas
// -----------------------------------------------------------------------------

export const d1TableSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Table name is required"),
    v.regex(/^[a-z_][a-z0-9_]*$/, "Use snake_case (lowercase, numbers, underscores)"),
    v.check((val) => !isJsReservedKeyword(val), "Cannot use a reserved JavaScript keyword")
  ),
  primaryKey: v.optional(v.picklist(["int_autoincrement", "uuid"]), "int_autoincrement"),
  timestamps: v.optional(v.boolean(), true),
  softDelete: v.optional(v.boolean(), false),
  destMode: v.optional(v.picklist(["root", "new", "existing"]), "root"),
  customFileName: v.optional(v.string()),
  selectedExistingModule: v.optional(v.string()),
});

export const d1ColumnSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Column name is required"),
    v.regex(/^[a-z_][a-z0-9_]*$/, "Use snake_case (lowercase, numbers, underscores)"),
    v.check((val) => !isJsReservedKeyword(val), "Cannot use a reserved JavaScript keyword")
  ),
  type: v.optional(
    v.picklist(["text", "integer", "timestamp", "boolean_int", "blob", "real"]),
    "text"
  ),
  isPk: v.optional(v.boolean(), false),
  notNull: v.optional(v.boolean(), true),
  referencesTable: v.optional(v.string()),
  referencesColumn: v.optional(v.string()),
});

// -----------------------------------------------------------------------------
// Durable Object Schemas
// -----------------------------------------------------------------------------

export const doBindingSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Binding variable name is required"),
    v.regex(/^[a-zA-Z0-9_]+$/, "Binding name must be alphanumeric"),
    v.check((val) => !isJsReservedKeyword(val), "Cannot use a reserved JavaScript keyword")
  ),
  className: v.pipe(
    v.string(),
    v.minLength(1, "Class name is required"),
    v.regex(/^[A-Z][a-zA-Z0-9_]*$/, "Class name must start with an uppercase letter (PascalCase)"),
    v.check((val) => !isJsReservedKeyword(val), "Cannot use a reserved JavaScript keyword")
  ),
  classPath: v.pipe(
    v.string(),
    v.minLength(1, "TypeScript file path is required")
  ),
});

export const doMethodSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Method signature is required")
  ),
  returnType: v.optional(
    v.picklist(["Promise<void>", "Promise<string>", "Promise<number>", "Promise<boolean>", "Promise<any>"]),
    "Promise<any>"
  ),
});

// -----------------------------------------------------------------------------
// KV Schemas
// -----------------------------------------------------------------------------

export const kvBindingSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Binding name is required"),
    v.regex(/^[a-zA-Z0-9_]+$/, "Binding name must be alphanumeric"),
    v.check((val) => !isJsReservedKeyword(val), "Cannot use a reserved JavaScript keyword")
  ),
  id: v.optional(v.string()),
});

export const kvKeySchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Key name or prefix is required")
  ),
  type: v.optional(
    v.picklist(["string", "number", "boolean", "any"]),
    "string"
  ),
});

// -----------------------------------------------------------------------------
// R2 Schemas
// -----------------------------------------------------------------------------

export const r2BindingSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Binding name is required"),
    v.regex(/^[a-zA-Z0-9_]+$/, "Binding name must be alphanumeric"),
    v.check((val) => !isJsReservedKeyword(val), "Cannot use a reserved JavaScript keyword")
  ),
  bucketName: v.optional(v.string()),
});

export const r2FolderSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Folder path / prefix is required")
  ),
  type: v.optional(v.string(), ""),
});

// -----------------------------------------------------------------------------
// Relationship Schema
// -----------------------------------------------------------------------------

export const relationSchema = v.object({
  source: v.pipe(v.string(), v.minLength(1, "Source table is required")),
  target: v.pipe(v.string(), v.minLength(1, "Target table is required")),
});

// -----------------------------------------------------------------------------
// Compatibility Aliases (supporting existing code & tests)
// -----------------------------------------------------------------------------

export const tableSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Table name is required"),
    v.regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, underscores")
  ),
  target: v.optional(v.picklist(["d1", "do", "kv", "r2"]), "d1"),
});

export const columnSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Column name is required")
  ),
  type: v.optional(
    v.picklist([
      "text", "integer", "timestamp", "boolean_int", "blob", "real",
      "string", "number", "boolean", "any",
      "Promise<void>", "Promise<string>", "Promise<number>", "Promise<boolean>", "Promise<any>"
    ]),
    "text"
  ),
  isPk: v.optional(v.boolean(), false),
  notNull: v.optional(v.boolean(), true),
  referencesTable: v.optional(v.string()),
  referencesColumn: v.optional(v.string()),
});

export type D1TableSchema = typeof d1TableSchema;
export type D1ColumnSchema = typeof d1ColumnSchema;
export type DOBindingSchema = typeof doBindingSchema;
export type DOMethodSchema = typeof doMethodSchema;
export type KVBindingSchema = typeof kvBindingSchema;
export type KVKeySchema = typeof kvKeySchema;
export type R2BindingSchema = typeof r2BindingSchema;
export type R2FolderSchema = typeof r2FolderSchema;
export type RelationSchema = typeof relationSchema;
export type TableSchema = typeof tableSchema;
export type ColumnSchema = typeof columnSchema;

