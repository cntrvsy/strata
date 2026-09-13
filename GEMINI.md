You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation.

# Project: Strata (D1 ERD Tool)

## Vision

A high-performance, local-first visual architecture canvas and ERD studio for Drizzle ORM + Cloudflare Workers ecosystem (Cloudflare D1 SQLite, KV Namespaces, Durable Objects, R2 Buckets, and Cloud Identity). It uses the user's TypeScript schema codebase as the **single source of truth**, leveraging Git for version control and JSDoc for UI metadata. No sidecar JSON files, zero lock-in.

## Technical Stack

- **Framework:** SvelteKit (Svelte 5 Runes)
- **Runtime:** Tauri 2.0 (Rust backend with native file coordinator & FS watchers)
- **Diagrams:** @xyflow/svelte (Svelte Flow)
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **ORM:** Drizzle (SQLite/D1 Dialect)
- **Parser & AST Mutators:** ts-morph (in `src/lib/parser/`)

## Schema Archetypes

Strata natively supports two schema archetypes:

1. **Modular Barrel (`schema/index.ts` or barrel root) [Recommended for Teams]:**
   - Domain tables/entities are partitioned into separate files (e.g. `users.ts`, `posts.ts`, `relations.ts`).
   - The root barrel file re-exports all domain files (`export * from "./users";`).
   - **Git-Clean Layout Manifest (`@strata-layout`)**: Node layout coordinates live **exclusively** in a consolidated root manifest comment in `index.ts`:
     ```typescript
     /**
      * @strata-layout {
      *   "users": { "x": 100, "y": 150 },
      *   "posts": { "x": 520, "y": 150 }
      * }
      */
     ```
   - **CRITICAL:** Individual domain files (`users.ts`, `posts.ts`) MUST remain pure Drizzle code with zero `@strata` position comments. Moving or dragging nodes on the canvas must touch only the `@strata-layout` manifest in the barrel root, ensuring zero Git merge conflicts in domain files.
   - Mutations (e.g., adding columns, indexes, or relations) must target the originating domain module directly. Cross-module foreign keys must inject explicit relative imports (e.g. `import { users } from "./users";`).

2. **Single-File Monolith (`schema.ts`):**
   - All tables and entities reside within a single file.
   - Metadata is stored directly above each declaration using inline JSDoc:
     ```typescript
     /** @strata { "target": "d1", "x": 100, "y": 200 } */
     export const users = sqliteTable("users", { ... });
     ```

## MCP Documentation Protocol

1. **list-sections** -> Find Svelte 5/Kit docs.
2. **get-documentation** -> Fetch sections before writing code.
3. **svelte-autofixer** -> Run on all Svelte components.
4. **playground-link** -> Offer only for logic isolated from Tauri.

## Architectural Guardrails

1. **Layout & Metadata Storage:**
   - In modular setups, save visual positions to the root `@strata-layout` manifest in `index.ts`. Never dirty domain files with layout coordinates.
   - In single-file monoliths, persist coordinates in the declaration's inline `/** @strata { ... } */` comment.
   - Synthetic cross-storage relationships (connecting D1 tables to KV, DO, or R2) are stored in JSDoc: `"relations": [{ "to": "targetName" }]`.
2. **External IDE Pairing & Git as History:**
   - Strata pairs side-by-side with external editors (VS Code, Cursor). Changes saved to disk trigger live re-parsing.
   - No internal undo/redo stack; users use Git (`git checkout -- <file>`) to revert modifications.
3. **SSR:** `export const ssr = false;` in `src/routes/+page.ts`.
4. **Runes & Flow Performance:**
   - Use `$state.raw` for Svelte Flow `nodes` and `edges` to ensure maximum rendering performance on large schemas.
   - Use Svelte 5 Runes (`$state`, `$derived`, `$effect`, `$props`) across all UI components.

## Monorepo & Multi-Package Archetype Guidelines

1. **Drizzle Monorepo Entrypoint Convention:**
   - In modular monorepos (e.g. `packages/db`), NEVER treat the package client entrypoint (`packages/db/src/index.ts`) as the Drizzle schema file.
   - Always place `@strata-layout` and domain re-exports in the dedicated schema barrel: `packages/db/src/schema/index.ts`.
   - Point `drizzle.config.ts` explicitly to `./src/schema/index.ts`.
2. **Directory Depth Calculation for External Storage Targets (`@strata { "path": ... }`):**
   - Always count the exact number of parent directories (`../`) from the schema file's directory to the workspace root:
     - Example: `packages/db/src/schema/index.ts` is 4 folders deep (`schema` -> `src` -> `db` -> `packages` -> root).
     - To reference `apps/api/src/durable-objects/TelemetrySessionDO.ts`, the path MUST use 4 parent steps:
       `"path": "../../../../apps/api/src/durable-objects/TelemetrySessionDO.ts"`
   - If a tsconfig path alias is configured (e.g. `@api/*`), prefer it over fragile deep relative traversal.

## AI Instructions

- Always prioritize **SQLite/D1** compatibility:
  - SQLite lacks a native Date type: always map dates using `integer("col", { mode: "timestamp" })` or `integer("col", { mode: "timestamp_ms" })`.
  - Booleans must map to `integer("col", { mode: "boolean" })`.
- Respect Storage Targets:
  - D1 SQL tables: `"target": "d1"` (default)
  - Durable Objects: `"target": "do"`
  - KV Namespaces: `"target": "kv"`
  - R2 Buckets: `"target": "r2"`
- Relationships:
  - Physical Foreign Keys: Solid lines via `.references(() => table.id)`.
  - Logical Drizzle Relations: Dashed lines via `relations(...)` builder.
  - Synthetic Links: Non-SQL links via JSDoc metadata.
- Identity & Modern Auth Boundaries:
  - Detect Better Auth clusters (`user`, `session`, `account`, `verification`).
  - Detect Cloud IdP boundaries (`clerkUserId`, `workosOrgId`) and support local webhook mirror table scaffolding.
- Zero Lock-In:
  - Never introduce proprietary runtime dependencies or sidecar files. Output standard, production-ready Drizzle TypeScript.

