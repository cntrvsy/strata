# Strata Forge: Comprehensive Testing & Reliability Plan

This document outlines the strategy for bringing Strata Forge to a production-grade level of reliability through a multi-layered testing approach.

## 🎯 Testing Vision
Every mutation in the diagram must be reflected in the source code with 100% accuracy, and every valid Drizzle schema must render correctly without data loss or corruption of existing JSDoc metadata.

---

## 0. Architectural Robustness (Runed FSM)
*Eliminating "Impossible States" via Finite State Machines.*

- [ ] **FSM Integration**: Replace manual boolean flags in `schemaState` with a formalized Finite State Machine using `runed`.
  - **States**: `EMPTY`, `LOADING`, `IDLE`, `DIRTY` (unsaved changes), `SAVING`, `ERROR`.
  - **Transitions**: Ensure `Save` can only be triggered from `DIRTY`, and `Sync` cancels or blocks other operations.
- [ ] **Error Boundaries**: Use FSM error states to drive UI-level error overlays and recovery flows.

---

## 1. Unit Testing (Vitest)
*Logic-first validation of the core engine.*

### **Parser & AST Logic**
- [ ] **Complex Edge Cases**: Test parsing of schemas with multiple `relations()` blocks, circular dependencies, and custom naming conventions.
- [ ] **JSDoc Preservation**: Ensure that non-Strata JSDoc (e.g., standard documentation) is never stripped during a write-back operation.
- [ ] **Mutation Surgery**: Validate that `addColumn` or `renameTable` operations are surgically precise, only touching the relevant AST nodes.
- [ ] **Storage Type Detection**: Verify `kv`, `do`, and `d1` detection logic via JSDoc `@strata { "target": "..." }`.

### **State Management (Svelte Runes)**
- [ ] **Schema State Sync**: Test that updates to `schemaState` correctly propagate to the AST logic.
- [ ] **Node/Edge Deduplication**: Ensure that re-parsing a file doesn't result in duplicate IDs or visual jitter.

---

## 2. Backend Testing (Cargo)
*Ensuring the Rust layer is robust and performant.*

### **File Watcher & I/O**
- [ ] **Watcher Resilience**: Test that the `notify` watcher handles rapid-fire saves and directory renames without crashing.
- [ ] **Race Condition Prevention**: Implement tests for simultaneous front-end writes and back-end file change detections.
- [ ] **Error Handling**: Gracefully handle missing files, permission errors, and invalid UTF-8 in `schema.ts`.

### **Command Interface**
- [ ] **Tauri Command Schema**: Type-check the arguments passed between TypeScript and Rust for all file operations.

---

## 3. End-to-End Testing (Playwright + Tauri)
*User-centric validation of the full application flow.*

### **The "Live Forge" Loop**
- [ ] **Node Manipulation**: 
  - Drag a node -> Verify JSDoc `x, y` updates in the source file.
  - Delete a node -> Verify the table and its relations are removed from `schema.ts`.
- [ ] **Form Interactions**:
  - Open "Add Field" -> Submit -> Verify `sqliteTable` is updated with the new column.
  - Connect two nodes -> Verify a new `relations()` block is injected.
- [ ] **Inspector Validation**:
  - Update a column type -> Verify the Drizzle column definition changes (e.g., `.text()` to `.integer()`).
  - Toggle `NOT NULL` -> Verify `.notNull()` presence in the AST.

### **UI Component Integrity**
- [ ] **Overlay States**: Test the transition from "Empty State" to "Schema Loaded".
- [ ] **Responsive Design**: Ensure the `DiagramCanvas` and `Inspector` maintain usability across various window sizes.
- [ ] **Modal Flows**: Validate that `HelpModal` and "New Table" forms close correctly and don't leak state.

---

## 4. Production Environment Simulation
*How we test for "The Real World".*

- **Mock Tauri API**: Use a custom Playwright setup that mocks the `@tauri-apps/api` for standard browser runs, but provides a "fake file system" that mimics the `schema.ts` file.
- **Tauri Action Testing**: Use `tauri-action` or similar to run E2E tests inside a real Tauri environment (WebView + Rust backend) during CI/CD.
- **Stress Testing**: Load a massive schema (100+ tables, 500+ relations) to ensure `ts-morph` and `Svelte Flow` maintain 60fps performance.

---

## 5. Coverage Goals & Metrics

| Layer | Target Coverage | Key Metric |
| :--- | :--- | :--- |
| **Parser (`parser.ts`)** | 100% | No regression on AST mutations. |
| **State (`state.svelte.ts`)** | 90% | Rune reactivity integrity. |
| **Rust Backend** | 80% | Reliability of file system notifications. |
| **UI Components** | 70% | Interaction coverage for all forms and modals. |

---

## 🎯 Final Acceptance Criteria
1. **Zero Data Loss**: Re-parsing and saving a file 100 times results in the same AST structure (idempotency).
2. **Deterministic UI**: The diagram layout is identical across reloads if no metadata changes.
3. **Clean Build**: `svelte-check` and `cargo clippy` report zero errors.
