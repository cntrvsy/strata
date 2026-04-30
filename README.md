# Strata Forge: D1/SQLite Mastery

Strata Forge is a high-performance, local-first ERD tool designed for Cloudflare D1 and Drizzle ORM developers. It uses your `schema.ts` as the single source of truth, leveraging JSDoc for UI metadata and Git for history.

## 🏗️ Storage Architecture

Strata Forge categorizes your schema into distinct Cloudflare storage targets based on your code and JSDoc hints:

- **D1 (Relational)**: The default for any `sqliteTable` definition. Visualized with a Primary Blue theme.
- **Durable Objects (DO SQLite)**: Relational schemas tied to DO storage. Use the JSDoc hint `/** @strata { "target": "do" } */`. Visualized with a Secondary Purple theme.
- **Key-Value (KV)**: Pure visual blocks for KV namespaces. Parsed from annotated objects or Zod schemas using `/** @strata { "target": "kv" } */`. Visualized with an Accent Yellow theme.

## 🔗 Relationship Parsing

The tool intelligently distinguishes between database-level and application-level logic:

- **Physical Edges (Solid Lines)**: Represent hard foreign key constraints defined via `.references()`.
- **Virtual Edges (Dashed Lines)**: Represent application-level relationships defined in Drizzle's `relations()` API that do not map directly to a foreign key (e.g., reciprocal `many` relations).

## 📍 Visual Metadata

UI state (such as node positions) is stored directly in your source code using JSDoc to avoid sidecar files:

```typescript
/** 
 * @strata { "x": 100, "y": 100, "target": "do" } 
 */
export const myTable = sqliteTable("my_table", { ... });
```

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Run in development**:
   ```bash
   npm run tauri dev
   ```

## 🛠️ Tech Stack

- **Framework**: SvelteKit (Svelte 5 Runes)
- **Runtime**: Tauri 2.0 (Rust)
- **Diagrams**: @xyflow/svelte (Svelte Flow)
- **Styling**: TailwindCSS + DaisyUI
- **Parsing**: `ts-morph` for robust AST traversal.
