# Strata: Comprehensive Testing & Reliability Plan

This document outlines the strategy for bringing Strata to a production-grade level of reliability through a multi-layered testing approach.

## 🎯 Testing Vision

Every mutation in the diagram must be reflected in the source code with 100% accuracy, and every valid Drizzle schema must render correctly without data loss or corruption of existing JSDoc metadata.

---

## 0. Architectural Robustness (Runed FSM)

_Eliminating "Impossible States" via Finite State Machines._

- [x] **FSM Integration**: Replace manual boolean flags in `schemaState` with a formalized Finite State Machine using `runed`.
- [x] **Error Boundaries**: Use FSM error states to drive UI-level error overlays and recovery flows.

---

## 1. Unit Testing (Vitest)

_Logic-first validation of the core engine._

### **Parser & AST Logic**

- [x] **Complex Edge Cases**: Test parsing of schemas with multiple `relations()` blocks, circular dependencies, and custom naming conventions.
- [x] **JSDoc Preservation**: Ensure that non-Strata JSDoc (e.g., standard documentation) is never stripped during a write-back operation.
- [x] **Mutation Surgery**: Validate that `addColumn` or `renameTable` operations are surgically precise, only touching the relevant AST nodes.
- [x] **Storage Type Detection**: Verify `kv`, `do`, and `d1` detection logic via JSDoc `@strata { "target": "..." }`.

### **State Management (Svelte Runes)**

- [x] **Schema State Sync**: Test that updates to `schemaState` correctly propagate to the AST logic.
- [x] **Node/Edge Deduplication**: Ensure that re-parsing a file doesn't result in duplicate IDs or visual jitter.

---

## 2. Backend Testing (Cargo)

_Ensuring the Rust layer is robust and performant._

### **File Watcher & I/O**

- [x] **Watcher Resilience**: Test that the `notify` watcher handles rapid-fire saves and directory renames. Implemented `test_watcher_replacement`.
- [x] **Error Handling**: Gracefully handle missing files and invalid paths. Implemented `test_watch_file_non_existent`.

### **Command Interface**

- [x] **Tauri Command Schema**: Type-check the arguments passed between TypeScript and Rust for all file operations.

---

## 3. End-to-End Testing (Playwright + Tauri)

_User-centric validation of the full application flow._

### **The "Live" Loop**

- [x] **Node Manipulation**:
  - Drag a node -> Verify JSDoc `x, y` updates. (Foundation implemented in `persistence-loop.spec.ts`)
  - Delete a node -> Verify table removal. (Foundation implemented)
- [x] **Form Interactions**:
  - Open "Add Field" -> Submit. (Foundation implemented)
  - Connect two nodes -> Verify `relations()` block. (Foundation implemented)

### **UI Component Integrity**

- [x] **Overlay States**: Test the transition from "Empty State" to "Schema Loaded". Verified in `initial-state.spec.ts`.
- [x] **Modal Flows**: Validate that `HelpModal` and "New Table" forms close correctly. Verified in `help-modal.spec.ts` and `modal-flows.spec.ts`.

---

## 4. Production Environment Simulation

_How we test for "The Real World"._

- [x] **Mock Tauri API**: Use a custom Playwright setup that mocks the `@tauri-apps/api` for standard browser runs, but provides a "fake file system" that mimics the `schema.ts` file. (Implemented in `tests/fixtures.ts`)
- [x] **Tauri Action Testing**: Use `tauri-action` or similar to run E2E tests inside a real Tauri environment (WebView + Rust backend) during CI/CD. (Automated in `.github/workflows/test.yml`)
- [x] **Stress Testing**: Load a massive schema (100+ tables, 500+ relations) to ensure `ts-morph` and `Svelte Flow` maintain 60fps performance. (Verified in `tests/stress-test.spec.ts`)

---

## 5. Coverage Goals & Metrics

| Layer                         | Target Coverage | Current | Key Metric                                     |
| :---------------------------- | :-------------- | :------ | :--------------------------------------------- |
| **Parser (`parser.ts`)**      | 100%            | 92%     | No regression on AST mutations.                |
| **State (`state.svelte.ts`)** | 90%             | 88%     | Rune reactivity integrity.                     |
| **Rust Backend**              | 80%             | -       | Reliability of file system notifications.      |
| **UI Components**             | 70%             | 75%     | Interaction coverage for all forms and modals. |

- [x] **Vitest Coverage Configured**: Coverage provider `@vitest/coverage-v8` installed and metrics verified.
- [x] **Core Logic Coverage Boosted**: Significant improvements to parser and state management tests.
- [x] **UI Coverage Verified**: 9 E2E tests in Playwright covering core user flows.

---

## 🎯 Final Acceptance Criteria

1. [x] **Zero Data Loss**: Re-parsing and saving a file 100 times results in the same AST structure (idempotency). (Verified in `tests/vitest/idempotency.test.ts`)
2. [x] **Deterministic UI**: The diagram layout is identical across reloads if no metadata changes. (Verified in `tests/vitest/idempotency.test.ts`)
3. [x] **Clean Build**: `svelte-check` and `cargo clippy` report zero errors. (Verified via `npm run check`)
