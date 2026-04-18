# 🚩 Milestone 2: The Git Grid

**Goal:** Establish code-as-truth by inverting the UI, integrating Git for versioned edits, and enhancing the parser to support table relationships and key identification.

## 1. UI Inversion & Layout Sync
- [ ] **Flip Panels:** Swap the 2-pane layout in `src/routes/+page.svelte`. Code Editor (Truth) on the Left, Svelte Flow (Diagram) on the Right.
- [ ] **Coordinate Info:** Add a small floating box in the bottom-left of the Diagram pane showing the `x` and `y` coordinates of the currently active/dragged table.
- [ ] **Infinite Canvas:** Ensure Svelte Flow is configured for an optimal "infinite" feel (viewport settings).

## 2. Git-First Workflow
- [ ] **Tauri Bridge:** Implement Rust commands in `lib.rs` for:
    - `git_status`: Check if the current file has changes.
    - `git_create_branch`: Create a new branch for the current edit session.
    - `git_commit`: Commit changes to the schema.
- [ ] **UI Integration:** Add a "Branch" selector and "Commit" button to the toolbar.

## 3. Rich Editor Integration (`tipex`)
- [ ] **Install Tipex:** Add `tipex` and dependencies.
- [ ] **Editor Implementation:** Replace the simple textarea with a `tipex` powered editor (or use it for metadata enrichment). *Note: Investigating if Tipex fits the code-editing goal or if it's for documentation.*

## 4. Enhanced Parser & Relationships
- [ ] **Rust Update (`src-tauri/src/lib.rs`):** Update the `ts-morph` logic to identify:
    - **Primary Keys:** Mark columns as PK.
    - **Foreign Keys:** Identify relations between tables.
- [ ] **Connector Logic:** Update `$lib/parser.ts` to generate Svelte Flow `edges` based on foreign key relationships.
- [ ] **Visual Keys:** Update `TableNode.svelte` to change background colors for Primary Key and Foreign Key markers.

## 5. Performance & GPU Rendering
- [ ] **Global Styling:** Move performance-critical styles (hardware acceleration) to `layout.css` to ensure consistent GPU usage across all nodes without repeating `<style>` tags.
- [ ] **Sync Optimization:** Ensure "Ctrl + S" triggers a re-parse and re-renders the diagram efficiently.
