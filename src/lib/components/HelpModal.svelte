<script lang="ts">
  import {
    X,
    Share2,
    Sparkles,
    RefreshCw,
    Database,
    Cpu,
    Zap,
    BookOpen,
    Check,
    FingerprintPattern,
  } from "lucide-svelte";
  import { fade } from "svelte/transition";

  let { show = $bindable(false) } = $props();
  let activeTab = $state("sync");

  const tabs = [
    { id: "sync", label: "Sync Engine", icon: RefreshCw },
    { id: "targets", label: "Storage Targets", icon: Database },
    { id: "relations", label: "Smart Relations", icon: Share2 },
    { id: "imports", label: "External Schemas", icon: FingerprintPattern },
    { id: "ai", label: "AI Integration", icon: Sparkles },
  ];

  let copied = $state(false);

  const aiPrompt = `You are an expert software architect specialized in Drizzle ORM and Cloudflare D1 (SQLite dialect).
We are using Strata, an interactive ERD tool that parses our \`schema.ts\` file.

You MUST follow these design & layout rules when writing or modifying Drizzle schema code for me:

1. AESTHETICS & METADATA: Every table or collection declaration MUST be preceded by a standard JSDoc comment containing Strata visual coordinates. Do NOT strip or omit these:
   /**
    * @strata { "target": "d1" | "do" | "kv", "x": number, "y": number }
    */

2. GRID LAYOUT: Pre-calculate visual layout positions (x, y coordinates) for new tables. Space them out logically (e.g. 400px apart horizontally, 300px apart vertically) to avoid overlaps.

3. DATATYPES (Cloudflare D1 / SQLite):
   - SQLite does not have a native Date type. Always map dates using:
     integer("column_name", { mode: "timestamp" }) or integer("column_name", { mode: "timestamp_ms" })
   - Ensure all column constraints match Drizzle core SQLite capabilities.

4. RELATIONSHIPS:
   - Physical foreign keys: Use inline \`.references()\` declarations (renders as solid lines on diagram).
     Example: authorId: integer("author_id").references(() => users.id, { onDelete: "cascade" })
   - Logical relations: Use Drizzle's \`relations()\` query-builder api (renders as dashed lines on diagram). Ensure they follow the naming standard \`\${tableName}Relations\`.
     Example: export const postsRelations = relations(posts, ({ one }) => ({ author: one(users, { fields: [posts.authorId], references: [users.id] }) }))`;

  function copyPrompt() {
    navigator.clipboard.writeText(aiPrompt).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }
</script>

