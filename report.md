# Strata Architectural Proposal: Cloudflare Storage & Code Modularization

This document outlines the design suggestions for elevating Cloudflare KV, Durable Objects (DO), and Storage Buckets (R2) to first-class citizens in Strata, alongside a concrete modularization blueprint to split the AST parser and state files.

---

## 1. Cloudflare KV, DO & R2 as First-Class Citizens

To make Strata a "no-brainer" visual design workspace for Cloudflare developers, we must treat non-relational storage products (KV, Durable Objects, R2) with the same visual and structural richness as D1 SQL tables.

### Key Visual & Schema Enhancements

| Storage Target | Visual Theme | Icon | Core "Schema" Concept |
| :--- | :--- | :--- | :--- |
| **D1 Database** | Primary (Blue/Indigo) | `Database` | SQL Columns (types, primary keys, foreign keys) |
| **KV Namespace** | Accent (Orange/Amber) | `Zap` | Key-Value schemas represented by TS Type/Interface fields |
| **Durable Objects**| Secondary (Purple) | `Cpu` | Stateful class APIs represented by public methods & storage state |
| **R2 Bucket** | Info (Teal/Cyan) | `Folder` | Bucket folder hierarchies, allowed MIME types, and rules |

---

## 2. Robust Path Resolution via JSDoc Metadata

Instead of forcing users to define all KV schemas, DO classes, and R2 structures in a single `schema.ts`, Strata will use JSDoc annotations to register external entities and point the parser to custom files. 

This approach is **non-intrusive**, works natively with typescript imports, and keeps the code compile-safe.

### Pointer Schema Configuration

We can represent bindings or definitions in the main `schema.ts` file as typed placeholders decorated with JSDoc metadata:

```typescript
/**
 * @strata {
 *   "target": "do",
 *   "name": "UserSessionDO",
 *   "class": "UserSession",
 *   "path": "./src/objects/UserSession.ts"
 * }
 */
export const userSessionDO = {};

/**
 * @strata {
 *   "target": "r2",
 *   "bucket": "avatars-bucket",
 *   "folders": {
 *     "avatars": "image/*",
 *     "thumbnails": "image/png"
 *   }
 * }
 */
export const avatarsBucket = {};
```

### Parsing Pipeline for Custom Pointers

When `parseSchema()` encounters a node with a defined `path` key:
1. **Resolve Absolute Path:** Resolve the path relative to the schema file using `PlatformService`.
2. **AST Reading:** Load the external file content into a temporary `ts-morph` SourceFile.
3. **Symbol Extraction:**
   - **For Durable Objects (`class`):** Parse the target class and extract its public methods. These methods will be rendered in the ERD as the "API interface" of that DO.
   - **For KV/R2 (`interface` / `type`):** Resolve the matching TS type/interface and extract its properties as the KV fields.

---

## 3. Parser Modularization Blueprint (`src/lib/parser/`)

To prevent `parser.ts` from ballooning further and to support new features (such as DO method scanning and R2 parsing), we propose splitting the parser into a dedicated module folder:

```
src/lib/parser/
├── index.ts           # Unified public API exports
├── types.ts           # Shared interfaces (ParseResult, etc.)
├── project.ts         # Singleton ts-morph Project & SourceFile sync
├── helpers.ts         # Pure AST traversal & matching utilities
├── core.ts            # Parser engine (parseSchema, extractColumns, extractRelations)
└── mutators.ts        # AST writer methods (addTable, addColumn, renameTable, etc.)
```

### Component Breakdown

#### A. `project.ts` (AST Lifecycle)
Manages the shared `ts-morph` project and files context, keeping incremental updates fast and memory footprint low.
```typescript
import { Project } from 'ts-morph';

export const project = new Project({ useInMemoryFileSystem: true });
export let sourceFile = project.createSourceFile('schema.ts', '');

export function syncSourceFile(code: string) {
  if (sourceFile.getFullText() !== code) {
    sourceFile.replaceWithText(code);
  }
  return sourceFile;
}
```

#### B. `helpers.ts` (AST Traverser)
Houses pure functions that query AST nodes without mutating them:
* `findSqliteTableCall(initializer)`
* `isDrizzleTableDeclaration(decl)`
* `parseColumnChain(node)`

#### C. `core.ts` (AST Reader)
Orchestrates reading schemas, mapping imports, and converting TS syntax into visual Svelte Flow nodes/edges.

#### D. `mutators.ts` (AST Writers)
Contains functions that perform mutations on the code. Splitting this allows developer workflows to expand (e.g. adding specialized mutators for KV namespace additions or Durable Object binding updates) without cluttering the parse engine.

---

## 4. State Management Modularization (`src/lib/state/`)

Similarly, `state.svelte.ts` can be split into a cleaner directory structure to decouple state representation, transitions, and the async filesystem operations:

```
src/lib/state/
├── index.ts           # Exports the global schemaState singleton
├── store.ts           # The reactive SchemaState class
├── fsm.ts             # Finite State Machine configuration (runed FSM)
└── queue.ts           # Operation queue utilities for sequence locking
```

---

## 5. UI Component Refactoring (`src/lib/components/`)

### Inspector Decoupling
`Inspector.svelte` currently handles visual fields, relation maps, and input validation schemas for all types. We suggest refactoring it by delegating layout to sub-inspectors:
* `src/lib/components/inspector/D1Inspector.svelte`
* `src/lib/components/inspector/KVInspector.svelte`
* `src/lib/components/inspector/DOInspector.svelte`
* `src/lib/components/inspector/R2Inspector.svelte`

### Form Isolation
Extract Valibot validations and DaisyUI forms into dedicated files:
* `src/lib/components/forms/NewEntityForm.svelte` (unifies add table, DO, KV, and R2)
* `src/lib/components/forms/AddFieldForm.svelte`
