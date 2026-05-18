# Strata AI Assistant Instructions

This document provides instructions for AI models (ChatGPT, Claude, etc.) to help developers work with **Strata** schemas.

## 🏗️ The "@strata" Standard

Strata uses JSDoc comments to store visual metadata directly in the `schema.ts` file. This avoids sidecar JSON files and keeps the code as the single source of truth.

### Metadata Schema

When generating or modifying a table, KV, or Durable Object, you **MUST** include a JSDoc block in the following format:

```typescript
/**
 * @strata { "target": "d1" | "kv" | "do", "x": number, "y": number }
 */
export const myTable = sqliteTable(...);
```

### AI Objectives

1.  **Preserve Metadata**: When refactoring a table, never delete the `/** @strata ... */` block.
2.  **Visual Layout**: If the user asks to "move" a table, update the `x` and `y` coordinates in the JSDoc.
3.  **Target Awareness**:
    - `d1`: Default relational tables.
    - `do`: SQLite storage inside a Cloudflare Durable Object.
    - `kv`: Key-Value namespace representations.

### Code Pattern (Drizzle)

Always use the Drizzle `sqliteTable` pattern for D1:

```typescript
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/** @strata { "target": "d1", "x": 0, "y": 0 } */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
});
```

## 🛠️ Relationship Instructions

- **Foreign Keys**: Use `.references(() => table.column)`. Strata will render these as **Solid Lines**.
- **Drizzle Relations**: Use the `relations()` function. Strata will render these as **Dashed Lines**.

_Note: Always ensure that `relations()` identifiers follow the naming convention `${tableName}Relations` for automatic parsing._
