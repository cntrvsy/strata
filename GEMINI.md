You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation.

# Project: Strata (D1 ERD Tool)

## Vision

A high-performance, local-first ERD tool for Drizzle + Cloudflare D1. It uses `schema.ts` as the single source of truth, leveraging Git for versioning and JSDoc for UI metadata. No sidecar JSON files.

## Technical Stack

- **Framework:** SvelteKit (Svelte 5 Runes)
- **Runtime:** Tauri 2.0 (Rust)
- **Diagrams:** @xyflow/svelte (Svelte Flow)
- **Styling:** TailwindCSS + DaisyUI
- **ORM:** Drizzle (SQLite/D1 Dialect)
- **Parser:** ts-morph (via Tauri Rust commands)

## MCP Documentation Protocol

1. **list-sections** -> Find Svelte 5/Kit docs.
2. **get-documentation** -> Fetch sections before writing code.
3. **svelte-autofixer** -> Run on all Svelte components.
4. **playground-link** -> Offer only for logic isolated from Tauri.

## Architectural Guardrails

1. **Metadata:** UI state (x, y, etc.) MUST be stored in JSDoc: `/** @strata { "x": 0, "y": 0 } */`.
2. **Git is History:** No internal undo stack. Use `git checkout -- <file>` to revert changes.
3. **SSR:** `export const ssr = false;` in `src/routes/+page.ts`.
4. **Runes:** Use `$state.raw` for Svelte Flow `nodes` and `edges` to ensure high performance on large schemas.

## AI Instructions

- Always prioritize **SQLite/D1** compatibility (e.g., handling Dates as integers).
- When a node is dragged, trigger a Tauri command to update the JSDoc in `schema.ts`.
- When `schema.ts` is edited in the Code Tab, re-parse and update the Diagram Tab.
