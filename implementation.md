# 🚩 Milestone 1: The Skeleton Sync

**Goal:** A functional 2-pane UI that reads a either a user selected or the provided default `schema.ts` file, renders tables as nodes, and saves moved positions back to the file via JSDoc.

## 2. The 2-Pane Layout (`src/routes/+page.svelte`)

- [ ] Implement a DaisyUI `drawer` or `flex` container.
- [ ] Left Pane: Svelte Flow canvas for diagrams.
- [ ] Right Pane: Code editor (Monaco or a simple textarea for M1).
- [ ] Add a "File Picker" button in the toolbar using `tauri-plugin-dialog`.

## 3. The Metadata Parser (`$lib/parser.ts`)

Implement the `ts-morph` logic to:

- [ ] Create a mock file in `src/lib/mock/schema.ts`. This file will be used to test the parser. this should mimic better auth schema specifically SQLite.
- [ ] **Read:** Extract `sqliteTable` names and the `@strata` JSON metadata.
- [ ] **Write:** Update only the JSDoc comment for a specific table without touching the Drizzle column definitions.

## 4. The Sync Loop

- [ ] **Rust Side:** Create a Tauri command `save_node_pos(path, table_name, x, y)` that performs the string replacement.
- [ ] **Frontend Side:** Bind `onNodeDragStop` to call the Rust command.
- [ ] **Git Integration:** Add a "Revert" button that runs `git checkout -- schema.ts` via Rust's `std::process::Command`.

## 5. Visual Nodes

- [ ] Create `TableNode.svelte` using DaisyUI `card` classes.
- [ ] Display table name in the header and columns as a list.
