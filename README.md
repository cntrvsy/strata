<div align="center">

# Strata

**Visual Architecture & ERD Studio for Drizzle ORM and Cloudflare D1 / Workers Stack**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.0-orange.svg)](https://svelte.dev)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blueviolet.svg)](https://v2.tauri.app)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-v0.45.2-brightgreen.svg)](https://orm.drizzle.team)
[![Tests Passing](https://img.shields.io/badge/Tests-177%20passed-success.svg)](tests/)

_Single Source of Truth • AST-Driven • Local-First • Zero Git Noise • Zero Lock-In_

<br />

![Strata Demo](video/demo.gif)

</div>

---

## Overview

**Strata** is a high-performance, local-first visual architecture canvas and ERD studio designed specifically for **Drizzle ORM** and the **Cloudflare Workers ecosystem** (Cloudflare D1, KV Namespaces, Durable Objects, R2 Buckets, and Cloud Identity).

Unlike traditional database diagram tools that rely on sidecar JSON files, hidden proprietary databases, or external cloud sync, Strata uses your TypeScript schema codebase as the **single source of truth**.

- **External IDE Pairing**: Designed to run seamlessly side-by-side with your primary editor (**VS Code, Cursor, WebStorm**). Native OS file watchers detect disk modifications in milliseconds without jitter or feedback loops.
- **Drizzle Dual-Archetype Support**: First-class ingestion and visual editing for both **Single-File Monoliths** (`schema.ts`) and **Modular Barrels** (`schema/index.ts` re-exporting domain modules).
- **Git-Clean Diff Guarantee (`@strata-layout`)**: In modular projects, node layout coordinates live in a consolidated manifest in `index.ts`. Rearranging cards on the canvas touches **0 domain files** (`users.ts`, `posts.ts`), eliminating visual merge conflicts in Git!
- **Zero Lock-In**: No proprietary runtime dependencies. Deleting the JSDoc comments leaves **100% standard, clean Drizzle code**.

---

## Feature Highlights

### Drizzle Multi-Schema & Modular Barrel Support

- **Targeted Domain File Writes**: Visual edits route directly to the originating module (e.g. adding a column to `users` patches `schema/users.ts`).
- **Cross-Module Auto-Imports**: Dragging a foreign key from `posts.ts` to `users.ts` automatically injects `import { users } from "./users"` and `.references(() => users.id)`.
- **Dedicated `relations.ts` Resolution**: Automatically discovers and resolves standalone relations files across all schema modules.
- **Modular Entity Scaffolding**: Create new entities directly into new domain files (with auto-registered barrel re-exports) or append to existing domain modules.
- **Automatic `drizzle.config.ts` Ingestion**: Direct opening with support for globs (`schema: "./src/db/schema/*"`), string arrays, and template strings.

### Cloud Identity & Modern Auth Topology

- **D1-Resident Auth (Better Auth / Lucia)**: Automatically detects core auth clusters (`user`, `session`, `account`, `verification`) with `🛡️ Better Auth` badges. Easily append custom fields (`stripeCustomerId`, `role`) directly to the `user` table.
- **Cloud IdPs (Clerk & WorkOS)**: Visual Identity Boundary Nodes on the canvas when foreign keys reference external provider IDs (`clerkUserId`, `workosOrgId`), complete with animated connection lines.
- **1-Click Webhook Mirror Scaffolding**: Generate local D1 mirror tables (`clerkUsers`, `workosUsers`) and copyable webhook sync snippets directly from the node or Inspector.

### Cloudflare Architecture Support

- **Cloudflare D1**: Full visual design for relational SQL tables, column types, primary keys, and foreign keys.
- **KV Namespaces**: Map key-value schemas with explicit value types, TTL (with 60s minimum guard), and metadata attributes.
- **Durable Objects (DO)**: Define embedded state objects, class targets, and interface methods.
- **R2 Storage Buckets**: Configure bucket bindings, CORS policies, public access flags, and folder structure targets.

### Three-Tier Relationship Engine

1. **Physical Foreign Keys (Solid Lines)**: Native Drizzle relational constraints (`.references(() => users.id)`).
2. **Logical Drizzle Relations (Dashed, Animated)**: Declared via Drizzle's query-builder `relations()` API.
3. **Synthetic JSDoc Connections (Dashed, Static)**: Cross-storage links (e.g., linking a D1 SQL record to a KV namespace key or Durable Object stub) stored inside entity JSDoc comments.

### Wrangler Configuration Auto-Alignment

- Bi-directional integration with `wrangler.toml`, `wrangler.jsonc`, and `wrangler.json`.
- Automatically scans up to 12 parent directories for Wrangler configurations (or respects custom relative `wranglerPath` settings).
- Flags missing Cloudflare bindings with live validation warnings and lets you sync changes back to disk with a single click.

---

## The `@strata` Layout Patterns

> [!TIP]
> **Which default should you choose?**
> - **For Teams & Production Applications (Recommended Default)**: Opt for **Pattern A (Modular Barrel)** (`schema/index.ts`). It partitions domain logic cleanly, isolates AST mutations, and eliminates visual Git merge conflicts by consolidating canvas coordinates into `@strata-layout`.
> - **For Solo MVPs & Hackathons**: Opt for **Pattern B (Single-File Monolith)** (`schema.ts`) with inline `@strata` tags for single-file convenience.

Strata supports two clean metadata patterns depending on your project structure:

### Pattern A: Modular Barrel Manifest (`@strata-layout`) — Recommended for Teams

In modular setups (`schema/index.ts`), node coordinates are consolidated into a single manifest comment at the top of your barrel file. **Domain files (`users.ts`, `posts.ts`) remain 100% clean with zero Git merge noise:**

```typescript
// src/db/schema/index.ts
/**
 * @strata-layout {
 *   "users": { "x": 100, "y": 150 },
 *   "posts": { "x": 520, "y": 150 },
 *   "comments": { "x": 520, "y": 480 },
 *   "__clerk_identity__": { "x": -250, "y": 150 }
 * }
 */
export * from "./users";
export * from "./posts";
export * from "./comments";
```

### Pattern B: Single-File Inline JSDoc (`@strata`) — For Monoliths

In single-file setups (`schema.ts`), coordinates and storage targets sit directly above each variable declaration:

```typescript
// src/db/schema.ts
/**
 * @strata {
 *   "x": 120,
 *   "y": 300,
 *   "target": "d1",
 *   "relations": [{ "to": "sessionCache" }]
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

# Run Vitest unit & AST parser test suite (177 tests)
npm test

# Run Playwright end-to-end UI tests (16 tests)
npm run test:e2e

# Check Rust backend compilation
cd src-tauri && cargo check
```

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
