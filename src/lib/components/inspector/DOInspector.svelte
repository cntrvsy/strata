<!--
  DOInspector.svelte

  Summary: Sub-inspector displaying Durable Object class bindings, TS source paths, wrangler configuration status, and public RPC methods.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
  Output: Read-only telemetry for Durable Objects.
-->
<script lang="ts">
  import {
    FileCode,
    TriangleAlert,
    Cpu,
    Layers,
    Code,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  const strataData = $derived(data.strata || {});
  const doClassName = $derived(strataData.class || data.doClass || tableName);
  const doPathName = $derived(strataData.path || data.doPath || "");
  const missingWarning = $derived(strataData.missingFileWarning);

  const wranglerBinding = $derived(
    schemaState.wranglerBindings.find(
      (b) =>
        (b.name === tableName || b.name === strataData.binding) &&
        b.type === "do",
    ),
  );

  const columns = $derived(data?.columns || []);
  const isSqlite = $derived(
    data.storage === "sqlite" ||
      (wranglerBinding?.extra as any)?.storage === "sqlite" ||
      data.isSqlite,
  );
</script>

<div class="flex flex-col gap-4">
  <!-- Cloudflare Worker Binding Read-Only Overlay Banner -->
  <div class="px-3 py-2 bg-secondary/10 border border-secondary/20 rounded-box flex items-center justify-between text-[11px]">
    <span class="font-bold text-secondary">Cloudflare Durable Object</span>
    <span class="text-[10px] opacity-70 font-mono">wrangler.jsonc</span>
  </div>

  <!-- Class & Wrangler Binding Configuration Card -->
  <div
    class="bg-base-200/50 p-4 rounded-box border border-base-300/70 flex flex-col gap-3"
  >
    <div class="flex items-center justify-between">
      <span class="text-[9px] font-black uppercase tracking-widest opacity-40">
        Class & Binding Details
      </span>
      <div class="flex items-center gap-1.5">
        {#if wranglerBinding}
          <span
            class="badge badge-xs bg-success/10 text-success border-success/20 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono"
          >
            Bound: {wranglerBinding.name}
          </span>
        {:else}
          <span
            class="badge badge-xs bg-warning/10 text-warning border-warning/20 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono"
            title="Binding not found in wrangler.jsonc"
          >
            Unbound
          </span>
        {/if}
      </div>
    </div>

    <!-- Class Name Display -->
    <div class="flex flex-col gap-1">
      <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/60">Class Name</span>
      <div class="p-2 rounded-field bg-base-100 border border-base-300 font-mono text-xs font-bold text-secondary">
        {doClassName}
      </div>
    </div>

    <!-- TS Path Display -->
    {#if doPathName}
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/60">Source File</span>
        <div class="p-2 rounded-field bg-base-100 border border-base-300 font-mono text-[11px] text-base-content/80 break-all">
          {doPathName}
        </div>
      </div>
    {/if}

    <!-- Storage Engine Display -->
    <div class="flex items-center justify-between p-2 rounded-field bg-base-100 border border-base-300 text-xs">
      <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/60">Storage Engine</span>
      <span class="badge badge-xs {isSqlite ? 'badge-warning font-bold' : 'badge-ghost'} font-mono text-[9px]">
        {isSqlite ? "SQLite DO (Embedded DB)" : "Standard Key-Value"}
      </span>
    </div>
  </div>

  <!-- Missing File Warning Banner -->
  {#if missingWarning}
    <div
      class="p-3 bg-warning/10 border border-warning/20 rounded-box text-[11px] text-base-content/90 flex items-start gap-2.5 leading-relaxed"
    >
      <TriangleAlert class="w-4 h-4 text-warning shrink-0 mt-0.5" />
      <div class="flex flex-col gap-0.5">
        <span class="font-bold text-xs text-warning">Source File Warning</span>
        <span>{missingWarning}</span>
      </div>
    </div>
  {/if}

  <!-- Methods Header -->
  <div class="flex items-center justify-between px-1">
    <span class="text-[9px] font-black uppercase tracking-widest opacity-40">
      Public RPC Methods ({columns.length})
    </span>
  </div>

  <!-- Methods List -->
  <div class="flex flex-col gap-2">
    {#if columns.length === 0}
      <div
        class="p-6 bg-base-200/30 border border-base-300/40 rounded-box flex flex-col items-center justify-center text-center gap-2"
      >
        <Layers class="w-6 h-6 opacity-30 text-secondary" />
        <span class="text-xs font-semibold opacity-70">
          No Public Methods Detected
        </span>
        <p class="text-[10px] text-base-content/50 max-w-60 leading-relaxed">
          Public class methods in <code class="font-mono text-secondary"
            >{doClassName}</code
          > are parsed automatically from TypeScript source.
        </p>
      </div>
    {:else}
      {#each columns as col}
        <div
          class="bg-base-200/40 p-3 rounded-box flex flex-col gap-1.5 border border-base-300/50 hover:border-secondary/40 transition-all group/field"
          data-testid="field-row-{col.name}"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="font-mono text-xs font-bold text-secondary break-all leading-tight group-hover/field:text-primary transition-colors"
              title={col.name}
              data-testid="field-name-{col.name}"
            >
              {col.name}
            </span>

            <span
              class="text-[9px] font-mono bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded leading-none font-bold shrink-0"
            >
              {col.definition}
            </span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
