# Strata: A Drizzle ORM Visualizer

Strata is a high-performance, local-first ERD (Entity Relationship Diagram) tool designed specifically for the **Cloudflare D1 + Drizzle ORM** stack.

It solves the "stale diagram" problem by using your TypeScript schema as the single source of truth. No sidecar JSON files, no proprietary formats—just your code, visualized and editable.

![Strata Demo](video/demo.gif)

---

## The Philosophy

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

## Adoption & Zero Lock-in

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

## Getting Started

1. **Install**:
   ```bash
   npm install
   ```
2. **Run**:
   ```bash
   npm run tauri dev
   ```

---

## Testing & Reliability

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

## Project Structure

- `src/lib/parser.ts`: The core AST parsing and surgery engine using `ts-morph`.
- `src/lib/state.svelte.ts`: Global application state governed by a formal Svelte 5 Runes FSM (`runed`).
- `src/lib/components/Inspector.svelte`: Interactive sidebar for structural table and column mutations.
- `src/lib/components/Navbar.svelte`: Navigation, real-time bi-directional status, and PNG exporter.

## Current Stage & Reliability

Strata has graduated from a proof of concept to a **production-ready visual schema tool**:
- **Zero Data Loss**: 100% AST-level idempotency ensures that saving and re-parsing a schema file leaves it entirely unchanged (proven under high-iteration unit tests).
- **Formal State Machine**: No race conditions or impossible UI states, thanks to a robust, formal finite state machine orchestrating loads, watcher events, and disk writes.
- **Robust E2E Suite**: The visual frontend is fully covered by Playwright visual-interaction tests simulating complex user scenarios with a custom Tauri plugin mock.
- **Stress-Tested Engine**: Retains 60fps responsiveness on massive schemas with 100+ tables and hundreds of relationships.

## Key Design Constraints

- **SQLite/D1 Dialect**: Tailored specifically for Cloudflare D1 and standard SQLite patterns (e.g. integer date mappings).
- **Native Tauri Shell**: Requires the Tauri 2.0 runtime environment to provide native OS file system watcher and file manipulation capabilities.
- **Unified schema.ts**: Operates on a single, clean `schema.ts` file as the unified, single source of truth.

