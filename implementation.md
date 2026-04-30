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

## Phase 4: Optimization & Robustness (Next)
*Solidifying the core engine for production-grade schema management.*

- [ ] **Parser Performance (AST Reuse)**:
  - Migrate `ts-morph` project initialization to a persistent state.
  - Use `sourceFile.replaceWithText()` for reactive updates to avoid the overhead of full file re-parses.
- [ ] **UX Success States**:
  - Implement a "Positions Synced" visual feedback loop in the Save Toast.
  - Transform the toast state with a checkmark animation upon successful write.
- [ ] **Visual Clarity (Dynamic Edge Routing)**:
  - Implement `Bezier` curves for virtual relationships to distinguish them from standard `Smoothstep` foreign keys.
  - Optimize routing to prevent edge-node overlapping in dense clusters.
- [ ] **Validation-Agnostic Discovery**:
  - Update KV/DO parsing to detect "Schema-like" objects wrapped in call expressions (e.g. `z.object()`, `v.object()`).
  - Focus on extracting property structures from the first argument of the outermost call, making the tool library-agnostic.

---

## Final Goal: Reliability & Testing
- [ ] **Unit Tests**: Parser validation for edge-case Drizzle schemas.
- [ ] **E2E Tests**: Tauri-driven tests for file system interactions and keyboard shortcuts.
- [ ] **Build Validation**: Final pass on Tailwind 4 / Svelte 5 build stability.
