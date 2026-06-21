# Strata

Strata is a high-performance, local-first visual editor for **Drizzle ORM v0.45.2 & Cloudflare D1**, built to **make it easier to visualize your Cloudflare applications**.

By utilising your TypeScript schema as the only source of truth, it resolves the "stale diagram" issue. Just your code, editable and visualized, no proprietary formats or sidecar JSON files.

![Strata Demo](video/demo.gif)

---

## 🚀 Key Features

- **Cloudflare Stack Support**: Visualize and design schemas for **Cloudflare D1** (relational SQL tables), **Durable Objects** (embedded SQLite blocks), and **Key-Value (KV) namespaces**.
- **Double-Click Inspector**: Double-click any table/entity node on the canvas to open the sidebar Inspector. Rename entities, add/delete fields, customize primary keys, set defaults, and manage relationships.
- **Three-Tier Relations Engine**:
  - **Physical Foreign Keys (Solid Lines)**: Inline references like `.references(() => users.id)`.
  - **Logical Drizzle Relations (Dashed, Animated)**: Declared using Drizzle's query-builder `relations()` block.
  - **Synthetic JSDoc Connections (Dashed, Static)**: Relations involving non-relational targets (KV or Durable Objects) stored directly in your entity's JSDoc comments.
- **Instant Bi-Directional Sync**: Visual alterations surgically patch your `schema.ts` file on disk immediately. External saves in your preferred IDE trigger the native OS file watcher to parse the AST and refresh the diagram.
- **Suggestive Auto Layout**: Organize tables automatically using the ELK layered algorithm. Arranges nodes in-memory first so you can inspect and manually reposition tables to your liking before committing to disk (or discarding).
- **Better Auth & External Imports**: Seamlessly resolve and visualize imported schemas (e.g., Better Auth's `user`, `session`, or `account` tables). Renders external tables as read-only nodes on the canvas, allowing you to link your primary tables to them visually.
- **Zero Lock-In**: Deleting the `@strata` JSDoc comments leaves you with 100% standard, clean Drizzle code.

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

## 📝 The `@strata` Standard

To pin a table's position, define its storage target, or configure synthetic connections, Strata uses standard JSDoc blocks. This keeps the schema standard-compliant and easily readable by both developers and AI assistants:

```typescript
/**
 * @strata { "target": "kv", "x": 120, "y": 300, "relations": [{"to": "users"}] }
 */
export const sessionCache = {
  id: "string",
};
```

---

## ⚡ Getting Started

you can grab the latest release from the [releases page](https://github.com/cntrvsy/strata/releases) or if you want to build from source, you can clone the repo and run the following: be sure you have nodejs, npm, rust and cargo installed

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run in Development**:
   ```bash
   npm run tauri dev
   ```

---

## 🧪 Testing & Reliability

We take schema integrity seriously. Every mutation is validated against a suite of AST regression tests.

- **Unit Tests (Parser & FSM)**: Validates the TypeScript parser, code modifications, and finite state machine transitions.
  ```bash
  npm test
  ```
- **E2E Tests (UI)**: Validates visual renderings, pane resize operations, and click/double-click flows in a real browser using Playwright.
  ```bash
  npm run test:e2e
  ```