{#if show}
  <!-- Backdrop Overlay -->
  <div
    class="fixed inset-0 z-100 bg-base-900/60 backdrop-blur-[2px] transition-all duration-300"
    role="button"
    tabindex="0"
    onclick={() => (show = false)}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        show = false;
      }
    }}
    aria-label="Close guide"
  ></div>

  <!-- Modal Wrapper -->
  <div
    class="fixed inset-0 z-100 flex items-center justify-center p-4 pointer-events-none"
  >
    <!-- Modal Container -->
    <div
      class="bg-base-100 w-full max-w-3xl rounded-4xl shadow-2xl border border-base-300 overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] pointer-events-auto"
      data-testid="help-modal"
    >
      <!-- Header -->
      <div
        class="px-8 py-6 border-b border-base-200 flex items-center justify-between bg-linear-to-r from-base-100 to-base-200/50"
      >
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary/10 rounded-2xl shadow-inner">
            <BookOpen class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight">
              Strata Guide & Blueprint
            </h2>
            <p
              class="text-[10px] uppercase font-black tracking-widest opacity-40"
            >
              Making it easier to visualize your cloudflare applications
            </p>
          </div>
        </div>
        <button
          class="btn btn-ghost btn-circle btn-sm hover:bg-base-200"
          onclick={() => (show = false)}
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content Area with Sidebar Tabs -->
      <div class="flex flex-1 overflow-hidden min-h-[450px]">
        <!-- Sidebar Navigation -->
        <div
          class="w-1/3 bg-base-200/50 border-r border-base-200 p-4 flex flex-col gap-1.5 overflow-y-auto"
        >
          <span
            class="text-[9px] uppercase tracking-widest font-black opacity-30 px-3 mb-2"
            >Documentation</span
          >
          {#each tabs as tab (tab.id)}
            <button
              class="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left font-bold text-xs group relative {activeTab ===
              tab.id
                ? 'bg-primary text-primary-content shadow-lg shadow-primary/20 scale-[1.02]'
                : 'hover:bg-base-200 text-base-content/60 hover:text-base-content'}"
              onclick={() => (activeTab = tab.id)}
            >
              <tab.icon
                class="w-4 h-4 transition-transform group-hover:scale-110"
              />
              <span>{tab.label}</span>
              {#if activeTab === tab.id}
                <div
                  class="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse"
                ></div>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Tab Content View -->
        <div class="w-2/3 p-8 overflow-y-auto flex flex-col gap-4 bg-base-100">
          {#if activeTab === "sync"}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-primary/10 rounded-xl text-primary">
                  <RefreshCw class="w-4 h-4" />
                </div>
                <h3 class="font-bold text-sm text-base-content">
                  Code ⇄ UI Bi-directional Sync
                </h3>
              </div>
              <p class="text-xs leading-relaxed text-base-content/70">
                Strata has **no internal database or sidecar JSON files**. Your
                TypeScript <code
                  class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px] text-primary"
                  >schema.ts</code
                > file is the absolute, single source of truth.
              </p>

              <!-- Conceptual Flow Diagram -->
              <div
                class="bg-base-200/80 rounded-2xl p-4 border border-base-300 flex flex-col gap-2"
              >
                <span
                  class="text-[9px] font-black uppercase tracking-widest opacity-40"
                  >System Architecture</span
                >
                <div
                  class="flex items-center justify-between text-center gap-2"
                >
                  <div
                    class="flex-1 bg-base-100 border border-base-300 py-2.5 rounded-xl"
                  >
                    <span
                      class="font-mono text-[10px] font-bold text-base-content/70 block"
                      >1. Code Edit</span
                    >
                    <span class="text-[8px] opacity-40">VS Code or Editor</span>
                  </div>
                  <span class="text-primary font-bold animate-pulse text-xs"
                    >➔</span
                  >
                  <div
                    class="flex-1 bg-base-100 border border-primary/20 py-2.5 rounded-xl"
                  >
                    <span class="font-mono text-[10px] font-bold block"
                      >2. AST Parser</span
                    >
                    <span class="text-[8px] opacity-50 text-primary/70"
                      >ts-morph Analysis</span
                    >
                  </div>
                  <span class="text-primary font-bold animate-pulse text-xs"
                    >➔</span
                  >
                  <div
                    class="flex-1 bg-base-100 border border-base-300 py-2.5 rounded-xl"
                  >
                    <span
                      class="font-mono text-[10px] font-bold text-base-content/70 block"
                      >3. ERD Diagram</span
                    >
                    <span class="text-[8px] opacity-40">Interactive Canvas</span
                    >
                  </div>
                </div>
              </div>

              <div
                class="text-xs leading-relaxed text-base-content/70 flex flex-col gap-2"
              >
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Instant Code Sync:</strong> Every visual interaction
                    (such as dragging nodes, adding columns, or forging relationships)
                    triggers surgical AST editing that patches the file on disk.</span
                  >
                </div>
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Live File Watcher:</strong> When you save changes externally
                    (e.g. in your favorite IDE), Strata's native OS file watcher
                    detects it, re-parses the file, and reflects the updates on the
                    canvas instantly.</span
                  >
                </div>
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Node Inspector:</strong> Double-click any table node
                    on the canvas to open the sidebar Inspector, where you can rename
                    the table, add/remove fields, customize keys, or manage relations.</span
                  >
                </div>
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Canvas Navigation:</strong> Designed for both mouse
                    and trackpads:
                    <ul
                      class="list-disc pl-4 mt-1 flex flex-col gap-1 text-[11px] opacity-90"
                    >
                      <li>
                        <strong>Trackpad:</strong> Swipe with two fingers to pan
                        in any direction. Pinch to zoom in/out.
                      </li>
                      <li>
                        <strong>Mouse:</strong> Hold Right-Click or Middle-Click
                        and drag to pan. Hold
                        <code
                          class="bg-base-200 px-1 py-0.5 rounded font-mono text-[9px]"
                          >Ctrl</code
                        >
                        /
                        <code
                          class="bg-base-200 px-1 py-0.5 rounded font-mono text-[9px]"
                          >Cmd</code
                        > and scroll the wheel to zoom.
                      </li>
                    </ul>
                  </span>
                </div>
              </div>
            </div>
          {/if}

          {#if activeTab === "targets"}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-primary/10 rounded-xl text-primary">
                  <Database class="w-4 h-4" />
                </div>
                <h3 class="font-bold text-sm text-base-content">
                  Storage Targets & metadata
                </h3>
              </div>
              <p class="text-xs leading-relaxed text-base-content/70">
                Strata adapts its visuals, badges, and code generation based on
                the targeted database architecture specified in your table's
                JSDoc metadata.
              </p>

              <!-- Target Type Cards -->
              <div class="grid grid-cols-3 gap-3">
                <div
                  class="bg-base-200 border-t-4 border-primary p-3 rounded-xl flex flex-col gap-1.5"
                >
                  <div class="flex items-center gap-1.5 text-primary">
                    <Database class="w-3.5 h-3.5" />
                    <span class="font-bold text-[10px] uppercase tracking-wider"
                      >Cloudflare D1</span
                    >
                  </div>
                  <p class="text-[9px] opacity-60 leading-normal">
                    Standard SQLite relational tables for edge scale SQL
                    databases.
                  </p>
                </div>

                <div
                  class="bg-base-200 border-t-4 border-secondary p-3 rounded-xl flex flex-col gap-1.5"
                >
                  <div class="flex items-center gap-1.5 text-secondary">
                    <Cpu class="w-3.5 h-3.5" />
                    <span class="font-bold text-[10px] uppercase tracking-wider"
                      >Durable Obj</span
                    >
                  </div>
                  <p class="text-[9px] opacity-60 leading-normal">
                    SQLite storage blocks embedded within stateful Durable
                    Objects.
                  </p>
                </div>

                <div
                  class="bg-base-200 border-t-4 border-accent p-3 rounded-xl flex flex-col gap-1.5"
                >
                  <div class="flex items-center gap-1.5 text-accent">
                    <Zap class="w-3.5 h-3.5" />
                    <span class="font-bold text-[10px] uppercase tracking-wider"
                      >KV Store</span
                    >
                  </div>
                  <p class="text-[9px] opacity-60 leading-normal">
                    Key-Value representations for high performance caching.
                  </p>
                </div>
              </div>

              <!-- Code block JSDoc -->
              <div class="flex flex-col gap-1.5">
                <span
                  class="text-[9px] font-black uppercase tracking-widest opacity-40"
                  >JSDoc Metadata Syntax</span
                >
                <pre
                  class="bg-neutral text-neutral-content p-4 rounded-2xl text-[10px] font-mono leading-relaxed overflow-x-auto border border-white/5">
<span class="text-success"
                    >/**
 * @strata &#123; "target": "d1", "x": 150, "y": 300 &#125;
 */</span
                  >
<span class="text-primary">export const</span> users = sqliteTable(<span
                    class="text-warning">"users"</span
                  >, &#123;
  id: integer(<span class="text-warning">"id"</span>).primaryKey(),
&#125;);</pre>
              </div>
            </div>
          {/if}

          {#if activeTab === "relations"}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-primary/10 rounded-xl text-primary">
                  <Share2 class="w-4 h-4" />
                </div>
                <h3 class="font-bold text-sm text-base-content">
                  Physical & Logical Relationships
                </h3>
              </div>
              <p class="text-xs leading-relaxed text-base-content/70">
                Strata supports two types of relationships between your schema
                tables, visualised differently to represent physical constraints
                vs logical connections.
              </p>

              <!-- Connection Types Grid -->
              <div class="flex flex-col gap-3">
                <div
                  class="flex items-center gap-4 bg-base-200/60 p-3 rounded-2xl border border-base-300"
                >
                  <div
                    class="w-20 shrink-0 text-center font-bold text-[10px] uppercase bg-primary/10 text-primary px-2 py-1 rounded-lg border border-primary/20"
                  >
                    Solid Line
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-xs"
                      >Physical Foreign Key Constraint</span
                    >
                    <span class="text-[10px] opacity-60"
                      >Created in code via `.references(() => parentTable.id)`.
                      Enforces absolute relational integrity in the SQLite
                      engine.</span
                    >
                  </div>
                </div>

                <div
                  class="flex items-center gap-4 bg-base-200/60 p-3 rounded-2xl border border-base-300"
                >
                  <div
                    class="w-20 shrink-0 text-center font-bold text-[10px] uppercase bg-secondary/10 text-secondary px-2 py-1 rounded-lg border border-secondary/20 border-dashed"
                  >
                    Dashed Line
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-xs"
                      >Logical Drizzle Relation block</span
                    >
                    <span class="text-[10px] opacity-60 font-medium"
                      >Created in code via Drizzle's `relations()` API. Used to
                      make relational querying simple and fluid in your TS
                      queries.</span
                    >
                  </div>
                </div>

                <div
                  class="flex items-center gap-4 bg-base-200/60 p-3 rounded-2xl border border-base-300"
                >
                  <div
                    class="w-20 shrink-0 text-center font-bold text-[10px] uppercase bg-base-300 text-base-content/70 px-2 py-1 rounded-lg border border-base-400"
                  >
                    Arrowhead
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-xs"
                      >Dependency / Cardinality Direction</span
                    >
                    <span class="text-[10px] opacity-60 font-medium"
                      >A closed arrowhead points from the Child table
                      (possessing the Foreign Key) to the Parent table (One
                      side). This establishes relationship flows instantly.</span
                    >
                  </div>
                </div>
              </div>

              <!-- Drag Forge Guide -->
              <div
                class="flex gap-3 bg-linear-to-r from-primary/5 to-base-100 border border-primary/10 rounded-2xl p-4 items-center"
              >
                <div class="p-2 bg-primary/10 rounded-xl text-primary">
                  <Share2 class="w-5 h-5 animate-pulse" />
                </div>
                <div class="flex flex-col">
                  <span class="font-bold text-xs text-base-content"
                    >Visual Drag-and-Drop Forging</span
                  >
                  <span class="text-[11px] opacity-70 mt-0.5 leading-normal"
                    >Drag an edge line from a **source handle** (right dot) of a
                    table to the **target handle** (left dot) of another. Strata
                    will automatically generate and inject the corresponding
                    relationship blocks directly into your source code!</span
                  >
                </div>
              </div>

              <!-- Synthetic JSDoc Connections -->
              <div
                class="flex flex-col gap-2 bg-base-200/40 border border-base-300 rounded-2xl p-4"
              >
                <div class="flex items-center gap-2 text-secondary">
                  <Zap class="w-4 h-4" />
                  <span class="font-bold text-xs"
                    >Synthetic JSDoc Connections</span
                  >
                </div>
                <p class="text-[11px] opacity-70 leading-relaxed">
                  When establishing relations involving non-relational storage
                  targets (like Key-Value namespaces or Durable Objects),
                  standard SQL foreign keys are not available. Strata handles
                  this by saving the relation directly inside your entity's
                  JSDoc metadata under the <code
                    class="bg-base-300 px-1 py-0.5 rounded text-[10px] font-mono"
                    >relations</code
                  > key:
                </p>
                <pre
                  class="bg-neutral text-neutral-content p-3.5 rounded-xl text-[9px] font-mono leading-relaxed overflow-x-auto border border-white/5 mt-1">
<span class="text-success"
                    >/**
 * @strata &#123; "target": "kv", "relations": [&#123;"to": "users"&#125;] &#125;
 */</span
                  ></pre>
                <p class="text-[10px] opacity-50 leading-relaxed">
                  These connections render on your visual canvas as dashed
                  lines, but have **zero compilation or runtime overhead** on
                  your database engine.
                </p>
              </div>
            </div>
          {/if}

          {#if activeTab === "imports"}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-primary/10 rounded-xl text-primary">
                  <FingerprintPattern class="w-4 h-4" />
                </div>
                <h3 class="font-bold text-sm text-base-content">
                  Better Auth & External Schema Imports
                </h3>
              </div>
              <p class="text-xs leading-relaxed text-base-content/70">
                Modern architectures often decouple schemas. For instance,
                **Better Auth** automatically generates its own authentication
                schema (e.g. <code
                  class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px] text-primary"
                  >auth.schema.ts</code
                >) containing the
                <code
                  class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px]"
                  >user</code
                >,
                <code
                  class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px]"
                  >session</code
                >, or
                <code
                  class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px]"
                  >account</code
                > tables.
              </p>

              <div
                class="bg-base-200/50 rounded-2xl p-4 border border-base-300 flex flex-col gap-2"
              >
                <span
                  class="text-[9px] font-black uppercase tracking-widest opacity-40"
                  >Visualizing Decoupled Tables</span
                >
                <p class="text-[11px] opacity-70 leading-relaxed">
                  Strata dynamically resolves external schema imports declared
                  in your main schema file:
                </p>
                <pre
                  class="bg-neutral text-neutral-content p-3.5 rounded-xl text-[9px] font-mono leading-relaxed overflow-x-auto border border-white/5">
<span class="text-secondary">import</span> &#123; user &#125; <span
                    class="text-secondary">from</span
                  > <span class="text-warning">"./auth.schema"</span>;

<span class="text-primary">export const</span> profile = sqliteTable(<span
                    class="text-warning">"profile"</span
                  >, &#123;
  userId: text(<span class="text-warning">"user_id"</span
                  >).references(() => user.id),
&#125;);</pre>
              </div>

              <div
                class="text-xs leading-relaxed text-base-content/70 flex flex-col gap-2"
              >
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Automatic Resolution:</strong> Strata parses imported
                    variables using `ts-morph` to traverse files and render external
                    tables as read-only nodes in your diagram.</span
                  >
                </div>
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Seamless Relationships:</strong> Draw or visualize foreign
                    keys referencing imported tables (like drawing a link from `profile`
                    to Better Auth's `user`). They render beautifully on the canvas.</span
                  >
                </div>
                <div class="flex gap-2">
                  <span class="text-primary font-bold">●</span>
                  <span
                    ><strong>Zero Mismatch:</strong> Coordinates for imported tables
                    are stored safely in local storage, preserving your visual layout
                    without altering external third-party files.</span
                  >
                </div>
              </div>
            </div>
          {/if}

          {#if activeTab === "ai"}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-primary/10 rounded-xl text-primary">
                  <Sparkles class="w-4 h-4" />
                </div>
                <h3 class="font-bold text-sm text-base-content">
                  AI-Driven Schema Architecting
                </h3>
              </div>
              <p class="text-xs leading-relaxed text-base-content/70">
                Strata is engineered to seamlessly integrate with LLM assistants
                (such as Claude, Gemini, or ChatGPT). You can pair program with
                your AI to design entire schemas, and the AI will auto-position
                tables visually!
              </p>

              <!-- Copy Prompt Panel -->
              <div
                class="flex items-center justify-between bg-base-200/50 p-4 rounded-2xl border border-base-300"
              >
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-xs">AI System Prompt</span>
                  <span class="text-[10px] opacity-60"
                    >Copy the fully optimized prompt for your LLM context</span
                  >
                </div>
                <button
                  class="btn btn-primary btn-sm rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-primary/10 transition-all active:scale-95"
                  onclick={copyPrompt}
                >
                  {#if copied}
                    <Check class="w-3.5 h-3.5" />
                    Copied!
                  {:else}
                    <span class="text-xs">Copy Prompt</span>
                  {/if}
                </button>
              </div>

              <!-- Instruction cards -->
              <div class="flex flex-col gap-3.5">
                <div class="flex gap-3">
                  <div
                    class="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center font-bold text-xs text-primary"
                  >
                    1
                  </div>
                  <div class="flex flex-col gap-0.5 grow">
                    <span class="font-bold text-xs"
                      >Feed the AI the Blueprint</span
                    >
                    <span class="text-[11px] opacity-65 leading-relaxed"
                      >Copy the prompt and paste it straight into your AI system
                      prompt or chat context.</span
                    >
                  </div>
                </div>

                <div class="flex gap-3">
                  <div
                    class="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center font-bold text-xs text-primary"
                  >
                    2
                  </div>
                  <div class="flex flex-col gap-0.5 grow">
                    <span class="font-bold text-xs"
                      >Prompt the AI to generate schemas</span
                    >
                    <span class="text-[11px] opacity-65 leading-relaxed"
                      >Ask the AI to design your features (e.g. "Add a billing
                      system with subscription tables"). The AI will output
                      standard Drizzle code containing pre-calculated `@strata`
                      coordinate coordinates.</span
                    >
                  </div>
                </div>

                <div class="flex gap-3">
                  <div
                    class="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center font-bold text-xs text-primary"
                  >
                    3
                  </div>
                  <div class="flex flex-col gap-0.5 grow">
                    <span class="font-bold text-xs"
                      >Paste and watch it mirror</span
                    >
                    <span class="text-[11px] opacity-65 leading-relaxed"
                      >Paste the generated Drizzle tables into your <code
                        class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px] text-primary"
                        >schema.ts</code
                      > file. The Svelte Flow diagram will immediately refresh and
                      display the beautifully structured layout in full!</span
                    >
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-8 py-5 bg-base-200/50 flex items-center justify-between border-t border-base-200"
      >
        <p class="text-[10px] font-bold opacity-30 tracking-wider font-mono">
          FORGED FOR CLOUDFLARE D1 + DRIZZLE ORM v0.45.2
        </p>
        <button
          class="btn btn-primary btn-sm px-6 rounded-xl shadow-lg shadow-primary/15 font-bold"
          onclick={() => (show = false)}
        >
          Acknowledge & Close
        </button>
      </div>
    </div>
  </div>
{/if}
