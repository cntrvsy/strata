# Strata Forge: D1/SQLite Mastery Plan

## 🎯 Goal
Transform Strata Forge into the ultimate visual companion for Cloudflare D1 + Drizzle developers by focusing on storage transparency and relationship DX.

---

## Phase 1: Drizzle Relations Mastery ✅
*Visualizing app-level logic alongside database foreign keys.*

- [x] **Defensive Parsing**: AST-based extraction of `relations()` and `sqliteTable`.
- [x] **Virtual Edges**: Dashed Svelte Flow edges for app-level relations.
- [x] **Type Guarding**: Robust fallback for missing or broken reciprocal definitions.

## Phase 2: Cloudflare Storage Architecture (D1, DO, KV) ✅
*Categorizing and visualizing Cloudflare's core storage capabilities.*

- [x] **Target Categorization**: Support for `d1`, `do`, and `kv` targets via JSDoc metadata.
- [x] **Visual Distinction**: Themed nodes with icons (Database, Cpu, Zap) for each storage type.

## Phase 3: Developer Ergonomics & Stats ✅
*A visual-first workflow that enhances, rather than disrupts, your existing IDE setup.*

- [x] **Intentional Sync**: Bi-directional position updates triggered by `Ctrl + S`.
- [x] **Schema Stats Overlay**: Lightweight analytics for entity breakdowns and structural insights.

## Phase 4: Performance & Documentation
*Solidifying the core engine and enabling documentation workflows.*

- [ ] **Parser Performance (Persistent AST)**:
  - Migrate `ts-morph` project initialization to a persistent app state.
  - Optimize `updateNodePositionInSchema` to use the cached source file for zero-latency saves.
- [ ] **Export to Image**:
  - Implement canvas capture for high-resolution PNG exports.
  - Add a "Snap & Copy" feature for quick documentation sharing.

## Phase 5: Bidirectional Composition (Next)
*Transforming from a "Live Mirror" to a "Live Forge" via visual editing.*

- [ ] **Formsnap Inspector**:
  - Implement a sidebar/drawer for entity creation and column management.
  - Use `formsnap` + `superforms` for accessible, type-safe schema editing.
- [ ] **AST Injection Logic**:
  - Extend `parser.ts` with `addTableToSchema` and `addColumnToSchema`.
  - Ensure new code is injected with proper Drizzle imports and JSDoc metadata.
- [ ] **Relationship Drag-and-Drop**:
  - Enable creating new relationships by dragging between node handles.
  - Automatically inject `relations()` blocks into `schema.ts`.

---

## Final Goal: Reliability & Testing
- [ ] **Parser Test Suite**: Validation for complex Drizzle edge-cases.
- [ ] **E2E Validation**: Tauri-driven tests for the JSDoc/AST write-back loop.
- [ ] **Build Optimization**: Final pass on Tailwind 4 / Svelte 5 bundle stability.
