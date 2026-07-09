<!--
  HelpModal.svelte

  Summary: Complete Developer Help Center & Searchable Documentation for Strata.
  Expects: show bindable prop.
  Output: Searchable help guides, zero lock-in policies, achievements walkthrough, and AI prompts.
-->
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
    Search,
    HelpCircle,
    Info,
    AlertTriangle,
    HardDrive,
    History
  } from "lucide-svelte";
  import { fade } from "svelte/transition";

  let { show = $bindable(false) } = $props();

  let activeTab = $state("all");
  let searchQuery = $state("");
  let copied = $state(false);

  const categories = [
    { id: "all", label: "All Documentation", icon: BookOpen },
    { id: "getting-started", label: "Getting Started", icon: FingerprintPattern },
    { id: "cloudflare", label: "Cloudflare Bindings", icon: Database },
    { id: "relationships", label: "ERD Relationships", icon: Share2 },
    { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
    { id: "achievements", label: "Release Walkthrough", icon: History },
    { id: "ai", label: "AI Co-Design Prompt", icon: Sparkles }
  ];

  interface DocTopic {
    id: string;
    title: string;
    category: string;
    tags: string[];
    summary: string;
    content: string;
  }

  const docTopics: DocTopic[] = [
    {
      id: "onboarding-policy",
      category: "getting-started",
      title: "Capabilities & Live Visual Mapping",
      tags: ["onboarding", "sync", "ast", "watch", "start"],
      summary: "Strata is an interactive ERD tool for Drizzle + Cloudflare. We parse schema.ts variables and render them as custom database nodes.",
      content: `<p class="mb-2">Strata reads your codebase as the absolute single source of truth:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Bi-directional Sync:</strong> Visual edits trigger AST updates to your TypeScript files.</li>
                  <li><strong>Live File Watcher:</strong> Saving schemas in external IDEs updates the ERD canvas instantly.</li>
                  <li><strong>Tauri Desktop Integration:</strong> Works locally in your filesystem with native write permissions.</li>
                </ul>`
    },
    {
      id: "offboarding-policy",
      category: "getting-started",
      title: "Lock-in Free Offboarding Guarantee",
      tags: ["offboarding", "lockin", "jsdoc", "clean", "walk"],
      summary: "Strata leaves no proprietary databases or JSON sidecars in your workspace. You can walk away at any time.",
      content: `<p class="mb-2">We respect your engineering intelligence. All metadata is stored exclusively in standard JSDoc tags:</p>
                <pre class="bg-neutral p-3 rounded-lg text-neutral-content font-mono text-[10px] my-2">
/** @strata { "target": "d1", "x": 100, "y": 200 } */
export const users = sqliteTable("users", {});</pre>
                <p>If you stop using Strata, your schema remains 100% standard Drizzle code. You can strip the comments or keep them—zero locked configurations, zero dependencies.</p>`
    },
    {
      id: "wrangler-sync",
      category: "cloudflare",
      title: "Wrangler Configuration Binding Sync",
      tags: ["wrangler", "toml", "json", "jsonc", "sync"],
      summary: "Visual modifications to KV, DO, or R2 targets automatically synchronize configuration parameters back to Wrangler configs.",
      content: `<p class="mb-2">Adding, deleting, or renaming non-D1 targets updates configurations in real-time:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>TOML Mutator:</strong> Surgically edits wrangler.toml headers while preserving comments.</li>
                  <li><strong>JSON/JSONC Mutator:</strong> Formats bindings safely without structural breakage.</li>
                  <li><strong>Path Auto-Detection:</strong> Scans up to 12 parent levels to identify config locations.</li>
                </ul>`
    },
    {
      id: "durable-objects",
      category: "cloudflare",
      title: "Stateful Durable Objects Class Mutations",
      tags: ["durable", "objects", "class", "methods", "do"],
      summary: "Visual Durable Object public method edits rewrite the underlying TS class declaration files.",
      content: `<p class="mb-2">Strata bridges the gap between database schema and method routing:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>External Class Mutation:</strong> Modifying methods in DO canvas cards directly patches external class declarations (declared via <code>strata.path</code>).</li>
                  <li><strong>Local JSDoc Fallbacks:</strong> If class files are omitted, method states fall back to JSDoc comments.</li>
                  <li><strong>DO Method Builder:</strong> Interactive public method builders displaying names, params, and DO return types (e.g. <code>Promise&lt;string&gt;</code>).</li>
                </ul>`
    },
    {
      id: "kv-namespaces",
      category: "cloudflare",
      title: "KV Namespace Static Registry Mode",
      tags: ["kv", "keys", "expiration", "ttl", "metadata"],
      summary: "Allows modeling key-value namespaces with custom data-type assertions, custom Expirations, and metadata fields.",
      content: `<p class="mb-2">Provides database-like visual inspector structures over flat key stores:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Advanced Inspector:</strong> Define key data-types (String, Number, Boolean, or Any).</li>
                  <li><strong>Expiration Limits:</strong> Assign custom Expiration TTL limits (minimum 60 seconds).</li>
                  <li><strong>Badges:</strong> Visual pills showing expirations and metadata strings per row.</li>
                </ul>`
    },
    {
      id: "r2-buckets",
      category: "cloudflare",
      title: "R2 Bucket Configuration Settings",
      tags: ["r2", "bucket", "public", "cors", "domain"],
      summary: "Model storage folders and edit access control settings (Public, CORS, Domains) visually.",
      content: `<p class="mb-2">Visualize R2 buckets with comprehensive config drawers:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Public access:</strong> Toggles bucket visibility directly.</li>
                  <li><strong>Custom domains:</strong> Routable text inputs for public domain endpoints.</li>
                  <li><strong>CORS policies:</strong> Toggles Cross-Origin Resource Sharing.</li>
                  <li><strong>Directories:</strong> List folders mapped to specific MIME-type filters.</li>
                </ul>`
    },
    {
      id: "erd-relationships",
      category: "relationships",
      title: "Physical vs Logical Relationships",
      tags: ["relations", "cardinality", "foreign", "keys"],
      summary: "Understand differences between solid SQLite foreign key lines and dashed logical relationships.",
      content: `<p class="mb-2">Strata displays relationship lines based on database structure:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Solid Lines (FK):</strong> Extracted from SQLite <code>.references()</code> rules. Enforces engine constraint validation.</li>
                  <li><strong>Dashed Lines (Relations):</strong> Modeled from Drizzle's logical <code>relations()</code> API queries.</li>
                  <li><strong>Directional Arrowheads:</strong> Points from the Child table (has the key) to the Parent table (One side).</li>
                </ul>`
    },
    {
      id: "synthetic-relations",
      category: "relationships",
      title: "Synthetic JSDoc Cross-Storage Relationships",
      tags: ["synthetic", "jsdoc", "relations", "cross"],
      summary: "Map connections between D1 tables and KV, DO, or R2 targets without database engine overhead.",
      content: `<p class="mb-2">Allows bridging SQL records to Cloudflare storage bindings:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Zero Overhead:</strong> Saves connections in table JSDoc metadata <code>relations</code> array.</li>
                  <li><strong>Dashed Rendering:</strong> Display logical paths across databases and file binders visually.</li>
                  <li><strong>Resolver Hooks:</strong> Bridges targets type-safely during application execution.</li>
                </ul>`
    },
    {
      id: "syntax-errors",
      category: "troubleshooting",
      title: "Resolving Syntax & Parsing Failures",
      tags: ["error", "parse", "syntax", "tsmorph", "fail"],
      summary: "Steps to fix errors when the parser blocks workspace synchronization due to invalid TypeScript code.",
      content: `<p class="mb-2">If Strata shows parse errors after editing code in the code tab:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li>Ensure all typescript imports (e.g. from <code>drizzle-orm/sqlite-core</code>) are valid.</li>
                  <li>Look at the parse failure console logs or toast warning messages for line/column highlights.</li>
                  <li>Check that braces, commas, and parentheses are closed in variable declarations.</li>
                </ul>`
    },
    {
      id: "relation-warnings",
      category: "troubleshooting",
      title: "Resolving Target Mismatch Warnings",
      tags: ["warning", "target", "relations", "missing"],
      summary: "How to fix synthetic target warning flags when a relation references a node variable that has been deleted or renamed.",
      content: `<p class="mb-2">If you see warnings about missing synthetic relationship targets:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li>Open the JSDoc of the warning table.</li>
                  <li>Verify that <code>strata.relations</code> targets point to exact, case-sensitive variable names existing in the diagram.</li>
                  <li>Update the target <code>to</code> key if the related KV, DO, or R2 table has been renamed.</li>
                </ul>`
    },
    {
      id: "kv-ttl-guard",
      category: "troubleshooting",
      title: "KV Expiration TTL Restrictions",
      tags: ["kv", "ttl", "guard", "limit", "time"],
      summary: "Addresses Cloudflare's mandatory minimum of 60 seconds for expiration values to prevent deploy-time validation errors.",
      content: `<p>Cloudflare KV requires any configured Expiration TTL values to be at least <strong>60 seconds</strong>. Strata's visual inspector implements client-side validation preventing values below 60s, keeping your configuration deployments clean.</p>`
    },
    {
      id: "ach-do-mutations",
      category: "achievements",
      title: "1. Durable Objects (DO) Mutation Support",
      tags: ["achievements", "durable", "objects", "ast"],
      summary: "Surgically edits external class declarations on disk via ts-morph AST, with local JSDoc fallbacks, DO public method forms, signatures, and return types.",
      content: `<p>Canvas updates to DO public methods edit either local schema JSDocs or the backing external TypeScript class declaration directly, parsing signatures and return signatures seamlessly.</p>`
    },
    {
      id: "ach-visual-overhaul",
      category: "achievements",
      title: "2. UI Layout & Terminology Refinement",
      tags: ["achievements", "ui", "collapsible", "wrangler", "detect"],
      summary: "Collapsible joint code/canvas splits, relocated action items, comment-stripped upward Wrangler directory scanners, and cleanup of marketing jargon.",
      content: `<p>Cleaner developer interface incorporating collapsible viewports, a comment-safe recursive parent-folder configuration scanner, and term cleanup replacing buzzwords with engineering terminology.</p>`
    },
    {
      id: "ach-wrangler-sync",
      category: "achievements",
      title: "3. Bi-directional Wrangler Config Sync",
      tags: ["achievements", "wrangler", "sync", "toml", "json"],
      summary: "Real-time updates of KV, DO, R2 canvas additions and deletions directly inside wrangler.toml and json files using block-preserving mutators.",
      content: `<p>Adding, deleting, or renaming non-D1 visual targets propagates parameter binding fields back to configurations in real-time, matching workspace settings automatically.</p>`
    },
    {
      id: "ach-kv-datatypes",
      category: "achievements",
      title: "4. KV Namespace Datatypes & Help Center",
      summary: "Advanced KV inspector drawers (types, TTL, metadata), custom badges, and detailed developer guide integrations.",
      tags: ["achievements", "kv", "inspector", "ttl"],
      content: `<p>Allows developers to enforce typed key-value structures, configure custom expirations, write descriptions, and display structured configurations instantly.</p>`
    },
    {
      id: "ach-relations-resolvers",
      category: "achievements",
      title: "5. Logical Relationship Validation & Resolvers",
      summary: "Adds synthetic target warning parsers and resolver.ts code generation to construct type-safe KV retrieval wrappers and Durable Object stub proxies.",
      tags: ["achievements", "relations", "resolvers", "generate"],
      content: `<p>Raises warnings for disconnected targets and builds resolvers next to schemas, generating typed getters and client class stubs with complete return parameters.</p>`
    },
    {
      id: "ach-r2-settings",
      category: "achievements",
      title: "6. R2 Bucket Configuration Settings",
      summary: "Bucket-level configuration controls (Public access, CORS, custom domain routing) updating target JSDoc comment tags selectively.",
      tags: ["achievements", "r2", "bucket", "cors", "public"],
      content: `<p>Introduces access control settings directly in the R2 inspector, updating underlying JSDocs without modifying files or directory configurations.</p>`
    }
  ];

  const aiPrompt = `You are an expert software architect specialized in Drizzle ORM and Cloudflare D1 (SQLite dialect).
We are using Strata, an interactive ERD tool that parses our \`schema.ts\` file.

You MUST follow these design & layout rules when writing or modifying Drizzle schema code for me:

1. AESTHETICS & METADATA: Every table or collection declaration MUST be preceded by a standard JSDoc comment containing Strata visual coordinates. Do NOT strip or omit these:
   /**
    * @strata { "target": "d1" | "do" | "kv" | "r2", "x": number, "y": number }
    */

2. GRID LAYOUT: Pre-calculate visual layout positions (x, y coordinates) for new tables. Space them out logically (e.g. 400px apart horizontally, 300px apart vertically) to avoid overlaps.

3. DATATYPES (Cloudflare D1 / SQLite):
   - SQLite does not have a native Date type. Always map dates using:
     integer("column_name", { mode: "timestamp" }) or integer("column_name", { mode: "timestamp_ms" })
   - Booleans must map to: integer("column_name", { mode: "boolean" })

4. STORAGE TARGETS (JSDoc overrides):
   - SQLite D1 database target is specified by: "target": "d1"
   - Durable Object targets are specified by: "target": "do". Specify methods using: /** @strata { "target": "do", "methods": ["methodName(arg: type): PromiseType"] } */
   - KV Namespace targets are specified by: "target": "kv". Specify key mappings via: /** @strata { "target": "kv", "schema": { "keyName": "type" | { "type": "type", "ttl": number, "metadata": "desc" } } } */
   - R2 Bucket targets are specified by: "target": "r2". Specify configurations and directories via: /** @strata { "target": "r2", "public": boolean, "customDomain": string, "cors": boolean, "folders": { "folderName": "mime/filter" } } */

5. SYNTHETIC RELATIONSHIPS:
   - If establishing relations involving KV, DO, or R2 targets, do not declare physical SQL foreign keys. Instead, specify logical connections inside the source entity JSDoc:
     /** @strata { "target": "d1", "relations": [{"to": "USERS_KV"}] } */

Generate only code inside standard markdown codeblocks without conversational fluff.`;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      console.error("[Strata] Clipboard write failed:", e);
    }
  }

  // Filter topics based on category tab & search query
  const filteredTopics = $derived(
    docTopics.filter((t) => {
      const matchesCategory = activeTab === "all" || t.category === activeTab;
      
      if (!searchQuery.trim()) {
        return matchesCategory;
      }

      const query = searchQuery.toLowerCase();
      const matchesText =
        t.title.toLowerCase().includes(query) ||
        t.summary.toLowerCase().includes(query) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query));

      return matchesText;
    })
  );

  function resetSearch() {
    searchQuery = "";
    activeTab = "all";
  }

  // Count topics helper for badges
  function getTopicCount(catId: string) {
    if (catId === "all") return docTopics.length;
    if (catId === "ai") return 1;
    return docTopics.filter((t) => t.category === catId).length;
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-6"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="bg-base-100 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl border border-base-300 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div
        class="px-8 py-5 bg-base-200/90 border-b border-base-300 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary/10 rounded-2xl text-primary">
            <HelpCircle class="w-5 h-5" />
          </div>
          <div>
            <h2 class="font-black text-base text-base-content tracking-wide uppercase">
              Developer Help Center
            </h2>
            <p class="text-[10px] opacity-50 font-medium mt-0.5 leading-none">
              Onboarding, Cloudflare storage targets, troubleshooting, and syntax guides.
            </p>
          </div>
        </div>

        <button
          class="btn btn-ghost btn-sm btn-circle text-base-content/65 hover:text-base-content hover:bg-base-300 transition-colors"
          onclick={() => (show = false)}
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Search Box & Filter Tabs Layout -->
      <div class="px-8 py-3 bg-base-200/40 border-b border-base-300/60 flex items-center gap-4">
        <div class="relative grow">
          <Search class="absolute left-3 top-2.5 w-4 h-4 text-base-content/35" />
          <input
            type="text"
            placeholder="Search help topics, error messages, locks, expirations..."
            class="input input-sm input-bordered w-full pl-9 rounded-xl text-xs bg-base-100 focus:input-primary transition-all border-base-300/65"
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button
              class="absolute right-2.5 top-2 text-[10px] uppercase font-bold text-primary hover:text-primary-focus transition-colors"
              onclick={() => (searchQuery = "")}
            >
              clear
            </button>
          {/if}
        </div>
      </div>

      <!-- Main Layout -->
      <div class="flex grow overflow-hidden">
        <!-- Sidebar Navigation -->
        <div class="w-1/3 bg-base-200/50 border-r border-base-300/80 p-4 overflow-y-auto">
          <span class="text-[9px] font-black uppercase tracking-widest opacity-40 px-3 block mb-2">Categories</span>
          <ul class="space-y-1">
            {#each categories as cat}
              <li>
                <button
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-semibold group {activeTab === cat.id && !searchQuery
                    ? 'bg-primary text-primary-content shadow-lg shadow-primary/10'
                    : 'text-base-content/75 hover:bg-base-200'}"
                  onclick={() => {
                    activeTab = cat.id;
                    searchQuery = ""; // clear search when navigating tabs
                  }}
                >
                  <div class="flex items-center gap-2.5">
                    <cat.icon class="w-4 h-4 opacity-75 group-hover:scale-105 transition-transform" />
                    <span>{cat.label}</span>
                  </div>
                  <span class="badge badge-xs text-[9px] font-bold border-none {activeTab === cat.id && !searchQuery ? 'bg-primary-content/20 text-primary-content' : 'bg-base-300 text-base-content/60'}">
                    {getTopicCount(cat.id)}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>

        <!-- Help Documentation Content Area -->
        <div class="w-2/3 p-8 overflow-y-auto flex flex-col gap-5 bg-base-100">
          {#if searchQuery}
            <div class="flex items-center justify-between text-xs text-base-content/60 border-b border-base-200 pb-2">
              <span>Found <strong>{filteredTopics.length}</strong> matching results for "{searchQuery}"</span>
              <button class="text-primary font-bold hover:underline" onclick={resetSearch}>Reset</button>
            </div>
          {/if}

          <!-- Display topics lists -->
          {#each filteredTopics as topic (topic.id)}
            <div
              class="bg-base-200/40 border border-base-300/60 rounded-2xl p-5 flex flex-col gap-2 transition-all hover:border-base-300 hover:shadow-xs group/card"
              in:fade={{ duration: 150 }}
            >
              <div class="flex items-center justify-between">
                <h4 class="font-bold text-xs text-base-content group-hover/card:text-primary transition-colors flex items-center gap-1.5">
                  {#if topic.category === "troubleshooting"}
                    <AlertTriangle class="w-3.5 h-3.5 text-warning shrink-0" />
                  {:else if topic.category === "achievements"}
                    <History class="w-3.5 h-3.5 text-success shrink-0" />
                  {:else}
                    <Info class="w-3.5 h-3.5 text-primary shrink-0" />
                  {/if}
                  {topic.title}
                </h4>
                <span class="badge badge-outline badge-xs opacity-60 text-[9px] font-mono capitalize">
                  {topic.category.replace("-", " ")}
                </span>
              </div>
              <p class="text-xs text-base-content/80 font-medium leading-normal">
                {topic.summary}
              </p>
              <div class="text-[11px] leading-relaxed text-base-content/65 border-t border-base-300/40 pt-2 mt-1">
                {@html topic.content}
              </div>
            </div>
          {/each}

          <!-- Special interactive display for AI prompts tab -->
          {#if (activeTab === "ai" || searchQuery.toLowerCase().includes("ai") || searchQuery.toLowerCase().includes("prompt")) && filteredTopics.length > 0}
            <div
              class="bg-linear-to-r from-primary/5 to-base-100 border border-primary/10 rounded-2xl p-5 flex flex-col gap-3"
              in:fade={{ duration: 150 }}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Sparkles class="w-4 h-4 text-primary animate-pulse" />
                  <span class="font-bold text-xs">Copy AI Architect Prompt</span>
                </div>
                <button
                  class="btn btn-primary btn-xs rounded-lg font-bold flex items-center gap-1 hover:shadow-md transition-all active:scale-95"
                  onclick={copyPrompt}
                >
                  {#if copied}
                    <Check class="w-3 h-3" />
                    Copied!
                  {:else}
                    <span>Copy Prompt</span>
                  {/if}
                </button>
              </div>
              <p class="text-[11px] opacity-70 leading-relaxed">
                Feed this context template directly to Claude, GPT-4, or Gemini when prompt co-designing schemas. It teaches the AI how to automatically output Drizzle variables decorated with pre-calculated <code>@strata</code> layouts.
              </p>
              <pre class="bg-neutral text-neutral-content p-3.5 rounded-xl text-[9px] font-mono leading-relaxed overflow-x-auto border border-white/5 max-h-48 overflow-y-auto">
{aiPrompt}</pre>
            </div>
          {/if}

          {#if filteredTopics.length === 0}
            <div class="flex flex-col items-center justify-center gap-3 py-16 text-center animate-in fade-in duration-300">
              <div class="p-4 bg-base-200 rounded-full text-base-content/40">
                <Search class="w-8 h-8" />
              </div>
              <div>
                <h4 class="font-bold text-sm text-base-content">No documentation results found</h4>
                <p class="text-xs opacity-60 mt-1">We couldn't find anything matching your search term "{searchQuery}".</p>
              </div>
              <button class="btn btn-primary btn-sm rounded-xl px-5 font-bold mt-2" onclick={resetSearch}>
                Clear Search Query
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-8 py-5 bg-base-200/50 flex items-center justify-between border-t border-base-200"
      >
        <p class="text-[10px] font-bold opacity-30 tracking-wider font-mono">
          DESIGNED FOR DRIZZLE ORM + CLOUDFLARE BINDINGS ➔ ZERO LOCK-IN
        </p>
        <button
          class="btn btn-primary btn-sm px-6 rounded-xl shadow-lg shadow-primary/15 font-bold transition-all active:scale-95"
          onclick={() => (show = false)}
        >
          Acknowledge & Close
        </button>
      </div>
    </div>
  </div>
{/if}
