<div align="center">

# Strata

**Visual Architecture & ERD Studio for Drizzle ORM and Cloudflare D1 / Workers Stack**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.0-orange.svg)](https://svelte.dev)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blueviolet.svg)](https://v2.tauri.app)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-v0.45.2-brightgreen.svg)](https://orm.drizzle.team)
[![Tests Passing](https://img.shields.io/badge/Tests-93%20passed-success.svg)](tests/)

_Single Source of Truth • AST-Driven • Local-First • Zero Lock-In_

<br />

![Strata Demo](video/demo.gif)

</div>

---

## Overview

**Strata** is a high-performance, local-first visual ERD and architecture editor designed specifically for **Drizzle ORM** and the **Cloudflare Workers ecosystem** (Cloudflare D1, KV Namespaces, Durable Objects, and R2 Buckets).

Unlike traditional database diagram tools that require sidecar JSON files, proprietary databases, or external cloud sync, Strata uses your TypeScript `schema.ts` file as the **single source of truth**.

- Visual drag-and-drop actions **surgically patch your AST** on disk via `ts-morph`.
- External edits made in your favorite IDE (VS Code, Cursor, Neovim) are detected via native OS file watchers to immediately update the canvas.
- Deleting the JSDoc layout comments leaves **100% standard, clean Drizzle code**.

---

## Feature Highlights

### Cloudflare Architecture Support

- **Cloudflare D1**: Full visual design for relational SQL tables, column types, primary keys, and foreign keys.
- **KV Namespaces**: Map key-value schemas with explicit value types, TTL, and metadata attributes.
- **Durable Objects (DO)**: Define embedded state objects, class targets, and interface methods.
- **R2 Storage Buckets**: Configure bucket bindings, cors policies, public access flags, and folder structure targets.

### Three-Tier Relationship Engine

1. **Physical Foreign Keys (Solid Lines)**: Native Drizzle relational constraints (`.references(() => users.id)`).
2. **Logical Drizzle Relations (Dashed, Animated)**: Declared via Drizzle's query-builder `relations()` API.
3. **Synthetic JSDoc Connections (Dashed, Static)**: Cross-storage links (e.g., linking a D1 SQL record to a KV namespace key or Durable Object stub) stored inside entity JSDoc comments.

### Wrangler Configuration Auto-Alignment

- Bi-directional integration with `wrangler.toml`, `wrangler.jsonc`, and `wrangler.json`.
- Automatically scans up to 12 parent directories for Wrangler configurations (or respects custom relative `wranglerPath` settings).
- Flags missing Cloudflare bindings with live validation warnings and lets you sync changes back to disk with a single click.

### Interactive Sidebar Inspector

- Double-click any entity on the canvas to open the sidebar inspector.
- Rename tables, modify column definitions, adjust data types, configure default values, toggle nullability, and manage relationships visually.

### Auto-Layout & Multi-File Imports

- **ELK Layout Engine**: Automatically organize complex schemas using layered layout algorithms.
- **External Imports**: Resolves external schema imports (e.g., Better Auth's `user` and `session` models) and renders them as read-only canvas nodes.

---

## Architecture & Pipeline

```text
               ┌──────────────────────────┐
               │   Visual Canvas (UI)     │
               │  (Svelte 5 + Svelte Flow)│
               └─────┬──────────────▲─────┘
                     │              │
              AST Mutation     File Watcher
             (via ts-morph)    (via Tauri 2)
                     │              │
               ┌─────▼──────────────┴─────┐
               │  schema.ts & wrangler    │
               │ (JSDoc + Drizzle Code)   │
               └──────────────────────────┘
```

- **SvelteKit + Svelte 5 Runes**: High-performance client reactivity using `$state`, `$derived`, and `$state.raw` for Svelte Flow nodes.
- **Tauri 2.0 Desktop Shell**: Rust-powered IPC and native file system coordinator.
- **ts-morph AST Parser**: In-memory TypeScript compiler AST engine for exact code mutations.

---

## The `@strata` JSDoc Standard

Strata stores diagram layout coordinates, storage targets, and synthetic relationship metadata inside standard TypeScript JSDoc blocks:

```typescript
/**
 * @strata {
 *   "x": 120,
 *   "y": 300,
 *   "target": "d1",
 *   "relations": [{ "to": "sessions" }]
 * }
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),
});

/**
 * @strata { "x": 450, "y": 300, "target": "kv" }
 */
export const sessionCache = {};
```

---

## Tech Stack

| Domain                | Technology                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| **UI Framework**      | [SvelteKit](https://kit.svelte.dev) (Svelte 5 Runes)                           |
| **Desktop Shell**     | [Tauri 2.0](https://v2.tauri.app) (Rust)                                       |
| **Canvas & Flow**     | [@xyflow/svelte](https://svelteflow.dev)                                       |
| **Styling**           | [Tailwind CSS v4](https://tailwindcss.com) + [DaisyUI v5](https://daisyui.com) |
| **ORM Compatibility** | [Drizzle ORM](https://orm.drizzle.team) (SQLite / D1 Dialect)                  |
| **AST Mutator**       | [ts-morph](https://ts-morph.com)                                               |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- [Rust Toolchain](https://www.rust-lang.org)

### Installation & Development

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/cntrvsy/strata.git
   cd strata
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Run Web Dev Server**:

   ```bash
   npm run dev
   ```

4. **Launch Desktop App (Tauri)**:
   ```bash
   npm run tauri dev
   ```

### Running the Linux AppImage

When downloading the `.AppImage` release binary on Linux, web browsers strip execution permissions by default for security. Grant execution permissions before running:

```bash
chmod u+x Strata_*.AppImage
./Strata_*.AppImage
```

#### Desktop & Icon Integration (Gear Lever)

Standalone `.AppImage` files display a generic executable icon in Linux file managers because file managers do not unpack binary disk images automatically. To integrate Strata into your application launcher with full app icon and menu support, use **Gear Lever**:

- **Flatpak**:
  ```bash
  flatpak install flathub it.miurus.gearlever
  ```
- **Arch Linux / CachyOS (AUR)**:
  ```bash
  yay -S gearlever
  ```

Opening the `.AppImage` in **Gear Lever** organizes the file into your applications folder, extracts its high-resolution desktop icon, and adds a shortcut to your application menu and dock.

---

## Testing & Quality Assurance

Strata maintains a strict suite of unit, AST, type diagnostic, and E2E browser tests:

```bash
# Run Svelte & TypeScript type diagnostic checks
npm run check

# Run Vitest unit & AST parser test suite (93 tests)
npm test

# Run Playwright end-to-end UI tests (14 tests)
npm run test:e2e

# Check Rust backend compilation
cd src-tauri && cargo check
```

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
