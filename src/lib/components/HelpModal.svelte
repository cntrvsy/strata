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
    History,
    Braces,
    Wrench,
  } from "lucide-svelte";
  import { fade } from "svelte/transition";

  let { show = $bindable(false) } = $props();

  let activeTab = $state("all");
  let searchQuery = $state("");
  let copied = $state(false);

  // JSDoc Builder State
  let builderTarget = $state("d1");
  let builderX = $state(100);
  let builderY = $state(100);
  let builderD1Relations = $state("");
  let builderDOPath = $state("./src/do/UserDO.ts");
  let builderDOClass = $state("UserDO");
  let builderDOMethods = $state("login, logout");
  let builderKVMappings = $state("token:string, attempts:number");
  let builderR2Public = $state(false);
  let builderR2Cors = $state(false);
  let builderR2Folders = $state("avatars:image/*, files:application/pdf");
  let builderCopied = $state(false);

  // Validation Checkers
  const relationsError = $derived.by(() => {
    if (!builderD1Relations.trim()) return "";
    const items = builderD1Relations.split(",");
    for (const item of items) {
      const name = item.trim();
      if (name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return `"${name}" is not a valid alphanumeric target name.`;
      }
    }
    return "";
  });

  const kvError = $derived.by(() => {
    if (!builderKVMappings.trim()) return "";
    const items = builderKVMappings.split(",");
    const validTypes = ["string", "number", "boolean", "any"];
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (!trimmed.includes(":")) {
        return `Missing colon (key:type) in "${trimmed}".`;
      }
      const parts = trimmed.split(":");
      const key = parts[0].trim();
      const val = parts[1].trim();
      if (!key) return "Key name cannot be empty.";
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        return `Invalid key name "${key}".`;
      }
      if (val && !validTypes.includes(val.toLowerCase()) && !val.startsWith("{")) {
        return `Type "${val}" should be string, number, boolean, or any.`;
      }
    }
    return "";
  });

  const r2Error = $derived.by(() => {
    if (!builderR2Folders.trim()) return "";
    const items = builderR2Folders.split(",");
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (!trimmed.includes(":")) {
        return `Missing colon (folder:mime) in "${trimmed}".`;
      }
      const parts = trimmed.split(":");
      const key = parts[0].trim();
      if (!key) return "Folder name cannot be empty.";
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return `Invalid folder name "${key}".`;
      }
    }
    return "";
  });

  // Preset Loaders
  function loadSamplePreset() {
    if (builderTarget === "d1") {
      builderX = 120;
      builderY = 240;
      builderD1Relations = "USERS_KV, IMAGES_R2";
    } else if (builderTarget === "do") {
      builderX = 350;
      builderY = 150;
      builderDOPath = "./src/do/UserDO.ts";
      builderDOClass = "UserDO";
      builderDOMethods = "getUser(id: number): Promise<User>, saveUser(data: any): Promise<void>";
    } else if (builderTarget === "kv") {
      builderX = 580;
      builderY = 280;
      builderKVMappings = "sessionToken:string, failedAttempts:number, roles:any";
    } else if (builderTarget === "r2") {
      builderX = 200;
      builderY = 460;
      builderR2Public = true;
      builderR2Cors = true;
      builderR2Folders = "avatars:image/*, attachments:application/pdf";
    }
  }

  const generatedJSDoc = $derived.by(() => {
    const data: any = {
      target: builderTarget,
      x: Number(builderX) || 0,
      y: Number(builderY) || 0
    };

    if (builderTarget === "d1") {
      if (builderD1Relations.trim() && !relationsError) {
        data.relations = builderD1Relations
          .split(",")
          .map(r => ({ to: r.trim() }))
          .filter(r => r.to.length > 0);
      }
    } else if (builderTarget === "do") {
      data.path = builderDOPath.trim();
      data.class = builderDOClass.trim();
      if (builderDOMethods.trim()) {
        data.methods = builderDOMethods
          .split(",")
          .map(m => m.trim())
          .filter(m => m.length > 0);
      }
    } else if (builderTarget === "kv") {
      if (builderKVMappings.trim() && !kvError) {
        const schemaObj: any = {};
        builderKVMappings.split(",").forEach(item => {
          const parts = item.split(":");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts[1].trim();
            if (key) schemaObj[key] = val;
          }
        });
        if (Object.keys(schemaObj).length > 0) {
          data.schema = schemaObj;
        }
      }
    } else if (builderTarget === "r2") {
      data.public = !!builderR2Public;
      data.cors = !!builderR2Cors;
      if (builderR2Folders.trim() && !r2Error) {
        const foldersObj: any = {};
        builderR2Folders.split(",").forEach(item => {
          const parts = item.split(":");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts[1].trim();
            if (key) foldersObj[key] = val;
          }
        });
        if (Object.keys(foldersObj).length > 0) {
          data.folders = foldersObj;
        }
      }
    }

    return `/**\n * @strata ${JSON.stringify(data, null, 2).split('\n').join('\n * ')}\n */`;
  });

  async function copyBuilderJSDoc() {
    try {
      await navigator.clipboard.writeText(generatedJSDoc);
      builderCopied = true;
      setTimeout(() => (builderCopied = false), 2000);
    } catch (e) {
      console.error("[Strata] Builder copy failed:", e);
    }
  }

  const categories = [
    { id: "all", label: "All Documentation", icon: BookOpen },
    {
      id: "getting-started",
      label: "Getting Started",
      icon: FingerprintPattern,
    },
    { id: "cloudflare", label: "Cloudflare Bindings", icon: Database },
    { id: "relationships", label: "ERD Relationships", icon: Share2 },
    { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
    { id: "achievements", label: "Advanced Guides & Diagnostics", icon: History },
    { id: "gotchas", label: "Gotchas & Guardrails", icon: Cpu },
    { id: "ai", label: "AI Co-Design Prompt", icon: Sparkles },
    { id: "jsdoc-builder", label: "JSDoc Metadata Builder", icon: Braces },
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
      summary:
        "Strata is an interactive ERD tool for Drizzle + Cloudflare. We parse schema.ts variables and render them as custom database nodes.",
      content: `<p class="mb-2">Strata reads your codebase as the absolute single source of truth:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Bi-directional Sync:</strong> Visual edits trigger AST updates to your TypeScript files.</li>
                  <li><strong>Live File Watcher:</strong> Saving schemas in external IDEs updates the ERD canvas instantly.</li>
                  <li><strong>Tauri Desktop Integration:</strong> Works locally in your filesystem with native write permissions.</li>
                </ul>`,
    },
    {
      id: "bottombar-filters",
      category: "getting-started",
      title: "Bottom Bar & Interactive Filters",
      tags: ["bottombar", "stats", "filters", "coordinates", "d1", "do", "kv"],
      summary:
        "Use the interactive Bottom Bar to monitor workspace state, see node coordinates, and toggle schema filters.",
      content: `<p class="mb-2">The desktop-native Bottom Bar provides unified status indicators and view filters:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Active Filters:</strong> Click the <code>D1</code>, <code>DO</code>, or <code>KV</code> badges to isolate those node types on the canvas.</li>
                  <li><strong>Live Mirror Status:</strong> Hover over the connection status dot to view synchronization details.</li>
                  <li><strong>Detailed Metrics:</strong> Hover over the database counts to view a popover showing total entities, columns, relations, and node coordinates.</li>
                </ul>`,
    },
    {
      id: "offboarding-policy",
      category: "getting-started",
      title: "Lock-in Free Offboarding Guarantee",
      tags: ["offboarding", "lockin", "jsdoc", "clean", "walk"],
      summary:
        "Strata leaves no proprietary databases or JSON sidecars in your workspace. You can walk away at any time.",
      content: `<p class="mb-2">We respect your engineering intelligence. All metadata is stored exclusively in standard JSDoc tags:</p>
                <pre class="bg-neutral p-3 rounded-lg text-neutral-content font-mono text-[10px] my-2">
/** @strata { "target": "d1", "x": 100, "y": 200 } */
export const users = sqliteTable("users", {});</pre>
                <p>If you stop using Strata, your schema remains 100% standard Drizzle code. You can strip the comments or keep them—zero locked configurations, zero dependencies.</p>`,
    },
    {
      id: "tracking-entities",
      category: "getting-started",
      title: "How Strata Tracks Canvas Entities",
      tags: ["tracking", "ast", "jsdoc", "naming", "unique"],
      summary:
        "Strata does not generate artificial IDs; it maps @strata JSDoc blocks directly to your TypeScript variable declarations.",
      content: `<p class="mb-2">Strata tracks nodes and connections using the Abstract Syntax Tree (AST):</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Variable Names as IDs:</strong> The unique identifier is the variable name (e.g., <code>users</code> in <code>export const users = sqliteTable(...)</code>). Because variable names must be unique within a file, this acts as a robust natural ID.</li>
                  <li><strong>JSDoc Statement Binding:</strong> JSDocs are syntactically bound to the variable statement immediately following them. If you rename the variable, ts-morph updates all references, and the JSDoc metadata moves with it.</li>
                  <li><strong>No Sidecars:</strong> This design ensures zero hidden state, no UUID generation, and no proprietary JSON sidecars—your code remains the single source of truth.</li>
                </ul>`,
    },
    {
      id: "wrangler-sync",
      category: "cloudflare",
      title: "Wrangler Configuration Binding Sync",
      tags: ["wrangler", "toml", "json", "jsonc", "sync"],
      summary:
        "Visual modifications to KV, DO, or R2 targets automatically synchronize configuration parameters back to Wrangler configs.",
      content: `<p class="mb-2">Adding, deleting, or renaming non-D1 targets updates configurations in real-time:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>TOML Mutator:</strong> Surgically edits wrangler.toml headers while preserving comments.</li>
                  <li><strong>JSON/JSONC Mutator:</strong> Formats bindings safely without structural breakage.</li>
                  <li><strong>Path Auto-Detection:</strong> Scans up to 12 parent levels to identify config locations.</li>
                </ul>`,
    },
    {
      id: "durable-objects",
      category: "cloudflare",
      title: "Stateful Durable Objects Class Mutations",
      tags: ["durable", "objects", "class", "methods", "do"],
      summary:
        "Visual Durable Object public method edits rewrite the underlying TS class declaration files.",
      content: `<p class="mb-2">Strata bridges the gap between database schema and method routing:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>External Class Mutation:</strong> Modifying methods in DO canvas cards directly patches external class declarations (declared via <code>strata.path</code>).</li>
                  <li><strong>Local JSDoc Fallbacks:</strong> If class files are omitted, method states fall back to JSDoc comments.</li>
                  <li><strong>DO Method Builder:</strong> Interactive public method builders displaying names, params, and DO return types (e.g. <code>Promise&lt;string&gt;</code>).</li>
                </ul>`,
    },
    {
      id: "kv-namespaces",
      category: "cloudflare",
      title: "KV Namespace Static Registry Mode",
      tags: ["kv", "keys", "expiration", "ttl", "metadata"],
      summary:
        "Allows modeling key-value namespaces with custom data-type assertions, custom Expirations, and metadata fields.",
      content: `<p class="mb-2">Provides database-like visual inspector structures over flat key stores:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Advanced Inspector:</strong> Define key data-types (String, Number, Boolean, or Any).</li>
                  <li><strong>Expiration Limits:</strong> Assign custom Expiration TTL limits (minimum 60 seconds).</li>
                  <li><strong>Badges:</strong> Visual pills showing expirations and metadata strings per row.</li>
                </ul>`,
    },
    {
      id: "r2-buckets",
      category: "cloudflare",
      title: "R2 Bucket Configuration Settings",
      tags: ["r2", "bucket", "public", "cors", "domain"],
      summary:
        "Model storage folders and edit access control settings (Public, CORS, Domains) visually.",
      content: `<p class="mb-2">Visualize R2 buckets with comprehensive config drawers:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Public access:</strong> Toggles bucket visibility directly.</li>
                  <li><strong>Custom domains:</strong> Routable text inputs for public domain endpoints.</li>
                  <li><strong>CORS policies:</strong> Toggles Cross-Origin Resource Sharing.</li>
                  <li><strong>Directories:</strong> List folders mapped to specific MIME-type filters.</li>
-                </ul>`,
    },
    {
      id: "erd-relationships",
      category: "relationships",
      title: "Physical vs Logical Relationships",
      tags: ["relations", "cardinality", "foreign", "keys"],
      summary:
        "Understand differences between solid SQLite foreign key lines and dashed logical relationships.",
      content: `<p class="mb-2">Strata displays relationship lines based on database structure:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Solid Lines (FK):</strong> Extracted from SQLite <code>.references()</code> rules. Enforces engine constraint validation.</li>
                  <li><strong>Dashed Lines (Relations):</strong> Modeled from Drizzle's logical <code>relations()</code> API queries.</li>
                  <li><strong>Directional Arrowheads:</strong> Points from the Child table (has the key) to the Parent table (One side).</li>
                </ul>`,
    },
    {
      id: "synthetic-relations",
      category: "relationships",
      title: "Synthetic JSDoc Cross-Storage Relationships",
      tags: ["synthetic", "jsdoc", "relations", "cross"],
      summary:
        "Map connections between D1 tables and KV, DO, or R2 targets without database engine overhead.",
      content: `<p class="mb-2">Allows bridging SQL records to Cloudflare storage bindings:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Zero Overhead:</strong> Saves connections in table JSDoc metadata <code>relations</code> array.</li>
                  <li><strong>Dashed Rendering:</strong> Display logical paths across databases and file binders visually.</li>
                  <li><strong>Direct Binding Sync:</strong> Keeps your worker bindings in sync with schema declarations without boilerplate.</li>
                </ul>`,
    },
    {
      id: "syntax-errors",
      category: "troubleshooting",
      title: "Resolving Syntax & Parsing Failures",
      tags: ["error", "parse", "syntax", "tsmorph", "fail"],
      summary:
        "Steps to fix errors when the parser blocks workspace synchronization due to invalid TypeScript code.",
      content: `<p class="mb-2">If Strata shows parse errors after editing code in the code tab:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li>Ensure all typescript imports (e.g. from <code>drizzle-orm/sqlite-core</code>) are valid.</li>
                  <li>Look at the parse failure console logs or toast warning messages for line/column highlights.</li>
                  <li>Check that braces, commas, and parentheses are closed in variable declarations.</li>
                </ul>`,
    },
    {
      id: "relation-warnings",
      category: "troubleshooting",
      title: "Resolving Target Mismatch Warnings",
      tags: ["warning", "target", "relations", "missing"],
      summary:
        "How to fix synthetic target warning flags when a relation references a node variable that has been deleted or renamed.",
      content: `<p class="mb-2">If you see warnings about missing synthetic relationship targets:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li>Open the JSDoc of the warning table.</li>
                  <li>Verify that <code>strata.relations</code> targets point to exact, case-sensitive variable names existing in the diagram.</li>
                  <li>Update the target <code>to</code> key if the related KV, DO, or R2 table has been renamed.</li>
                </ul>`,
    },
    {
      id: "kv-ttl-guard",
      category: "troubleshooting",
      title: "KV Expiration TTL Restrictions",
      tags: ["kv", "ttl", "guard", "limit", "time"],
      summary:
        "Addresses Cloudflare's mandatory minimum of 60 seconds for expiration values to prevent deploy-time validation errors.",
      content: `<p>Cloudflare KV requires any configured Expiration TTL values to be at least <strong>60 seconds</strong>. Strata's visual inspector implements client-side validation preventing values below 60s, keeping your configuration deployments clean.</p>`,
    },
    {
      id: "ach-do-mutations",
      category: "achievements",
      title: "Durable Object AST Mutation Diagnostics",
      tags: ["achievements", "durable", "objects", "ast", "diagnostics", "debug"],
      summary:
        "Guidelines on how visual Durable Object methods write back to disk, and how to troubleshoot write/AST parse failures.",
      content: `<p class="mb-2">Durable Object cards edit either local schema JSDocs or the backing external TypeScript class directly:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>AST Compilation:</strong> Writes are parsed using <code>ts-morph</code>. If the backing file contains syntax syntax errors, writes will be blocked to prevent file corruption.</li>
                  <li><strong>Troubleshooting path issues:</strong> Ensure the <code>strata.path</code> parameter inside the DO's JSDoc contains a valid, writable path relative to the workspace root.</li>
                  <li><strong>Method mismatch:</strong> Verify public method names do not conflict with existing standard lifecycle methods (e.g., <code>fetch()</code> or <code>alarm()</code>).</li>
                </ul>`,
    },
    {
      id: "ach-visual-overhaul",
      category: "achievements",
      title: "Recursive Wrangler Config Discovery Guidelines",
      tags: ["achievements", "ui", "wrangler", "detect", "parent", "folders"],
      summary:
        "Learn how Strata locates wrangler configurations recursively, and how to troubleshoot config detection errors.",
      content: `<p class="mb-2">Strata searches recursively up parent directories to identify binding targets:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Search Depth:</strong> Scans up to 12 parent levels to identify <code>wrangler.toml</code> or <code>wrangler.json</code>.</li>
                  <li><strong>Permissions Check:</strong> If bindings are not updating, verify the Tauri application has directory reading privileges in parent project folders.</li>
                  <li><strong>Duplicate Configurations:</strong> Ensure you do not have conflicting <code>wrangler.toml</code> and <code>wrangler.json</code> inside the same parent tree.</li>
                </ul>`,
    },
    {
      id: "ach-wrangler-sync",
      category: "achievements",
      title: "Wrangler TOML/JSON Config Sync Diagnostics",
      tags: ["achievements", "wrangler", "sync", "toml", "json", "troubleshoot"],
      summary:
        "Diagnose synchronization issues between your visual Cloudflare bindings and your project configuration files.",
      content: `<p class="mb-2">Visual Cloudflare binds synchronize configuration variables instantly:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Formatting Preservation:</strong> TOML and JSON/JSONC parsers preserve code comments.</li>
                  <li><strong>Sync Failures:</strong> Malformed configs (such as invalid TOML tables or unclosed JSON brackets) block writes. Repair the config syntax in your code editor to restore sync.</li>
                </ul>`,
    },
    {
      id: "ach-kv-datatypes",
      category: "achievements",
      title: "KV Namespace Validation & TTL Constraints",
      summary:
        "Validation guidelines for KV namespaces, Expiration TTL ranges, and custom schema configurations.",
      tags: ["achievements", "kv", "inspector", "ttl", "limit"],
      content: `<p class="mb-2">KV Namespace configurations follow specific Cloudflare limits:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Expiration TTL:</strong> Must be at least 60 seconds. Values below 60 will fail Cloudflare wrangler deployments.</li>
                  <li><strong>Type Mapping:</strong> Type assertions (String, Number, Boolean) are logical. If reading records in your worker, verify getters use appropriate casting.</li>
                </ul>`,
    },
    {
      id: "ach-wrangler-validation",
      category: "achievements",
      title: "Wrangler & Schema Alignment Diagnostics",
      summary:
        "Understand schema-to-wrangler alignment checks, resolver deprecations, and solving binding mismatch warnings.",
      tags: ["achievements", "wrangler", "validation", "sync", "mismatch"],
      content: `<p class="mb-2">Strata validates that your schema's JSDoc metadata matches your Wrangler configuration bindings:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>No Generated Resolvers:</strong> Legacy TS resolver generation is deprecated and removed. Strata now integrates directly with Wrangler config as the source of truth for Cloudflare bindings.</li>
                  <li><strong>Mismatch Warnings:</strong> If an entity type (KV, Durable Object, or R2) or name in <code>schema.ts</code> does not match the bindings declared in your Wrangler file, a mismatch warning will be shown in the Bottom Bar.</li>
                  <li><strong>Resolution:</strong> Keep names aligned between your Drizzle JSDoc metadata and Wrangler bindings. Updating names on the canvas will automatically propagate changes to both.</li>
                </ul>`,
    },
    {
      id: "ach-r2-settings",
      category: "achievements",
      title: "R2 Access Control & CORS Diagnostics",
      summary:
        "Troubleshoot R2 configuration writes, bucket visibility settings, CORS rules, and custom domain paths.",
      tags: ["achievements", "r2", "bucket", "cors", "public", "domain"],
      content: `<p class="mb-2">Updates bucket metadata inside JSDoc tags without filesystem restructuring:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Public access & CORS:</strong> Visual switches write boolean values directly to JSDocs.</li>
                  <li><strong>Folder MIME filters:</strong> Verify folder syntax rules match standard glob patterns (e.g. <code>image/*</code>) to avoid parsing warnings.</li>
                </ul>`,
    },
    {
      id: "ai-prompt-guide",
      category: "ai",
      title: "AI Co-Design Rules & Workflow",
      tags: ["ai", "prompt", "co-design", "copilot", "gpt", "claude"],
      summary:
        "How to use our specialized AI architect prompt to co-design schemas with Large Language Models.",
      content: `<p class="mb-2">Copy the prompt below and paste it to your favorite LLM. It guides the AI to output correctly structured, Drizzle ORM-compliant code decorated with <code>@strata</code> metadata comments, facilitating seamless bi-directional synchronization.</p>`,
    },
    {
      id: "gotcha-git-undo",
      category: "gotchas",
      title: "Git-Backed Canvas Reversion",
      tags: ["git", "undo", "revert", "history", "checkout"],
      summary:
        "Strata has no internal undo/redo history stack because it uses Git. Learn how to revert unwanted changes.",
      content: `<p class="mb-2">Strata does not manage a proprietary undo state history. Because your <code>schema.ts</code> file is the absolute single source of truth, standard Git features handle history management:</p>
                <ul class="list-disc pl-4 space-y-1 mb-2">
                  <li><strong>Reverting Node Positions:</strong> Discard dragged changes directly in your repository: <code class="bg-neutral text-neutral-content px-1.5 py-0.5 rounded text-[10px]">git checkout -- src/lib/db/schema.ts</code>.</li>
                  <li><strong>Branch isolation:</strong> Create safe feature branches when prototyping visual layouts to avoid mutating main files.</li>
                </ul>
                <p>This design guarantees zero hidden state or database sidecar files.</p>`,
    },
    {
      id: "gotcha-jsdoc-strict-json",
      category: "gotchas",
      title: "Double-Quoted JSDoc Formatting",
      tags: ["json", "jsdoc", "strict", "quotes", "format"],
      summary:
        "The AST comment parser reads comments using JSON.parse. Avoid single quotes, trailing commas, and unquoted keys.",
      content: `<p class="mb-2">The JSDoc metadata parser reads <code>@strata</code> configs strictly as JSON. Any syntax issues will cause node parsing failures:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Strict Quotes:</strong> Keys and string values must be enclosed in double quotes (e.g., <code>"target": "d1"</code>). Single quotes will throw errors.</li>
                  <li><strong>No Trailing Commas:</strong> Do not add trailing commas after the last parameter key. Standard JSON parser rules apply.</li>
                  <li><strong>Brackets Matching:</strong> Ensure curly brackets and double quotes close correctly inside comments.</li>
                </ul>`,
    },
    {
      id: "gotcha-sqlite-dates",
      category: "gotchas",
      title: "SQLite/D1 Date & Boolean Gotchas",
      tags: ["sqlite", "d1", "date", "boolean", "modes"],
      summary:
        "SQLite lacks native Date and Boolean data types. Configure Drizzle mappings to handle Date objects as integers.",
      content: `<p class="mb-2">SQLite and Cloudflare D1 store dates and booleans differently than MySQL or PostgreSQL:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Booleans as Integers:</strong> Always map boolean values inside Drizzle columns using integer mode constraints: <code>integer("name", { mode: "boolean" })</code>.</li>
                  <li><strong>Dates as Timestamps:</strong> Store dates as integer millisecond values: <code>integer("created_at", { mode: "timestamp" })</code> to avoid database schema parsing failures.</li>
                </ul>`,
    },
    {
      id: "gotcha-watcher-conflict",
      category: "gotchas",
      title: "Bidirectional Write Conflict Avoidance",
      tags: ["watcher", "sync", "conflict", "vscode", "locks"],
      summary:
        "Tips for running Strata bidirectional syncing concurrently with external IDEs like VS Code or Cursor.",
      content: `<p class="mb-2">Strata watches schema files on disk and synchronizes visual canvas actions:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Auto-Save Settings:</strong> If using VS Code/Cursor with auto-save enabled, very fast typings can trigger partial AST compiles. If the canvas shows a warning, briefly halt typing to let compile finish.</li>
                  <li><strong>File Locks:</strong> Avoid simultaneous manual filesystem writes during active visual dragging to prevent disk transaction exceptions.</li>
                </ul>`,
    },
  ];

  const aiPrompt = `You are an expert software architect specialized in Drizzle ORM and Cloudflare D1 (SQLite dialect).
We are using Strata, an interactive ERD tool that parses our \`schema.ts\` file.

You MUST follow these design & layout rules when writing or modifying Drizzle schema code for me:

1. AESTHETICS & METADATA: Every table or collection declaration MUST be preceded by a standard JSDoc comment containing Strata visual coordinates in valid JSON format. Do NOT use abstract union types or placeholders inside the JSDoc JSON string:
   /**
    * @strata { "target": "d1", "x": 100, "y": 200 }
    */

2. GRID LAYOUT: Pre-calculate visual layout positions (x, y coordinates) for new tables. Space them out logically (e.g. 400px apart horizontally, 300px apart vertically) to avoid overlaps.

3. DATATYPES (Cloudflare D1 / SQLite):
   - SQLite does not have a native Date type. Always map dates using:
     integer("column_name", { mode: "timestamp" }) or integer("column_name", { mode: "timestamp_ms" })
   - Booleans must map to: integer("column_name", { mode: "boolean" })

4. STORAGE TARGETS (JSDoc overrides):
   - SQLite D1 database target is specified by: "target": "d1"
   - Durable Object targets are specified by: "target": "do". Example JSDoc metadata:
     /**
      * @strata { "target": "do", "x": 100, "y": 200, "path": "./src/do/UserDO.ts", "class": "UserDO", "methods": ["getUserInfo", "updateStatus"] }
      */
   - KV Namespace targets are specified by: "target": "kv". Example JSDoc metadata:
     /**
      * @strata { "target": "kv", "x": 150, "y": 300, "schema": { "sessionToken": "string", "failedAttempts": { "type": "number", "ttl": 3600 } } }
      */
   - R2 Bucket targets are specified by: "target": "r2". Example JSDoc metadata:
     /**
      * @strata { "target": "r2", "x": 200, "y": 400, "public": true, "cors": true, "folders": { "avatars": "image/*", "documents": "application/pdf" } }
      */

5. SYNTHETIC RELATIONSHIPS:
   - If establishing relations involving KV, DO, or R2 targets, do not declare physical SQL foreign keys. Instead, specify logical connections inside the source entity JSDoc:
     /**
      * @strata { "target": "d1", "x": 100, "y": 100, "relations": [{ "to": "USERS_KV" }] }
      */

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
    }),
  );

  function resetSearch() {
    searchQuery = "";
    activeTab = "all";
  }

  // Count topics helper for badges
  function getTopicCount(catId: string) {
    if (catId === "all") return docTopics.length;
    if (catId === "ai") return 1;
    if (catId === "jsdoc-builder") return 1;
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
      data-testid="help-modal"
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
            <h2
              class="font-black text-base text-base-content tracking-wide uppercase"
            >
              Developer Help Center
            </h2>
            <p class="text-[10px] opacity-50 font-medium mt-0.5 leading-none">
              Onboarding, Cloudflare storage targets, troubleshooting, and
              syntax guides.
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
      <div
        class="px-8 py-3 bg-base-200/40 border-b border-base-300/60 flex items-center gap-4"
      >
        <div class="relative grow">
          <Search
            class="absolute left-3 top-2.5 w-4 h-4 text-base-content/35"
          />
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
        <div
          class="w-1/3 bg-base-200/50 border-r border-base-300/80 p-4 overflow-y-auto"
        >
          <span
            class="text-[9px] font-black uppercase tracking-widest opacity-40 px-3 block mb-2"
            >Categories</span
          >
          <ul class="space-y-1">
            {#each categories as cat}
              <li>
                <button
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-semibold group {activeTab ===
                    cat.id && !searchQuery
                    ? 'bg-primary text-primary-content shadow-lg shadow-primary/10'
                    : 'text-base-content/75 hover:bg-base-200'}"
                  onclick={() => {
                    activeTab = cat.id;
                    searchQuery = ""; // clear search when navigating tabs
                  }}
                >
                  <div class="flex items-center gap-2.5">
                    <cat.icon
                      class="w-4 h-4 opacity-75 group-hover:scale-105 transition-transform"
                    />
                    <span>{cat.label}</span>
                  </div>
                  <span
                    class="badge badge-xs text-[9px] font-bold border-none {activeTab ===
                      cat.id && !searchQuery
                      ? 'bg-primary-content/20 text-primary-content'
                      : 'bg-base-300 text-base-content/60'}"
                  >
                    {getTopicCount(cat.id)}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>

        <!-- Help Documentation Content Area -->
        <div class="w-2/3 p-8 overflow-y-auto flex flex-col gap-5 bg-base-100">
          {#if activeTab === "jsdoc-builder"}
            <!-- JSDoc Metadata Builder GUI -->
            <div class="flex flex-col gap-4 font-sans text-xs">
              <div class="flex items-center gap-2 border-b border-base-300 pb-2 mb-2">
                <Wrench class="w-4 h-4 text-primary" />
                <h3 class="font-black text-sm uppercase tracking-wide text-base-content">JSDoc Metadata Builder</h3>
              </div>
              <p class="text-base-content/75 leading-relaxed">
                Use this interactive tool to build standard <code>@strata</code> comments. Paste the generated block directly above your table, object, or connection declarations in your Drizzle <code>schema.ts</code> file.
              </p>

              <!-- Basic Fields -->
              <div class="grid grid-cols-3 gap-3 bg-base-200/50 p-4 rounded-2xl border border-base-300/60 mt-1">
                <label class="flex flex-col gap-1 cursor-pointer">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-[10px] uppercase text-base-content/60">Storage Target</span>
                    <button
                      type="button"
                      class="text-[9px] text-primary hover:underline font-bold"
                      onclick={loadSamplePreset}
                    >
                      Load Sample
                    </button>
                  </div>
                  <select
                    bind:value={builderTarget}
                    class="select select-sm select-bordered rounded-lg bg-base-100 w-full font-medium text-xs h-8 min-h-8"
                  >
                    <option value="d1">D1 (SQLite Table)</option>
                    <option value="do">DO (Durable Object)</option>
                    <option value="kv">KV (Key-Value Store)</option>
                    <option value="r2">R2 (Storage Bucket)</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 cursor-pointer">
                  <span class="font-bold text-[10px] uppercase text-base-content/60">Position X (px)</span>
                  <input
                    type="number"
                    bind:value={builderX}
                    class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                  />
                </label>
                <label class="flex flex-col gap-1 cursor-pointer">
                  <span class="font-bold text-[10px] uppercase text-base-content/60">Position Y (px)</span>
                  <input
                    type="number"
                    bind:value={builderY}
                    class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                  />
                </label>
              </div>

              <!-- Target Specific Parameters -->
              <div class="bg-base-200/50 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-3">
                <h4 class="font-bold text-[10px] uppercase tracking-wider text-primary border-b border-base-300/50 pb-1">Target Configurations</h4>

                {#if builderTarget === "d1"}
                  <label class="flex flex-col gap-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">Synthetic Relations</span>
                      <span class="text-[9px] opacity-50">Comma-separated target node names</span>
                    </div>
                    <input
                      type="text"
                      bind:value={builderD1Relations}
                      placeholder="e.g. USERS_KV, IMAGES_R2"
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                    {#if relationsError}
                      <span class="text-[9px] text-error font-semibold mt-0.5">{relationsError}</span>
                    {:else}
                      <span class="text-[9px] opacity-40 font-medium mt-0.5">Tip: Points to targets in your diagram (e.g. KV namespaces or buckets).</span>
                    {/if}
                  </label>
                {:else if builderTarget === "do"}
                  <div class="grid grid-cols-2 gap-3">
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">DO Class File Path</span>
                      <input
                        type="text"
                        bind:value={builderDOPath}
                        placeholder="e.g. ./src/do/UserDO.ts"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                    </label>
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">DO Class Name</span>
                      <input
                        type="text"
                        bind:value={builderDOClass}
                        placeholder="e.g. UserDO"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                    </label>
                  </div>
                  <label class="flex flex-col gap-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">Public Methods</span>
                      <span class="text-[9px] opacity-50">Comma-separated list</span>
                    </div>
                    <input
                      type="text"
                      bind:value={builderDOMethods}
                      placeholder="e.g. login, logout, getProfile"
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                    <span class="text-[9px] opacity-40 font-medium mt-0.5">Tip: Declare custom method names and signatures (e.g. <code>fetchData(id: string)</code>).</span>
                  </label>
                {:else if builderTarget === "kv"}
                  <label class="flex flex-col gap-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">KV Key Mappings</span>
                      <span class="text-[9px] opacity-50">Comma-separated key:type mappings</span>
                    </div>
                    <input
                      type="text"
                      bind:value={builderKVMappings}
                      placeholder="e.g. sessionToken:string, attempts:number, meta:any"
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                    {#if kvError}
                      <span class="text-[9px] text-error font-semibold mt-0.5">{kvError}</span>
                    {:else}
                      <span class="text-[9px] opacity-40 font-medium mt-0.5">Tip: Enter <code>keyName:type</code> pairs (supported types: string, number, boolean, any).</span>
                    {/if}
                  </label>
                {:else if builderTarget === "r2"}
                  <div class="flex items-center gap-6 py-1">
                    <label class="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-base-content/65 select-none">
                      <input type="checkbox" bind:checked={builderR2Public} class="checkbox checkbox-xs checkbox-primary rounded" />
                      <span>Public Access Enabled</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-base-content/65 select-none">
                      <input type="checkbox" bind:checked={builderR2Cors} class="checkbox checkbox-xs checkbox-primary rounded" />
                      <span>CORS Enabled</span>
                    </label>
                  </div>
                  <label class="flex flex-col gap-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">Folder Filters</span>
                      <span class="text-[9px] opacity-50">Comma-separated folderName:mime/type pairs</span>
                    </div>
                    <input
                      type="text"
                      bind:value={builderR2Folders}
                      placeholder="e.g. avatars:image/*, data:application/json"
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                    {#if r2Error}
                      <span class="text-[9px] text-error font-semibold mt-0.5">{r2Error}</span>
                    {:else}
                      <span class="text-[9px] opacity-40 font-medium mt-0.5">Tip: Enter <code>folderName:mime/type</code> (e.g. <code>avatars:image/*</code>).</span>
                    {/if}
                  </label>
                {/if}
              </div>

              <!-- Output Display -->
              <div class="bg-base-200/50 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-3 mt-1 relative group/output">
                <div class="flex items-center justify-between border-b border-base-300/50 pb-1.5">
                  <span class="font-bold text-[10px] uppercase tracking-wider text-success">Generated JSDoc Code</span>
                  <button
                    class="btn btn-success btn-xs rounded-lg font-bold flex items-center gap-1 hover:shadow-md transition-all active:scale-95 text-success-content"
                    onclick={copyBuilderJSDoc}
                  >
                    {#if builderCopied}
                      <Check class="w-3 h-3" />
                      Copied!
                    {:else}
                      <span>Copy Block</span>
                    {/if}
                  </button>
                </div>
                <pre class="bg-neutral text-neutral-content p-4 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto border border-white/5 max-h-56 overflow-y-auto selection:bg-primary/30 select-all">{generatedJSDoc}</pre>
              </div>
            </div>
          {:else}
            {#if searchQuery}
              <div
                class="flex items-center justify-between text-xs text-base-content/60 border-b border-base-200 pb-2"
              >
                <span
                  >Found <strong>{filteredTopics.length}</strong> matching results
                  for "{searchQuery}"</span
                >
                <button
                  class="text-primary font-bold hover:underline"
                  onclick={resetSearch}>Reset</button
                >
              </div>
            {/if}

            <!-- Display topics lists -->
            {#each filteredTopics as topic (topic.id)}
              <div
                class="bg-base-200/40 border border-base-300/60 rounded-2xl p-5 flex flex-col gap-2 transition-all hover:border-base-300 hover:shadow-xs group/card"
                in:fade={{ duration: 150 }}
              >
                <div class="flex items-center justify-between">
                  <h4
                    class="font-bold text-xs text-base-content group-hover/card:text-primary transition-colors flex items-center gap-1.5"
                  >
                    {#if topic.category === "troubleshooting"}
                      <AlertTriangle class="w-3.5 h-3.5 text-warning shrink-0" />
                    {:else if topic.category === "achievements"}
                      <History class="w-3.5 h-3.5 text-success shrink-0" />
                    {:else}
                      <Info class="w-3.5 h-3.5 text-primary shrink-0" />
                    {/if}
                    {topic.title}
                  </h4>
                  <span
                    class="badge badge-outline badge-xs opacity-60 text-[9px] font-mono capitalize"
                  >
                    {topic.category.replace("-", " ")}
                  </span>
                </div>
                <p
                  class="text-xs text-base-content/80 font-medium leading-normal"
                >
                  {topic.summary}
                </p>
                <div
                  class="text-[11px] leading-relaxed text-base-content/65 border-t border-base-300/40 pt-2 mt-1"
                >
                  {@html topic.content}
                </div>
              </div>
            {/each}

            <!-- Special interactive display for AI prompts tab -->
            {#if (activeTab === "ai" || searchQuery
                .toLowerCase()
                .includes("ai") || searchQuery
                .toLowerCase()
                .includes("prompt")) && filteredTopics.length > 0}
              <div
                class="bg-linear-to-r from-primary/5 to-base-100 border border-primary/10 rounded-2xl p-5 flex flex-col gap-3"
                in:fade={{ duration: 150 }}
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Sparkles class="w-4 h-4 text-primary animate-pulse" />
                    <span class="font-bold text-xs">Copy AI Architect Prompt</span
                    >
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
                  Feed this context template directly to your preferred LLM when
                  prompt co-designing schemas. It teaches the AI how to
                  automatically output Drizzle variables decorated with
                  pre-calculated <code>@strata</code> layouts.
                </p>
                <pre
                  class="bg-neutral text-neutral-content p-3.5 rounded-xl text-[9px] font-mono leading-relaxed overflow-x-auto border border-white/5 max-h-48 overflow-y-auto">
{aiPrompt}</pre>
              </div>
            {/if}

            {#if filteredTopics.length === 0}
              <div
                class="flex flex-col items-center justify-center gap-3 py-16 text-center animate-in fade-in duration-300"
              >
                <div class="p-4 bg-base-200 rounded-full text-base-content/40">
                  <Search class="w-8 h-8" />
                </div>
                <div>
                  <h4 class="font-bold text-sm text-base-content">
                    No documentation results found
                  </h4>
                  <p class="text-xs opacity-60 mt-1">
                    We couldn't find anything matching your search term "{searchQuery}".
                  </p>
                </div>
                <button
                  class="btn btn-primary btn-sm rounded-xl px-5 font-bold mt-2"
                  onclick={resetSearch}
                >
                  Clear Search Query
                </button>
              </div>
            {/if}
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
