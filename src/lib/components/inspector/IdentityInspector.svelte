<!--
  IdentityInspector.svelte

  Summary: Dedicated inspector panel for virtual Identity Provider boundary nodes (Clerk, WorkOS).
  Expects: Svelte Flow node and onDismiss callback.
  Output: IdP overview, boundary connection list, webhook mirror scaffolding, and Drizzle snippets.
-->
<script lang="ts">
  import {
    FingerprintPattern,
    Building2,
    ShieldCheck,
    Sparkles,
    ExternalLink,
    Copy,
    Check,
    Link2,
    ArrowRight,
    X,
    Code,
    Database,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";

  const { node, onDismiss } = $props<{
    node: any;
    onDismiss: () => void;
  }>();

  const data = $derived(node?.data || {});
  const provider = $derived<"clerk" | "workos">(data.provider || "clerk");
  const isClerk = $derived(provider === "clerk");

  const config = $derived(
    isClerk
      ? {
          name: "Clerk",
          title: "Clerk Authentication",
          badge: "Clerk Auth",
          gradient: "from-purple-500/20 via-indigo-500/10 to-transparent",
          borderColor: "border-purple-500/40",
          badgeClass: "badge-secondary",
          icon: FingerprintPattern,
          textColor: "text-purple-400",
          iconBg: "bg-purple-500/10",
          docsUrl: "https://clerk.com/docs/integrations/webhooks/sync-data",
          mirrorTableName: "clerkUsers",
          mirrorKey: "clerkUserId",
          description:
            "Clerk manages hosted user authentication, session tokens, and passwords. Your D1 database stores user foreign keys (e.g. clerkUserId) synchronized via Clerk Webhooks.",
          snippet: `// Recommended D1 Webhook User Mirror
export const clerkUsers = sqliteTable("clerkUsers", {
  id: text("id").primaryKey(), // Clerk User ID (user_2...)
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
});`,
        }
      : {
          name: "WorkOS",
          title: "WorkOS Enterprise SSO",
          badge: "WorkOS SSO",
          gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
          borderColor: "border-emerald-500/40",
          badgeClass: "badge-accent",
          icon: Building2,
          textColor: "text-emerald-400",
          iconBg: "bg-emerald-500/10",
          docsUrl: "https://workos.com/docs/events",
          mirrorTableName: "workosUsers",
          mirrorKey: "workosUserId",
          description:
            "WorkOS manages Enterprise Single Sign-On (SAML/OIDC) and Directory Sync (SCIM). Your D1 database stores organization and enterprise user references synchronized via WorkOS Webhook Events.",
          snippet: `// Recommended D1 WorkOS Organization Mirror
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(), // WorkOS Org ID (org_...)
  name: text("name").notNull(),
  workosOrgId: text("workos_org_id").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
});`,
        },
  );

  const boundTables = $derived<Array<{ tableId: string; colName: string }>>(
    data.boundTables || [],
  );

  // Check if a mirror table already exists in the schema
  const mirrorTableNode = $derived(
    schemaState.nodes.find(
      (n) =>
        n.id === config.mirrorTableName ||
        (n.data as any)?.columns?.some((c: any) => c.name === config.mirrorKey),
    ),
  );

  let isScaffolding = $state(false);
  let copiedSnippet = $state(false);
  let isSnippetOpen = $state(false);

  async function handleScaffoldMirror() {
    isScaffolding = true;
    try {
      await schemaState.scaffoldWebhookMirror(provider);
    } finally {
      isScaffolding = false;
    }
  }

  function handleOpenDocs() {
    PlatformService.openExternal(config.docsUrl);
  }

  function handleCopySnippet() {
    navigator.clipboard.writeText(config.snippet);
    copiedSnippet = true;
    setTimeout(() => {
      copiedSnippet = false;
    }, 2000);
  }

  function navigateToTable(tableId: string) {
    schemaState.activeInspectorNodeId = tableId;
    schemaState.nodes = schemaState.nodes.map((n) => ({
      ...n,
      selected: n.id === tableId,
    }));
  }
</script>

<div
  class="w-full h-full max-h-full bg-base-100 border-l border-base-300 flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-right-8 duration-300 select-none"
  data-testid="identity-inspector-panel"
>
  <!-- Header -->
  <div
    class="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50"
  >
    <div class="flex items-center gap-3">
      <div class="p-2.5 {config.iconBg} rounded-field shadow-xs">
        <config.icon class="w-4 h-4 {config.textColor}" />
      </div>
      <div class="flex flex-col">
        <div class="flex items-center gap-2">
          <h3
            class="font-bold text-sm tracking-tight leading-none text-base-content"
            data-testid="identity-inspector-title"
          >
            {config.title}
          </h3>
          <span
            class="badge badge-xs {config.badgeClass} font-mono text-[9px] py-1"
          >
            External IdP
          </span>
        </div>
        <span
          class="text-[9.5px] uppercase tracking-wider font-bold text-base-content/60 mt-0.5"
        >
          Cloud Identity Boundary
        </span>
      </div>
    </div>

    <button
      class="btn btn-ghost btn-xs btn-circle hover:bg-base-200"
      onclick={onDismiss}
      title="Close Inspector"
      data-testid="identity-inspector-close"
    >
      <X class="w-4 h-4 opacity-60" />
    </button>
  </div>

  <!-- Content Body -->
  <div class="flex-1 overflow-y-auto p-5 space-y-5">
    <!-- Provider Overview Card -->
    <div
      class="bg-linear-to-br {config.gradient} border {config.borderColor} rounded-box p-4 space-y-3 shadow-sm"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 {config.textColor}" />
          <span class="font-bold text-xs text-base-content"
            >{config.name} Identity Provider</span
          >
        </div>
        <button
          class="btn btn-ghost btn-xs text-[10px] gap-1 hover:bg-base-100/50 text-base-content/75"
          onclick={handleOpenDocs}
        >
          <span>Docs</span>
          <ExternalLink class="w-3 h-3 opacity-70" />
        </button>
      </div>

      <p class="text-xs text-base-content/75 leading-relaxed">
        {config.description}
      </p>
    </div>

    <!-- Bound Database Tables Section -->
    <div class="space-y-2.5">
      <div class="flex items-center justify-between">
        <div
          class="flex items-center gap-1.5 text-xs font-bold text-base-content/80"
        >
          <Link2 class="w-3.5 h-3.5 text-primary" />
          <span>Bound D1 Schema Tables</span>
        </div>
        <span class="badge badge-sm badge-neutral font-mono text-[10px]">
          {boundTables.length}
          {boundTables.length === 1 ? "connection" : "connections"}
        </span>
      </div>

      {#if boundTables.length === 0}
        <div
          class="bg-base-200/40 border border-base-300/40 rounded-box p-4 text-center text-xs text-base-content/60"
        >
          No local tables currently reference this identity provider.
        </div>
      {:else}
        <div class="space-y-1.5">
          {#each boundTables as bound}
            <div
              class="flex items-center justify-between p-2.5 bg-base-200/40 hover:bg-base-200/80 border border-base-300/40 hover:border-base-300/80 rounded-field transition-all group/bound"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Database
                  class="w-3.5 h-3.5 opacity-60 shrink-0 text-primary"
                />
                <div class="flex flex-col min-w-0">
                  <span class="font-bold text-xs text-base-content truncate">
                    {bound.tableId}
                  </span>
                  <span
                    class="font-mono text-[10px] text-base-content/60 truncate"
                  >
                    column: <span class="text-primary font-semibold"
                      >{bound.colName}</span
                    > → IdP
                  </span>
                </div>
              </div>

              <button
                class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover/bound:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                onclick={() => navigateToTable(bound.tableId)}
                title="Inspect table {bound.tableId}"
              >
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Webhook Scaffolding CTA -->
    <div class="space-y-2.5">
      <div
        class="flex items-center gap-1.5 text-xs font-bold text-base-content/80"
      >
        <Sparkles class="w-3.5 h-3.5 text-warning" />
        <span>Webhook Profile Sync</span>
      </div>

      {#if mirrorTableNode}
        <div
          class="p-3 bg-success/10 border border-success/30 rounded-box flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <Check class="w-4 h-4 text-success" />
            <div class="flex flex-col">
              <span class="text-xs font-bold text-success"
                >D1 Mirror Table Active</span
              >
              <span class="text-[10px] text-base-content/70 font-mono">
                Table: {mirrorTableNode.id}
              </span>
            </div>
          </div>
          <button
            class="btn btn-ghost btn-xs text-xs font-semibold hover:bg-success/20 text-success"
            onclick={() => navigateToTable(mirrorTableNode.id)}
          >
            Inspect
          </button>
        </div>
      {:else}
        <div
          class="p-4 bg-base-200/50 border border-base-300 rounded-box space-y-3"
        >
          <div class="text-xs text-base-content/75 leading-relaxed">
            Need to store user profiles or org details locally for fast joins in
            Cloudflare D1?
          </div>
          <button
            class="btn btn-primary btn-sm w-full gap-2 font-bold shadow-sm"
            onclick={handleScaffoldMirror}
            disabled={isScaffolding}
            data-testid="scaffold-mirror-btn"
          >
            {#if isScaffolding}
              <span class="loading loading-spinner loading-xs"></span>
              <span>Scaffolding Mirror Table...</span>
            {:else}
              <Sparkles class="w-4 h-4" />
              <span>Scaffold {config.mirrorTableName} Mirror Table</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>

    <!-- Reference Schema Snippet (Collapsible) -->
    <div class="border border-base-300 rounded-box overflow-hidden">
      <button
        class="w-full px-4 py-3 bg-base-200/40 hover:bg-base-200/70 flex items-center justify-between transition-colors text-left"
        onclick={() => (isSnippetOpen = !isSnippetOpen)}
      >
        <div class="flex items-center gap-2">
          <Code class="w-3.5 h-3.5 text-base-content/60" />
          <span class="text-xs font-bold text-base-content/80"
            >Drizzle Schema Pattern</span
          >
        </div>
        <span class="text-[10px] text-base-content/50 uppercase font-bold">
          {isSnippetOpen ? "Hide" : "View"}
        </span>
      </button>

      {#if isSnippetOpen}
        <div class="p-3 bg-base-300/30 border-t border-base-300 space-y-2">
          <div
            class="flex items-center justify-between text-[11px] text-base-content/60"
          >
            <span class="font-mono text-[10px]">drizzle-orm/sqlite-core</span>
            <button
              class="btn btn-ghost btn-xs gap-1 font-mono text-[10px] hover:bg-base-200"
              onclick={handleCopySnippet}
            >
              {#if copiedSnippet}
                <Check class="w-3 h-3 text-success" />
                <span class="text-success font-bold">Copied!</span>
              {:else}
                <Copy class="w-3 h-3 opacity-70" />
                <span>Copy</span>
              {/if}
            </button>
          </div>
          <pre
            class="p-3 bg-base-300/70 rounded-field font-mono text-[11px] text-base-content/90 overflow-x-auto leading-relaxed border border-base-300/80"><code
              >{config.snippet}</code
            ></pre>
        </div>
      {/if}
    </div>
  </div>
</div>
