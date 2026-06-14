# Strata Technical Debt & Code Consolidation Report

This report analyzes redundancies, code duplication, and coupling patterns inside Strata, proposing concrete refactoring blueprints to make future changes systematic, robust, and predictable.

---

## 1. Executive Summary

As Strata has grown from a proof of concept to a highly responsive visual workspace, multiple edits have introduced structural duplication. The key targets for technical debt reduction are:
* **AST Parsing Duplication:** Replicated patterns for locating `sqliteTable` declarations.
* **Transactional State Boilerplate:** Replicated FSM `SAVE` and `writeTextFile` transition logic.
* **Platform Coupling:** Direct dependencies on Tauri plugins (`plugin-fs`, `plugin-dialog`) spread throughout UI components, complicating headless testing.
* **Form Modularity:** Redundant validation schemas and layouts in Svelte form inputs.

---

## 2. Identified Tech Debt & Modularity Issues

### Issue A: AST Parsing Logic Duplication (`parser.ts`)
In [parser.ts](file:///run/media/system/2tbsata/projects/tauri/strata/src/lib/parser.ts), the logic to identify the `sqliteTable` call expression within a variable declaration is duplicated across 5 functions: `extractColumns`, `addColumnToSchema`, `removeColumnFromSchema`, `renameColumnInSchema`, and `updateColumnModifiersInSchema`.

**Current Pattern (Duplicated):**
```typescript
const tableCall = initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable'
    ? initializer
    : initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find(c => c.getExpression().getText() === 'sqliteTable');
```

### Issue B: State Mutation Boilerplate (`state.svelte.ts`)
In [state.svelte.ts](file:///run/media/system/2tbsata/projects/tauri/strata/src/lib/state.svelte.ts), every visual schema mutation (`deleteColumn`, `deleteTable`, `renameTable`, `updateColumnModifiers`) repeats a boilerplate sequence:
1. Transition FSM state to `SAVE`.
2. Dynamically import `@tauri-apps/plugin-fs`.
3. Execute parser mutation function on `this.rawCode`.
4. Write changes to disk and call `this.syncWithFile()`.
5. Transition FSM to `SAVE_SUCCESS` or `SAVE_ERROR`.

This creates over 80 lines of identical structural boilerplate, increasing the risk of inconsistent error handling or state machine leaks.

### Issue C: UI Forms Redundancy
[AddFieldForm.svelte](file:///run/media/system/2tbsata/projects/tauri/strata/src/lib/components/AddFieldForm.svelte) and [NewTableForm.svelte](file:///run/media/system/2tbsata/projects/tauri/strata/src/lib/components/NewTableForm.svelte) define distinct Svelte components but repeat identical DaisyUI input structure, layout structures, and Valibot-based form action wiring.

---

## 3. Recommended Refactoring Blueprints

### Blueprint 1: Unified AST Node Resolver (`parser.ts`)
Extract the `sqliteTable` call expression resolution into a shared helper function.

```typescript
/**
 * Resolves the underlying drizzle sqliteTable CallExpression node from an initializer.
 */
function findSqliteTableCall(initializer: ASTNode): CallExpression | undefined {
  if (initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable') {
    return initializer;
  }
  return initializer.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find(c => c.getExpression().getText() === 'sqliteTable');
}
```
**Impact:** Eliminates 20 lines of redundant AST search code, making Drizzle symbol resolution modifications centralized in a single node helper.

---

### Blueprint 2: Transactional Write Wrapper (`state.svelte.ts`)
Consolidate state persistence boilerplate into a single generalized runner function.

```typescript
/**
 * Safely executes a schema-changing write operation with unified FSM state management and file writing.
 */
private async executeSchemaMutation(
  operationName: string,
  mutateFn: (code: string) => string
): Promise<void> {
  if (!this.filePath) return;
  this.machine.send("SAVE");
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const newCode = mutateFn(this.rawCode);
    
    await writeTextFile(this.filePath, newCode);
    await this.syncWithFile();
    this.machine.send("SAVE_SUCCESS");
  } catch (e: any) {
    console.error(`[Strata] ${operationName} failed:`, e);
    this.error = e.message;
    this.errorType = 'disk';
    this.machine.send("SAVE_ERROR");
  }
}
```

**Refactored State Methods:**
```typescript
async deleteColumn(tableName: string, colName: string) {
  const { removeColumnFromSchema } = await import("./parser");
  await this.executeSchemaMutation("Delete Column", (code) => 
    removeColumnFromSchema(code, tableName, colName)
  );
}

async renameTable(oldName: string, newName: string) {
  const { renameTableInSchema } = await import("./parser");
  await this.executeSchemaMutation("Rename Table", (code) => 
    renameTableInSchema(code, oldName, newName)
  );
}
```
**Impact:** Drops code size in `state.svelte.ts` by roughly 60 lines. Unifies all writes under a single transactional pipeline, making it trivial to add new visual operations safely.

---

### Blueprint 3: Platform Service Adapter Pattern
Currently, imports like `import { open } from "@tauri-apps/plugin-dialog"` are coupled inside components. Creating a simple `PlatformService` class isolates Tauri specifics:

```typescript
// src/lib/services/platform.ts
export class PlatformService {
  static async readText(path: string): Promise<string> {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return readTextFile(path);
  }
  static async selectFile(extensions: string[]): Promise<string | null> {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "Files", extensions }],
    });
    return typeof selected === "string" ? selected : null;
  }
}
```
**Impact:** Allows mocks for browser and test runs to be injected instantly, enabling the visual and code workspaces to run in a standard web browser (with local storage / mock FS fallback) without requiring Tauri mock wrappers.
