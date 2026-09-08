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
    Database,
    Cpu,
    BookOpen,
    Check,
    FingerprintPattern,
    Search,
    CircleQuestionMark,
    Info,
    TriangleAlert,
    History,
    Braces,
    Wrench,
    Copy,
    Layers,
    ShieldCheck,
  } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import { schemaState } from "#lib/state";
  import { SAMPLE_TEMPLATES } from "#lib/mock";

  let { show = $bindable(false) } = $props();

  let activeTab = $state("all");
  let searchQuery = $state("");
  let copied = $state(false);
  let copiedTopicId = $state<string | null>(null);

  function loadStarterTemplate(key: string) {
    schemaState.loadSandboxDemo(key);
    show = false;
  }

  async function copyCardContent(topic: DocTopic) {
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = topic.content;
      const plainContent = tempDiv.textContent || tempDiv.innerText || "";

      const markdown = `[Strata Documentation: ${topic.title}]
Category: ${topic.category}
Summary: ${topic.summary}

Details:
${plainContent.trim()}
`;
      await navigator.clipboard.writeText(markdown);
      copiedTopicId = topic.id;
      setTimeout(() => {
        if (copiedTopicId === topic.id) copiedTopicId = null;
      }, 2000);
    } catch (e) {
      console.error("[Strata] Copy card failed:", e);
    }
  }

  // JSDoc Builder State
  let builderMode = $state<"barrel" | "single">("barrel");

  // Barrel Mode (Pattern A: @strata-layout)
  let barrelEntities = $state("users, posts, comments, profiles");
  let includeClerkBoundary = $state(true);
  let includeWorkosBoundary = $state(false);
  let barrelColumns = $state(2);
  let barrelSpacingX = $state(420);
  let barrelSpacingY = $state(320);
  let barrelStartX = $state(100);
  let barrelStartY = $state(150);

  // Single-File Mode (Pattern B: @strata)
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

  // Barrel Validation Checker
  const barrelError = $derived.by(() => {
    if (!barrelEntities.trim()) return "Enter at least one entity or table name.";
    const items = barrelEntities.split(",");
    for (const item of items) {
      const name = item.trim();
      if (name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return `"${name}" is not a valid alphanumeric identifier.`;
      }
    }
    return "";
  });

  // Barrel Presets
  function loadBarrelPreset(type: "blog" | "ecommerce" | "saas") {
    if (type === "blog") {
      barrelEntities = "users, posts, comments, categories, tags";
      includeClerkBoundary = true;
      includeWorkosBoundary = false;
      barrelColumns = 2;
    } else if (type === "ecommerce") {
      barrelEntities = "customers, orders, orderItems, products, inventory";
      includeClerkBoundary = false;
      includeWorkosBoundary = true;
      barrelColumns = 2;
    } else if (type === "saas") {
      barrelEntities = "organizations, members, workspaces, projects, auditLogs";
      includeClerkBoundary = true;
      includeWorkosBoundary = true;
      barrelColumns = 3;
    }
  }

  // Validation Checkers for Single-File Mode
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
      if (
        val &&
        !validTypes.includes(val.toLowerCase()) &&
        !val.startsWith("{")
      ) {
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
      builderDOMethods =
        "getUser(id: number): Promise<User>, saveUser(data: any): Promise<void>";
    } else if (builderTarget === "kv") {
      builderX = 580;
      builderY = 280;
      builderKVMappings =
        "sessionToken:string, failedAttempts:number, roles:any";
    } else if (builderTarget === "r2") {
      builderX = 200;
      builderY = 460;
      builderR2Public = true;
      builderR2Cors = true;
      builderR2Folders = "avatars:image/*, attachments:application/pdf";
    }
  }

  const generatedBarrelLayout = $derived.by(() => {
    const names = barrelEntities
      .split(",")
      .map((n) => n.trim())
      .filter((n) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n));

    const layout: Record<string, { x: number; y: number }> = {};

    if (includeClerkBoundary) {
      layout["__clerk_identity__"] = { x: -280, y: Number(barrelStartY) || 150 };
    }
    if (includeWorkosBoundary) {
      layout["__workos_identity__"] = { x: -280, y: (Number(barrelStartY) || 150) + 240 };
    }

    const cols = Math.max(1, Number(barrelColumns) || 2);
    const startX = Number(barrelStartX) || 100;
    const startY = Number(barrelStartY) || 150;
    const gapX = Number(barrelSpacingX) || 420;
    const gapY = Number(barrelSpacingY) || 320;

    names.forEach((name, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      layout[name] = {
        x: startX + col * gapX,
        y: startY + row * gapY,
      };
    });

    return `/**\n * @strata-layout ${JSON.stringify(layout, null, 2).split("\n").join("\n * ")}\n */`;
  });

  const generatedJSDoc = $derived.by(() => {
    const data: any = {
      target: builderTarget,
      x: Number(builderX) || 0,
      y: Number(builderY) || 0,
    };

    if (builderTarget === "d1") {
      if (builderD1Relations.trim() && !relationsError) {
        data.relations = builderD1Relations
          .split(",")
          .map((r) => ({ to: r.trim() }))
          .filter((r) => r.to.length > 0);
      }
    } else if (builderTarget === "do") {
      data.path = builderDOPath.trim();
      data.class = builderDOClass.trim();
      if (builderDOMethods.trim()) {
        data.methods = builderDOMethods
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0);
      }
    } else if (builderTarget === "kv") {
      if (builderKVMappings.trim() && !kvError) {
        const schemaObj: any = {};
        builderKVMappings.split(",").forEach((item) => {
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
        builderR2Folders.split(",").forEach((item) => {
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

    return `/**\n * @strata ${JSON.stringify(data, null, 2).split("\n").join("\n * ")}\n */`;
  });

  const activeJSDocOutput = $derived.by(() => {
    return builderMode === "barrel" ? generatedBarrelLayout : generatedJSDoc;
  });

  async function copyBuilderJSDoc() {
    try {
      await navigator.clipboard.writeText(activeJSDocOutput);
      builderCopied = true;
      setTimeout(() => (builderCopied = false), 2000);
    } catch (e) {
      console.error("[Strata] Builder copy failed:", e);
    }
  }

  const categories = [
    { id: "all", label: "All Documentation", icon: BookOpen },
    {
      id: "starter-templates",
      label: "Starter Templates",
      icon: Sparkles,
    },
    {
      id: "getting-started",
      label: "Getting Started & IDE",
      icon: FingerprintPattern,
    },
    {
      id: "modular-architecture",
      label: "Multi-Schema & Barrel Mode",
      icon: Layers,
    },
    {
      id: "identity-auth",
      label: "Identity & Auth (Better Auth / Clerk / WorkOS)",
      icon: ShieldCheck,
    },
    { id: "cloudflare", label: "Cloudflare Bindings", icon: Database },
    { id: "relationships", label: "ERD Relationships", icon: Share2 },
    { id: "troubleshooting", label: "Troubleshooting", icon: TriangleAlert },
    {
      id: "achievements",
      label: "Advanced Guides & Diagnostics",
      icon: History,
    },
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
      title: "Capabilities & Live Visual Architecture",
      tags: ["onboarding", "sync", "ast", "watch", "start", "modular", "ide"],
      summary:
        "Strata is a local-first visual architecture canvas for Drizzle ORM and Cloudflare Workers (D1, KV, Durable Objects, R2, and Cloud Identity).",
      content: `<p class="mb-2">Strata reads your codebase as the absolute single source of truth:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Dual-Archetype Support:</strong> Seamlessly handles both Single-File Monoliths (<code>schema.ts</code>) and Modern Modular Barrels (<code>schema/index.ts</code> re-exporting domain modules).</li>
                  <li><strong>External IDE Pairing:</strong> Designed to run directly alongside VS Code, Cursor, or WebStorm. The native Rust file watcher updates the canvas in milliseconds upon save.</li>
                  <li><strong>Targeted Domain File Writes:</strong> Visual mutations route directly to the originating domain file (e.g. <code>users.ts</code>), preserving custom formatting and imports.</li>
                  <li><strong>Git-Clean History:</strong> Re-arranging nodes on the canvas touches only the root barrel manifest, leaving domain files 100% clean and free of Git merge conflicts.</li>
                </ul>`,
    },
    {
      id: "which-archetype-guide",
      category: "getting-started",
      title: "Which Default Should I Choose? (Monolith vs. Barrel)",
      tags: ["default", "recommendation", "monolith", "barrel", "architecture", "choice", "teams"],
      summary:
        "Strata recommends Modular Barrel (schema/index.ts) as the default for teams and production apps. Here is why and when each pattern is best.",
      content: `<p class="mb-2">Strata supports two official architecture patterns. Here is how to decide which to use:</p>
                <div class="space-y-2.5 my-2">
                  <div class="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="badge badge-primary badge-xs font-bold uppercase text-[9px]">Recommended Default</span>
                      <strong class="text-xs text-primary">Modular Barrel (<code>schema/index.ts</code>)</strong>
                    </div>
                    <ul class="list-disc pl-4 space-y-1 text-xs text-base-content/80">
                      <li><strong>Best for:</strong> Teams, growing codebases, micro-domain partitioning, and production applications.</li>
                      <li><strong>Why:</strong> All canvas coordinates live inside <code>@strata-layout</code> in <code>index.ts</code>. Rearranging cards on the canvas touches <strong>0 domain files</strong> (<code>users.ts</code>, <code>posts.ts</code>), eliminating Git merge conflicts.</li>
                      <li><strong>Cross-File Dependencies:</strong> Strata automatically manages TypeScript imports (e.g. <code>import { users } from "./users"</code>) when connecting tables across files.</li>
                    </ul>
                  </div>
                  <div class="p-2.5 rounded-xl bg-base-200/60 border border-base-300">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="badge badge-ghost badge-xs font-bold uppercase text-[9px] opacity-75">Secondary Option</span>
                      <strong class="text-xs text-base-content">Single-File Monolith (<code>schema.ts</code>)</strong>
                    </div>
                    <ul class="list-disc pl-4 space-y-1 text-xs text-base-content/80">
                      <li><strong>Best for:</strong> Solo developers, hackathons, MVPs, and schemas with fewer than 10 tables.</li>
                      <li><strong>Why:</strong> Fast to browse in a single editor tab. Metadata comments sit directly above declarations: <code>/** @strata { "target": "d1", "x": 100, "y": 200 } */</code>.</li>
                    </ul>
                  </div>
                </div>
                <p class="text-xs text-base-content/70"><strong>Note:</strong> You can also open <code>drizzle.config.ts</code> directly, and Strata will automatically resolve either pattern from your config path!</p>`,
    },
    {
      id: "modular-architecture-guide",
      category: "modular-architecture",
      title: "Multi-File Schemas & The Git-Clean Barrel Pattern",
      tags: ["modular", "barrel", "index", "modules", "multi-file", "git-clean", "layout"],
      summary:
        "How Strata ingests, mutates, and organizes modular Drizzle setups without creating Git merge noise.",
      content: `<p class="mb-2">Modern Drizzle architectures split schema definitions across specialized domain files. Strata embraces this natively:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>Barrel Re-Export Discovery:</strong> Point Strata to your <code>schema/index.ts</code>. It parses all re-exported domain files (e.g. <code>export * from './users';</code>) into a unified project AST.</li>
                  <li><strong>Targeted File Writes:</strong> Adding a column or modifying an entity in <code>users.ts</code> writes directly to <code>users.ts</code> without touching other schema modules.</li>
                  <li><strong>Git-Clean Layout Manifest (<code>@strata-layout</code>):</strong> In barrel mode, node coordinates are stored in a consolidated JSDoc manifest inside <code>index.ts</code>. Moving nodes on the canvas never modifies domain files, eliminating visual merge conflicts in Git.</li>
                  <li><strong>Scoped Entity Creation:</strong> When adding a new table, choose between scaffolding a new module file (e.g. <code>comments.ts</code>), appending to an existing module, or adding to the root.</li>
                </ul>`,
    },
    {
      id: "cross-module-relations",
      category: "modular-architecture",
      title: "Cross-Module Relationships & Auto-Imports",
      tags: ["relations", "foreign-key", "cross-module", "imports", "references"],
      summary:
        "Connect tables across different files with automated TypeScript imports and standalone relations.ts support.",
      content: `<p class="mb-2">Strata handles cross-file dependencies automatically:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>Auto-Import Injection:</strong> When you connect a child table in <code>posts.ts</code> to a parent table in <code>users.ts</code>, Strata adds <code>.references(() => users.id)</code> and automatically injects <code>import { users } from "./users";</code>.</li>
                  <li><strong>Dedicated <code>relations.ts</code> Resolution:</strong> If your project separates query relations into a standalone <code>relations.ts</code> file, Strata discovers and resolves them across all modules.</li>
                  <li><strong>Unused Import Cleanup:</strong> Deleting a relation or foreign key automatically prunes unused import statements, keeping your TypeScript codebase clean.</li>
                </ul>`,
    },
    {
      id: "identity-boundary-guide",
      category: "identity-auth",
      title: "Identity Architecture: Better Auth, Clerk & WorkOS",
      tags: ["identity", "auth", "better-auth", "clerk", "workos", "sso", "mirror"],
      summary:
        "Model D1-resident authentication clusters and external Cloud Identity Providers as first-class visual nodes.",
      content: `<p class="mb-2">Strata treats identity as a core architectural topology layer:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>D1-Resident Auth (Better Auth / Lucia):</strong> Strata automatically detects standard auth tables (<code>user</code>, <code>session</code>, <code>account</code>, <code>verification</code>) and tags them with <code>🛡️ Better Auth</code>. Add custom fields (e.g. <code>stripeCustomerId</code>, <code>role</code>) directly to the user table without breaking CLI compatibility.</li>
                  <li><strong>Cloud IdP Boundaries (Clerk & WorkOS):</strong> When tables contain external identity references (e.g. <code>clerkUserId</code> or <code>workosOrgId</code>), Strata spawns visual Identity Boundary Nodes with animated connection edges.</li>
                  <li><strong>1-Click Webhook Mirror Scaffolding:</strong> Easily generate local D1 mirror tables (<code>clerkUsers</code> or <code>workosUsers</code>) for fast local joins and webhook sync, complete with copyable Drizzle migration definitions.</li>
                  <li><strong>Tailored Identity Inspector:</strong> Selecting an identity node provides provider-specific branding, bound table navigation, official documentation links, and webhook configuration status.</li>
                </ul>`,
    },
    {
      id: "ide-workflow-guide",
      category: "getting-started",
      title: "External IDE Pairing & Zero-Jitter Workflow",
      tags: ["ide", "vscode", "cursor", "editor", "pairing", "workflow", "preview"],
      summary:
        "Strata is designed to run side-by-side with VS Code, Cursor, or WebStorm rather than replacing your editor.",
      content: `<p class="mb-2">Strata pairs with your primary developer environment:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>"Open in Editor" Integration:</strong> Click the active file pill in the Navbar or the Editor button in the Inspector to jump directly to your code in VS Code or Cursor.</li>
                  <li><strong>Instant Diagnostic Navigation:</strong> Clicking any schema warning (e.g. <code>Line 42 ↗</code>) opens your external editor directly to that exact line of code.</li>
                  <li><strong>Contextual Drizzle Previews:</strong> Inspect any table to view syntax-highlighted Drizzle definitions and copy code snippets in one click.</li>
                  <li><strong>Self-Trigger Watcher Debounce:</strong> AST mutations initiated within Strata bypass the file watcher so you never experience feedback loops or jitter while editing.</li>
                </ul>`,
    },
    {
      id: "drizzle-config-guide",
      category: "getting-started",
      title: "drizzle.config.ts Workspace Auto-Detection",
      tags: ["drizzle.config", "workspace", "detection", "globs", "open"],
      summary:
        "Open drizzle.config.ts directly or let Strata auto-resolve complex glob and array schema paths.",
      content: `<p class="mb-2">Strata natively understands your Drizzle configuration:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>Direct Configuration Selection:</strong> Opening <code>drizzle.config.ts</code> automatically inspects the <code>schema</code> field and loads the primary entrypoint or barrel directory.</li>
                  <li><strong>Diverse Syntax Support:</strong> Seamlessly resolves double quotes, single quotes, template literal backticks (<code>\`./src/db/schema.ts\`</code>), string arrays (<code>schema: ["./src/db/schema/*"]</code>), and trailing directory slashes.</li>
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
      content: `<p class="mb-2">If Strata shows parse errors after saving changes in your external editor:</p>
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
      id: "ach-framework-do-exports",
      category: "achievements",
      title:
        "Framework-Agnostic Durable Object Exports (Hono, SvelteKit, Remix, Astro, Nuxt, Next.js)",
      tags: [
        "durable",
        "objects",
        "hono",
        "sveltekit",
        "remix",
        "astro",
        "nuxt",
        "nextjs",
        "exports",
        "wrangler",
      ],
      summary:
        "How Durable Object classes must be exported across all major Cloudflare Workers web frameworks.",
      content: `<p class="mb-2">The Cloudflare Workers runtime requires every Durable Object class bound in <code>wrangler.toml</code> to be exported from your worker entrypoint module. Here is how each framework handles it:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>Hono / Standalone Workers:</strong> Re-export the DO class directly in your main entry file (e.g. <code>src/index.ts</code> or <code>src/worker.ts</code>):<br/><code class="bg-neutral text-neutral-content px-1.5 py-0.5 rounded text-[10px]">export { TelemetrySessionDO } from './durable-objects/TelemetrySessionDO';</code></li>
                  <li><strong>SvelteKit:</strong> Ensure <code>vite.config.ts</code> references the DO class file inside <code>cloudflareDoExporter({ durableObjects: ['src/lib/server/durable-objects/TelemetrySessionDO.ts'] })</code>.</li>
                  <li><strong>Remix (Vite):</strong> Re-export the DO class from your custom server entrypoint (e.g. <code>server.ts</code> or <code>app/entry.server.ts</code>).</li>
                  <li><strong>Astro (Advanced Mode):</strong> Configure a custom worker entry file (<code>src/worker.ts</code>) in <code>astro.config.mjs</code> and re-export the DO class.</li>
                  <li><strong>Nuxt / Nitro:</strong> Re-export the DO class in a custom Nitro server plugin or entry file (<code>server/index.ts</code>).</li>
                  <li><strong>Next.js (OpenNext):</strong> Re-export the DO class in your custom worker wrapper file (<code>worker.ts</code>).</li>
                  <li><strong>Why Dragging Triggers Re-bundling:</strong> When you drag nodes in Strata, JSDoc tags update in <code>schema.ts</code>. Your dev server (Vite or Wrangler) re-bundles the entrypoint, which raises a runtime error if the DO class export is missing.</li>
                </ul>`,
    },
    {
      id: "ach-do-mutations",
      category: "achievements",
      title: "Durable Object Folder Structures & File Path Resolution",
      tags: [
        "durable",
        "objects",
        "ast",
        "paths",
        "folders",
        "resolution",
        "aliases",
      ],
      summary:
        "How Strata flexibly resolves single files, shared folders, co-located routes, and tsconfig path aliases for Durable Objects.",
      content: `<p class="mb-2">Strata places <strong>zero restrictions on your folder structure</strong> when organizing Durable Objects:</p>
                <ul class="list-disc pl-4 space-y-1.5 text-xs">
                  <li><strong>Dedicated Class Files (Recommended):</strong> Store one DO class per file in a shared folder (e.g. <code>"path": "./src/durable-objects/UserSessionDO.ts"</code>).</li>
                  <li><strong>Multiple Classes in One File:</strong> Declare multiple DO classes inside a single file. Strata targets the matching class using the <code>class</code> parameter (e.g. <code>"class": "CounterDO"</code>).</li>
                  <li><strong>Co-Located Feature Routes:</strong> Keep DO files next to API endpoints (e.g. <code>"path": "./src/routes/api/counter/CounterDO.ts"</code>).</li>
                  <li><strong>Path Alias Support:</strong> Relative paths, workspace absolute paths, and <code>tsconfig.json</code> aliases (e.g. <code>$lib/server/durable-objects/...</code>) are fully supported.</li>
                  <li><strong>AST Integrity:</strong> Edits to public methods parse and update the target file using <code>ts-morph</code>. Missing or unreadable files raise visual diagnostic warning flags.</li>
                </ul>`,
    },
    {
      id: "ach-wrangler-validation",
      category: "achievements",
      title: "Wrangler & Schema Alignment Diagnostics",
      summary:
        "How Strata validates Drizzle JSDoc metadata against your project's wrangler.jsonc or wrangler.toml bindings.",
      tags: ["wrangler", "validation", "sync", "mismatch", "bindings"],
      content: `<p class="mb-2">Strata ensures your visual layout aligns directly with Cloudflare Wrangler bindings:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Direct Binding Source:</strong> Strata parses <code>wrangler.jsonc</code> or <code>wrangler.toml</code> directly as the source of truth for KV, DO, D1, and R2 bindings.</li>
                  <li><strong>Binding Mismatches:</strong> If an entity name in <code>schema.ts</code> JSDoc metadata does not match Wrangler bindings, Strata flags a mismatch warning in the Bottom Bar.</li>
                  <li><strong>Automatic Sync:</strong> Updating entity names on the visual canvas automatically updates both JSDoc tags and Wrangler configuration files.</li>
                </ul>`,
    },
    {
      id: "ach-visual-overhaul",
      category: "achievements",
      title: "Recursive Wrangler Config Discovery",
      tags: ["wrangler", "detect", "parent", "folders", "discovery"],
      summary:
        "Learn how Strata locates wrangler configurations recursively, and how to troubleshoot config detection errors.",
      content: `<p class="mb-2">Strata searches recursively up parent directories to identify binding targets:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Search Depth:</strong> Scans up to 12 parent levels to identify <code>wrangler.toml</code> or <code>wrangler.json</code>.</li>
                  <li><strong>Permissions Check:</strong> Verify the application has directory reading privileges in parent project folders if bindings do not sync.</li>
                  <li><strong>Single Config Source:</strong> Ensure you do not have conflicting <code>wrangler.toml</code> and <code>wrangler.json</code> files in the same directory.</li>
                </ul>`,
    },
    {
      id: "ach-r2-settings",
      category: "achievements",
      title: "R2 Access Control & CORS Configuration",
      summary:
        "Troubleshoot R2 configuration writes, bucket visibility settings, CORS rules, and custom domain paths.",
      tags: ["r2", "bucket", "cors", "public", "domain"],
      content: `<p class="mb-2">Model R2 bucket settings directly within JSDoc metadata without database sidecars:</p>
                <ul class="list-disc pl-4 space-y-1">
                  <li><strong>Public access & CORS:</strong> Toggle bucket visibility and CORS headers directly from the visual inspector drawer.</li>
                  <li><strong>Folder MIME filters:</strong> Map directories to specific MIME-type patterns (e.g. <code>avatars: image/*</code>).</li>
                </ul>`,
    },
    {
      id: "ai-prompt-guide",
      category: "ai",
      title: "AI Co-Design Rules & Workflow",
      tags: ["ai", "prompt", "co-design", "copilot", "gpt", "claude"],
      summary:
        "How to use our specialized AI architect prompt to co-design schemas with Large Language Models.",
      content: `<p class="mb-2">Copy the prompt below and paste it to your favorite LLM (Claude, ChatGPT, Gemini, Copilot). It guides the AI to output correctly structured, Drizzle ORM-compliant code decorated with <code>@strata-layout</code> barrel manifests or inline <code>@strata</code> metadata comments, facilitating seamless bi-directional synchronization with Strata and your external IDE.</p>`,
    },
    {
      id: "gotcha-git-undo",
      category: "gotchas",
      title: "Git-Backed Canvas Reversion",
      tags: ["git", "undo", "revert", "history", "checkout"],
      summary:
        "Strata has no internal undo/redo history stack because it uses Git. Learn how to revert unwanted changes.",
      content: `<p class="mb-2">Strata does not manage a proprietary undo state history. Because your schema codebase is the absolute single source of truth, standard Git features handle history management:</p>
                <ul class="list-disc pl-4 space-y-1 mb-2">
                  <li><strong>Reverting Node Positions:</strong> Discard layout changes directly in your repository: <code class="bg-neutral text-neutral-content px-1.5 py-0.5 rounded text-[10px]">git checkout -- src/lib/db/schema.ts</code> (or your <code>schema/index.ts</code> in modular setups).</li>
                  <li><strong>Git-Clean Domain Files:</strong> In modular setups, dragging nodes on the canvas touches only <code>@strata-layout</code> in the root barrel file, leaving domain files (<code>users.ts</code>, <code>posts.ts</code>) untouched.</li>
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

  const aiPrompt = `You are an expert software architect specialized in Drizzle ORM and Cloudflare Workers (D1 SQLite, KV, Durable Objects, R2, and Modern Auth).
We are using Strata, an interactive visual architecture canvas for Drizzle ORM + Cloudflare D1.

You MUST follow these design & layout rules when writing or modifying Drizzle schema code for me:

1. ARCHITECTURE ARCHETYPES:
   - Modular Barrel (schema/index.ts) [Recommended for Teams]: Separate domain files (users.ts, posts.ts) and aggregate them in index.ts:
     export * from "./users";
     export * from "./posts";
     In barrel mode, layout coordinates live EXCLUSIVELY in a root @strata-layout comment to eliminate Git merge conflicts:
     /**
      * @strata-layout {
      *   "users": { "x": 100, "y": 150 },
      *   "posts": { "x": 520, "y": 150 },
      *   "__clerk_identity__": { "x": -250, "y": 150 }
      * }
      */
     CRITICAL: NEVER put @strata position comments inside individual domain files (users.ts, posts.ts). Keep domain files pure Drizzle code!
   - Single-File Monolith (schema.ts): Place entity JSDoc metadata directly above declarations:
     /** @strata { "target": "d1", "x": 100, "y": 200 } */
     export const users = sqliteTable("users", { ... });

2. DATATYPES & DIALECTS (Cloudflare D1 / SQLite):
   - Always import table builders cleanly: import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
   - SQLite does not have a native Date type. Always map dates using:
     integer("created_at", { mode: "timestamp" }) or integer("created_at", { mode: "timestamp_ms" })
   - Booleans must map to: integer("is_active", { mode: "boolean" })

3. MODERN AUTH & IDENTITY BOUNDARIES:
   - D1-Resident (Better Auth): Standard table cluster (user, session, account, verification). Custom fields (e.g. stripeCustomerId, role) live on the user table.
   - Cloud IdP Boundaries (Clerk / WorkOS): When using external IdPs, name foreign key columns clerkUserId or workosOrgId:
     clerkUserId: text("clerk_user_id").notNull()
     workosOrgId: text("workos_org_id")
     Strata automatically spawns visual Identity Boundary Nodes on the canvas with animated edge connections.
   - Webhook Mirror Tables: For local querying and joins with external users, scaffold a local mirror table (e.g. clerkUsers or workosUsers).

4. DRIZZLE RELATIONS & CROSS-MODULE DEPENDENCIES:
   - Cross-Module Foreign Keys: When referencing tables in other files, explicitly import the parent table:
     import { users } from "./users";
     and add: .references(() => users.id, { onDelete: 'cascade' })
   - Logical Relations: Use Drizzle's relations() query builder API, either in domain files or a dedicated relations.ts:
     export const usersRelations = relations(users, ({ many }) => ({ posts: many(posts) }));

5. CLOUDFLARE STORAGE TARGETS (KV, DO, R2 JSDoc Overrides):
   - D1 Table: "target": "d1" (Default)
   - Durable Objects (DO): "target": "do"
     /**
      * @strata { "target": "do", "x": 100, "y": 200, "path": "./src/do/UserDO.ts", "class": "UserDO", "methods": ["getUserInfo", "updateStatus"] }
      */
   - KV Namespaces: "target": "kv"
     /**
      * @strata { "target": "kv", "x": 150, "y": 300, "schema": { "sessionToken": "string", "failedAttempts": { "type": "number", "ttl": 3600 } } }
      */
   - R2 Buckets: "target": "r2"
     /**
      * @strata { "target": "r2", "x": 200, "y": 400, "public": true, "cors": true, "folders": { "avatars": "image/*", "documents": "application/pdf" } }
      */

6. SYNTHETIC CROSS-STORAGE LINKS:
   - For links between D1 tables and non-SQL targets (KV, DO, R2), do not declare physical SQL foreign keys. Instead, define synthetic links inside the JSDoc metadata:
     /**
      * @strata { "target": "d1", "x": 100, "y": 100, "relations": [{ "to": "SESSIONS_KV" }] }
      */

7. EXTERNAL IDE PAIRING & ZERO-JITTER WORKFLOW:
   - Strata pairs side-by-side with your primary editor (VS Code, Cursor). Changes saved to disk update the canvas in real-time.
   - Generate standard, clean Drizzle TypeScript files without proprietary runtime sidecars or config files.

Generate only valid, production-ready TypeScript code inside standard markdown codeblocks without conversational fluff.`;

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
    if (catId === "starter-templates")
      return Object.keys(SAMPLE_TEMPLATES).length;
    if (catId === "ai") return 1;
    if (catId === "jsdoc-builder") return 1;
    return docTopics.filter((t) => t.category === catId).length;
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-md p-6"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="bg-base-100 rounded-box w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl border border-base-300 overflow-hidden"
      role="dialog"
      aria-modal="true"
      data-testid="help-modal"
    >
      <!-- Header -->
      <div
        class="px-8 py-5 bg-base-200/90 border-b border-base-300 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary/10 rounded-field text-primary">
            <CircleQuestionMark class="w-5 h-5" />
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

        <div class="flex items-center gap-2">
          <button
            class="btn btn-secondary btn-xs rounded-field font-bold gap-1.5 px-3 shadow-xs"
            onclick={() => (activeTab = "starter-templates")}
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Interactive Demos</span>
          </button>
          <button
            class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
            onclick={() => (show = false)}
          >
            <X class="w-4 h-4" />
          </button>
        </div>
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
          {#if activeTab === "starter-templates"}
            <!-- Interactive Starter Templates View -->
            <div class="flex flex-col gap-4 font-sans text-xs">
              <div
                class="flex items-center justify-between border-b border-base-300 pb-2 mb-1"
              >
                <div class="flex items-center gap-2">
                  <Sparkles class="w-4 h-4 text-secondary" />
                  <h3
                    class="font-black text-sm uppercase tracking-wide text-base-content"
                  >
                    Interactive Starter Templates
                  </h3>
                </div>
                <span
                  class="badge badge-sm badge-secondary font-mono text-[10px]"
                >
                  Zero-Risk Sandbox Mode
                </span>
              </div>
              <p class="text-base-content/75 leading-relaxed">
                Explore pre-built Cloudflare D1, KV, Durable Object, and R2
                schema architectures. Loading a template populates the visual
                architecture canvas and interactive inspector instantly.
              </p>

              <div class="grid grid-cols-1 gap-3.5 mt-1">
                {#each Object.values(SAMPLE_TEMPLATES) as tpl}
                  <div
                    class="bg-base-200/40 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-2.5 hover:border-secondary/50 transition-all group"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span
                          class="font-bold text-sm text-base-content group-hover:text-secondary transitdion-colors"
                        >
                          {tpl.name}
                        </span>
                        <span
                          class="badge badge-sm badge-outline font-mono text-[10px] opacity-75 p-3"
                        >
                          {tpl.badge}
                        </span>
                      </div>
                      <button
                        class="btn btn-secondary btn-xs rounded-xl font-bold px-3 shadow-xs gap-1 ml-2"
                        onclick={() => loadStarterTemplate(tpl.key)}
                      >
                        Load Template ➔
                      </button>
                    </div>
                    <p
                      class="text-[11px] text-base-content/70 leading-relaxed font-sans"
                    >
                      {tpl.description}
                    </p>
                  </div>
                {/each}
              </div>
            </div>
          {:else if activeTab === "jsdoc-builder"}
            <!-- JSDoc Metadata Builder GUI -->
            <div class="flex flex-col gap-4 font-sans text-xs">
              <div
                class="flex items-center justify-between border-b border-base-300 pb-2 mb-1"
              >
                <div class="flex items-center gap-2">
                  <Wrench class="w-4 h-4 text-primary" />
                  <h3
                    class="font-black text-sm uppercase tracking-wide text-base-content"
                  >
                    JSDoc Metadata Builder
                  </h3>
                </div>

                <!-- Pattern Archetype Switcher -->
                <div
                  class="flex items-center gap-1 p-1 bg-base-200 rounded-xl border border-base-300"
                >
                  <button
                    type="button"
                    class="btn btn-xs rounded-lg px-2.5 transition-all {builderMode === 'barrel' ? 'btn-primary font-bold shadow-sm' : 'btn-ghost text-base-content/70'}"
                    onclick={() => (builderMode = "barrel")}
                  >
                    <Layers class="w-3 h-3" />
                    <span>Modular Barrel (@strata-layout)</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs rounded-lg px-2.5 transition-all {builderMode === 'single' ? 'btn-primary font-bold shadow-sm' : 'btn-ghost text-base-content/70'}"
                    onclick={() => (builderMode = "single")}
                  >
                    <Database class="w-3 h-3" />
                    <span>Single-File Entity (@strata)</span>
                  </button>
                </div>
              </div>

              {#if builderMode === "barrel"}
                <p class="text-base-content/75 leading-relaxed">
                  Generate the consolidated <code>@strata-layout</code> manifest for your barrel file (<code>schema/index.ts</code>).
                  This stores all canvas coordinates in one central manifest, ensuring <strong>zero Git diff noise</strong> in your domain files (<code>users.ts</code>, <code>posts.ts</code>).
                </p>

                <!-- Barrel Controls -->
                <div
                  class="bg-base-200/50 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-3.5"
                >
                  <div class="flex items-center justify-between border-b border-base-300/50 pb-1.5">
                    <span class="font-bold text-[10px] uppercase text-primary tracking-wider">Barrel Entities & Quick Presets</span>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="text-[9px] px-2 py-0.5 rounded-md bg-base-100 hover:bg-base-300 font-bold text-primary transition-all"
                        onclick={() => loadBarrelPreset("blog")}
                      >
                        Blog + Clerk
                      </button>
                      <button
                        type="button"
                        class="text-[9px] px-2 py-0.5 rounded-md bg-base-100 hover:bg-base-300 font-bold text-primary transition-all"
                        onclick={() => loadBarrelPreset("ecommerce")}
                      >
                        E-Commerce + WorkOS
                      </button>
                      <button
                        type="button"
                        class="text-[9px] px-2 py-0.5 rounded-md bg-base-100 hover:bg-base-300 font-bold text-primary transition-all"
                        onclick={() => loadBarrelPreset("saas")}
                      >
                        Multi-Tenant SaaS
                      </button>
                    </div>
                  </div>

                  <label class="flex flex-col gap-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-[10px] uppercase text-base-content/65">Entities / Table Names</span>
                      <span class="text-[9px] opacity-50">Comma-separated module identifiers</span>
                    </div>
                    <input
                      type="text"
                      bind:value={barrelEntities}
                      placeholder="e.g. users, posts, comments, categories"
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                    {#if barrelError}
                      <span class="text-[9px] text-error font-semibold mt-0.5">{barrelError}</span>
                    {:else}
                      <span class="text-[9px] opacity-40 font-medium mt-0.5">Tip: Enter domain entity names. Each name will be assigned grid coordinates in the layout manifest.</span>
                    {/if}
                  </label>

                  <!-- Virtual Identity Boundary Options -->
                  <div class="flex items-center gap-6 py-1 border-t border-base-300/40 pt-2.5">
                    <label class="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-base-content/70 select-none">
                      <input
                        type="checkbox"
                        bind:checked={includeClerkBoundary}
                        class="checkbox checkbox-xs checkbox-primary rounded"
                      />
                      <span>Include Clerk Node (__clerk_identity__)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-base-content/70 select-none">
                      <input
                        type="checkbox"
                        bind:checked={includeWorkosBoundary}
                        class="checkbox checkbox-xs checkbox-primary rounded"
                      />
                      <span>Include WorkOS Node (__workos_identity__)</span>
                    </label>
                  </div>

                  <!-- Layout Grid Parameters -->
                  <div class="grid grid-cols-4 gap-3 border-t border-base-300/40 pt-2.5">
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <span class="font-bold text-[10px] uppercase text-base-content/60">Grid Columns</span>
                      <input
                        type="number"
                        bind:value={barrelColumns}
                        min="1"
                        max="6"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                    </label>
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <span class="font-bold text-[10px] uppercase text-base-content/60">Col Gap (px)</span>
                      <input
                        type="number"
                        bind:value={barrelSpacingX}
                        step="20"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                    </label>
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <span class="font-bold text-[10px] uppercase text-base-content/60">Row Gap (px)</span>
                      <input
                        type="number"
                        bind:value={barrelSpacingY}
                        step="20"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                    </label>
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <span class="font-bold text-[10px] uppercase text-base-content/60">Start X (px)</span>
                      <input
                        type="number"
                        bind:value={barrelStartX}
                        step="20"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                    </label>
                  </div>
                </div>

              {:else}
                <p class="text-base-content/75 leading-relaxed">
                  Use this interactive tool to build inline <code>@strata</code> comments for single-file schemas (<code>schema.ts</code>).
                  Paste the generated block directly above your table, object, or connection declarations.
                </p>

                <!-- Basic Fields -->
                <div
                  class="grid grid-cols-3 gap-3 bg-base-200/50 p-4 rounded-2xl border border-base-300/60 mt-1"
                >
                  <label class="flex flex-col gap-1 cursor-pointer">
                    <div class="flex items-center justify-between">
                      <span
                        class="font-bold text-[10px] uppercase text-base-content/60"
                        >Storage Target</span
                      >
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
                    <span
                      class="font-bold text-[10px] uppercase text-base-content/60"
                      >Position X (px)</span
                    >
                    <input
                      type="number"
                      bind:value={builderX}
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                  </label>
                  <label class="flex flex-col gap-1 cursor-pointer">
                    <span
                      class="font-bold text-[10px] uppercase text-base-content/60"
                      >Position Y (px)</span
                    >
                    <input
                      type="number"
                      bind:value={builderY}
                      class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                    />
                  </label>
                </div>

                <!-- Target Specific Parameters -->
                <div
                  class="bg-base-200/50 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-3"
                >
                  <h4
                    class="font-bold text-[10px] uppercase tracking-wider text-primary border-b border-base-300/50 pb-1"
                  >
                    Target Configurations
                  </h4>

                  {#if builderTarget === "d1"}
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <div class="flex items-center justify-between">
                        <span
                          class="font-bold text-[10px] uppercase text-base-content/65"
                          >Synthetic Relations</span
                        >
                        <span class="text-[9px] opacity-50"
                          >Comma-separated target node names</span
                        >
                      </div>
                      <input
                        type="text"
                        bind:value={builderD1Relations}
                        placeholder="e.g. USERS_KV, IMAGES_R2"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                      {#if relationsError}
                        <span class="text-[9px] text-error font-semibold mt-0.5"
                          >{relationsError}</span
                        >
                      {:else}
                        <span class="text-[9px] opacity-40 font-medium mt-0.5"
                          >Tip: Points to targets in your diagram (e.g. KV
                          namespaces or buckets).</span
                        >
                      {/if}
                    </label>
                  {:else if builderTarget === "do"}
                    <div class="grid grid-cols-2 gap-3">
                      <label class="flex flex-col gap-1 cursor-pointer">
                        <span
                          class="font-bold text-[10px] uppercase text-base-content/65"
                          >DO Class File Path</span
                        >
                        <input
                          type="text"
                          bind:value={builderDOPath}
                          placeholder="e.g. ./src/do/UserDO.ts"
                          class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                        />
                      </label>
                      <label class="flex flex-col gap-1 cursor-pointer">
                        <span
                          class="font-bold text-[10px] uppercase text-base-content/65"
                          >DO Class Name</span
                        >
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
                        <span
                          class="font-bold text-[10px] uppercase text-base-content/65"
                          >Public Methods</span
                        >
                        <span class="text-[9px] opacity-50"
                          >Comma-separated list</span
                        >
                      </div>
                      <input
                        type="text"
                        bind:value={builderDOMethods}
                        placeholder="e.g. login, logout, getProfile"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                      <span class="text-[9px] opacity-40 font-medium mt-0.5"
                        >Tip: Declare custom method names and signatures (e.g. <code
                          >fetchData(id: string)</code
                        >).</span
                      >
                    </label>
                  {:else if builderTarget === "kv"}
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <div class="flex items-center justify-between">
                        <span
                          class="font-bold text-[10px] uppercase text-base-content/65"
                          >KV Key Mappings</span
                        >
                        <span class="text-[9px] opacity-50"
                          >Comma-separated key:type mappings</span
                        >
                      </div>
                      <input
                        type="text"
                        bind:value={builderKVMappings}
                        placeholder="e.g. sessionToken:string, attempts:number, meta:any"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                      {#if kvError}
                        <span class="text-[9px] text-error font-semibold mt-0.5"
                          >{kvError}</span
                        >
                      {:else}
                        <span class="text-[9px] opacity-40 font-medium mt-0.5"
                          >Tip: Enter <code>keyName:type</code> pairs (supported types:
                          string, number, boolean, any).</span
                        >
                      {/if}
                    </label>
                  {:else if builderTarget === "r2"}
                    <div class="flex items-center gap-6 py-1">
                      <label
                        class="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-base-content/65 select-none"
                      >
                        <input
                          type="checkbox"
                          bind:checked={builderR2Public}
                          class="checkbox checkbox-xs checkbox-primary rounded"
                        />
                        <span>Public Access Enabled</span>
                      </label>
                      <label
                        class="flex items-center gap-2 cursor-pointer font-bold text-[10px] uppercase text-base-content/65 select-none"
                      >
                        <input
                          type="checkbox"
                          bind:checked={builderR2Cors}
                          class="checkbox checkbox-xs checkbox-primary rounded"
                        />
                        <span>CORS Enabled</span>
                      </label>
                    </div>
                    <label class="flex flex-col gap-1 cursor-pointer">
                      <div class="flex items-center justify-between">
                        <span
                          class="font-bold text-[10px] uppercase text-base-content/65"
                          >Folder Filters</span
                        >
                        <span class="text-[9px] opacity-50"
                          >Comma-separated folderName:mime/type pairs</span
                        >
                      </div>
                      <input
                        type="text"
                        bind:value={builderR2Folders}
                        placeholder="e.g. avatars:image/*, data:application/json"
                        class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                      />
                      {#if r2Error}
                        <span class="text-[9px] text-error font-semibold mt-0.5"
                          >{r2Error}</span
                        >
                      {:else}
                        <span class="text-[9px] opacity-40 font-medium mt-0.5"
                          >Tip: Enter <code>folderName:mime/type</code> (e.g.
                          <code>avatars:image/*</code>).</span
                        >
                      {/if}
                    </label>
                  {/if}
                </div>
              {/if}

              <!-- Output Display -->
              <div
                class="bg-base-200/50 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-3 mt-1 relative group/output"
              >
                <div
                  class="flex items-center justify-between border-b border-base-300/50 pb-1.5"
                >
                  <span
                    class="font-bold text-[10px] uppercase tracking-wider text-success"
                  >
                    {builderMode === "barrel"
                      ? "Generated Barrel Manifest (schema/index.ts)"
                      : "Generated Entity JSDoc (schema.ts)"}
                  </span>
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
                <pre
                  class="bg-neutral text-neutral-content p-4 rounded-xl text-[10px] font-mono leading-relaxed overflow-x-auto border border-white/5 max-h-56 overflow-y-auto selection:bg-primary/30 select-all">{activeJSDocOutput}</pre>
              </div>
            </div>
          {:else}
            {#if searchQuery}
              <div
                class="flex items-center justify-between text-xs text-base-content/60 border-b border-base-200 pb-2"
              >
                <span
                  >Found <strong>{filteredTopics.length}</strong> matching
                  results for "{searchQuery}"</span
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
                <div class="flex items-center justify-between gap-2">
                  <h4
                    class="font-bold text-xs text-base-content group-hover/card:text-primary transition-colors flex items-center gap-1.5"
                  >
                    {#if topic.category === "troubleshooting"}
                      <TriangleAlert
                        class="w-3.5 h-3.5 text-warning shrink-0"
                      />
                    {:else if topic.category === "achievements"}
                      <History class="w-3.5 h-3.5 text-success shrink-0" />
                    {:else}
                      <Info class="w-3.5 h-3.5 text-primary shrink-0" />
                    {/if}
                    {topic.title}
                  </h4>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      class="btn btn-ghost btn-xs text-base-content/60 hover:text-primary hover:bg-base-300 rounded-lg flex items-center gap-1 transition-all px-2 py-0.5"
                      onclick={() => copyCardContent(topic)}
                      title="Copy guide text for LLM prompt"
                    >
                      {#if copiedTopicId === topic.id}
                        <Check class="w-3 h-3 text-success" />
                        <span class="text-[9px] font-bold text-success"
                          >Copied!</span
                        >
                      {:else}
                        <Copy class="w-3 h-3 opacity-70" />
                        <span class="text-[9px] font-medium">Copy</span>
                      {/if}
                    </button>
                    <span
                      class="badge badge-outline badge-xs opacity-60 text-[9px] font-mono capitalize"
                    >
                      {topic.category === "achievements"
                        ? "Architecture"
                        : topic.category.replace("-", " ")}
                    </span>
                  </div>
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
                    <span class="font-bold text-xs"
                      >Copy AI Architect Prompt</span
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
          DESIGNED FOR DRIZZLE ORM + CLOUDFLARE BINDINGS
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
