# Strata Forge: D1/SQLite Mastery Plan

## 🎯 Goal
Transform Strata Forge into the ultimate visual companion for Cloudflare D1 + Drizzle developers by focusing on storage transparency and relationship DX.

---

## Phase 1: Structural Refactoring
*Break down the massive `+page.svelte` into focused, flat components.*

- [ ] Create `Navbar.svelte`: Handles file opening and status indicators.
- [ ] Create `Canvas.svelte`: Encapsulates Svelte Flow logic and event handlers.
- [ ] Create `Inspector.svelte`: The Table Inspector drawer.
- [ ] Create `Overlays.svelte`: Empty state, Errors, and Stats.

## Phase 2: Drizzle Relations Mastery
*Visualizing the app-level logic, not just the database foreign keys.*

- [ ] **Enhance Parser**: Detect and parse the Drizzle `relations()` API.
- [ ] **Virtual Edges**: Draw dashed/dotted lines for relationships that exist in the Drizzle `relations` object but don't have a direct database `references()` constraint.
- [ ] **Bi-directional Sync**: Ensure `addEdgeToSchema` can optionally generate `relations()` boilerplate.

## Phase 3: D1 Inspector Enhancements
*Storage transparency and SQLite-specific metadata.*

- [ ] **Storage Mapping**: Show the D1 physical type (e.g., `INTEGER`) next to the Drizzle type (e.g., `boolean`).
- [ ] **SQLite Linting**: Highlight D1-specific constraints (e.g., `AUTOINCREMENT` warnings, multi-column PKs).
- [ ] **Column Icons**: Add specific icons for `PK`, `FK`, and `Index`.

## Phase 4: DX Acceleration
*Reducing friction for the Edge developer.*

- [ ] **Snippet Export**: "Copy Table as Drizzle" button in the Inspector.
- [ ] **Migration Trigger**: (Optional) Button to run `npx drizzle-kit generate` via Tauri command.
- [ ] **Schema Stats**: Show D1-specific stats (Estimated row size, total column count).
