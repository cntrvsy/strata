<!--
  IdentityNode.svelte

  Summary: Svelte Flow custom node rendering an external Identity Provider (Clerk, WorkOS) boundary.
  Expects: Svelte Flow node props (id, data, selected, etc.).
  Output: Visual IdP node card with boundary handles and 1-click webhook mirror scaffolding.
-->
<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import { schemaState } from "#lib/state";
  import {
    FingerprintPattern,
    Building2,
    Sparkles,
    ArrowUpRight,
    Link2,
  } from "lucide-svelte";

  const { data, selected } = $props<{
    data: {
      provider: "clerk" | "workos";
      label: string;
      title: string;
      description: string;
      boundTables?: Array<{ tableId: string; colName: string }>;
    };
    selected?: boolean;
  }>();

  const isClerk = $derived(data.provider === "clerk");
  const config = $derived(
    isClerk
      ? {
          name: "Clerk",
          badge: "Clerk Auth",
          gradient: "from-purple-500/20 via-indigo-500/10 to-transparent",
          border: "border-purple-500/40 hover:border-purple-500/80",
          glow: "ring-purple-500/30",
          badgeClass: "badge-secondary",
          icon: FingerprintPattern,
          textColor: "text-purple-400",
          docsUrl: "https://clerk.com/docs/integrations/webhooks/sync-data",
        }
      : {
          name: "WorkOS",
          badge: "WorkOS SSO",
          gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
          border: "border-emerald-500/40 hover:border-emerald-500/80",
          glow: "ring-emerald-500/30",
          badgeClass: "badge-accent",
          icon: Building2,
          textColor: "text-emerald-400",
          docsUrl: "https://workos.com/docs/events",
        },
  );

  async function handleScaffoldMirror() {
    await schemaState.scaffoldWebhookMirror(data.provider);
  }
</script>

<div
  class="relative group/identity min-w-64 max-w-72 transition-all duration-300"
  data-testid="identity-node"
  data-provider={data.provider}
>
  <div
    class="bg-base-100/95 backdrop-blur-md border rounded-box overflow-hidden shadow-xl transition-all duration-200 {config.border} {selected
      ? `ring-2 ${config.glow}`
      : ''}"
  >
    <!-- Header Banner -->
    <div
      class="bg-linear-to-r {config.gradient} p-3 border-b border-base-300 flex items-center justify-between"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="p-2 bg-base-100 rounded-lg shadow-sm border border-base-300"
        >
          <config.icon class="w-4 h-4 {config.textColor}" />
        </div>
        <div>
          <div
            class="font-bold text-xs tracking-wide flex items-center gap-1.5"
          >
            <span>{config.name}</span>
            <span
              class="badge badge-xs {config.badgeClass} font-mono text-[9px] py-1"
            >
              External IdP
            </span>
          </div>
          <p class="text-[10px] text-base-content/60 leading-tight mt-0.5">
            {data.description}
          </p>
        </div>
      </div>
    </div>

    <!-- Bound Tables List -->
    <div class="p-3 space-y-2 text-xs">
      <div
        class="flex items-center justify-between text-[11px] text-base-content/70 font-semibold"
      >
        <span class="flex items-center gap-1">
          <Link2 class="w-3.5 h-3.5 opacity-70" />
          Bound Foreign Keys
        </span>
        <span class="badge badge-ghost badge-xs font-mono text-[9px]">
          {data.boundTables?.length || 0}
        </span>
      </div>

      {#if data.boundTables && data.boundTables.length > 0}
        <div class="space-y-1 max-h-28 overflow-y-auto pr-1">
          {#each data.boundTables as bound}
            <div
              class="flex items-center justify-between px-2 py-1 bg-base-200/60 rounded text-[10px] font-mono border border-base-300/40"
            >
              <span class="text-base-content/90 font-medium"
                >{bound.tableId}</span
              >
              <span class="text-primary/90">.{bound.colName}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-[10px] text-base-content/50 italic">
          No schema tables currently reference this identity provider.
        </p>
      {/if}

      <!-- Actions -->
      <div class="pt-2 border-t border-base-300/60 flex flex-col gap-1.5">
        <button
          type="button"
          class="btn btn-xs btn-outline btn-primary w-full gap-1.5 font-sans font-semibold text-[10px] shadow-sm hover:scale-[1.01] transition-transform"
          onclick={handleScaffoldMirror}
          title="Create a local D1 mirror table with webhook fields"
        >
          <Sparkles class="w-3 h-3" />
          Scaffold D1 Mirror Table
        </button>

        <a
          href={config.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-xs btn-ghost w-full gap-1 text-[10px] text-base-content/60 hover:text-base-content"
        >
          <span>Webhook Sync Docs</span>
          <ArrowUpRight class="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  </div>

  <!-- Svelte Flow Handles for Virtual Edges -->
  <Handle
    type="target"
    position={Position.Left}
    class="w-3 h-3 bg-primary border-2 border-base-100 rounded-full"
  />
  <Handle
    type="source"
    position={Position.Right}
    class="w-3 h-3 bg-primary border-2 border-base-100 rounded-full"
  />
</div>
