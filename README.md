# Strata: The Drizzle Design Companion

Strata is a high-performance, local-first ERD (Entity Relationship Diagram) tool designed specifically for the **Cloudflare D1 + Drizzle ORM** stack.

It solves the "stale diagram" problem by using your TypeScript schema as the single source of truth. No sidecar JSON files, no proprietary formats—just your code, visualized and editable.

---

## 🏗️ The Philosophy

Traditional ERD tools live outside your codebase. Strata lives _inside_ the development loop. It acts as a visual front-end for your AST (Abstract Syntax Tree).

```text
       ┌──────────────────────────┐
       │   Visual Canvas (UI)     │
       └─────┬──────────────▲─────┘
             │              │
     AST Manipulation   File Watcher
     (via ts-morph)     (via Tauri)
             │              │
       ┌─────▼──────────────┴─────┐
       │      schema.ts           │
       │ (JSDoc + Drizzle Code)   │
       └──────────────────────────┘
```

- **Visual Design**: Drag-and-drop to create relationships, add columns, and rename tables.
- **AST Injection**: Changes are surgically injected back into your TypeScript file without losing your formatting or comments.
- **Disk-First**: Every visual action is a file system mutation. Your IDE and your Diagram are always in sync.

---

## 🔗 Adoption & Zero Lock-in

Strata is designed to be a "zero-dependency" addition to your workflow. It uses a non-intrusive JSDoc standard to store metadata (like coordinates) that your database doesn't care about.

### The `@strata` Standard

To pin a table's position or define its storage target (D1, KV, or Durable Object), simply add a JSDoc block. This is understood by both humans and AI assistants:

```typescript
/**
 * @strata { "target": "d1", "x": 100, "y": 200 }
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
});
```

**Why this matters**:

- **Humans**: Write code as you normally do; the diagram updates in real-time.
- **AI**: Tell your AI to "Move the users table to the center," and it will simply update the JSDoc coordinates in the file.
- **Freedom**: If you stop using Strata, your code remains valid, standard Drizzle. Just delete the comments if you want them gone.

---

## 🚀 Getting Started

1. **Install**:
   ```bash
   npm install
   ```
2. **Run**:
   ```bash
   npm run tauri dev
   ```

---

## 🧪 Testing & Reliability

We take schema integrity seriously. Every mutation is validated against a suite of AST regression tests.

- **Unit Tests (Parser)**: Validates the TypeScript parser and mutation logic.
  ```bash
  npm test
  ```
- **Unit Tests (Core)**: Validates the Rust-based file watcher and OS integration.
  ```bash
  cd src-tauri && cargo test
  ```
- **E2E Tests (UI)**: Validates rendering and component states via Playwright.
  ```bash
  npm run test:e2e
  ```

---

## 🛠️ Project Structure

- `src/lib/parser.ts`: The core engine. Handles AST traversal and code injection.
- `src/lib/state.svelte.ts`: Global application state using Svelte 5 Runes.
- `src/lib/components/Inspector.svelte`: The visual design sidebar for schema management.
- `src/lib/mock/schema.ts`: An example schema to play with.

## ⚠️ Current Limitations

- **Drizzle-Only**: Optimized for Drizzle + Cloudflare D1/SQLite patterns.
- **Local-First**: Requires a Tauri-supported environment for native file system access.
- **Manual Relations**: Complex logical relations are best created via the UI to ensure proper `relations()` block generation.
