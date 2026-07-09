<!--
  SchemaStats.svelte

  Summary: Bottom statistics overlay showing counts of D1 tables, KVs, DOs, and relations in the active schema.
  Expects: None (shares global schemaState).
  Output: Visual stats panel with toggleable details view.
-->
<script lang="ts">
  import { schemaState } from "../state";
  import { Database, Cpu, Zap, Layers, ChevronDown, ChevronUp } from "lucide-svelte";
  import { slide } from "svelte/transition";

  let isCollapsed = $state(true);

  const stats = $derived.by(() => {
    const nodes = schemaState.nodes;
    const edges = schemaState.edges;

    return {
      d1: nodes.filter(
        (n) => (n.data as any).target === "d1" || !(n.data as any).target,
      ).length,
      do: nodes.filter((n) => (n.data as any).target === "do").length,
      kv: nodes.filter((n) => (n.data as any).target === "kv").length,
      columns: nodes.reduce(
        (acc, n) => acc + ((n.data as any).columns?.length || 0),
        0,
      ),
      relations: edges.length,
      total: nodes.length,
    };
  });
</script>

<div
  class="absolute top-24 right-6 z-10 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-right-4 duration-500"
>
  {#if isCollapsed}
    <button
      onclick={() => (isCollapsed = false)}
      class="btn btn-sm bg-base-100/75 backdrop-blur-md border border-base-300/80 rounded-full shadow-lg hover:border-primary/40 flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all"
    >
      <Layers class="w-3.5 h-3.5 text-primary" />
      <span class="opacity-60 text-[10px] uppercase tracking-wider">Stats</span>
      <span class="badge badge-primary badge-xs scale-90 text-primary-content font-bold">{stats.total}</span>
    </button>
  {:else}
    <div
      class="bg-base-100/75 backdrop-blur-md border border-base-300/80 rounded-2xl shadow-2xl p-4 min-w-[200px]"
      transition:slide={{ duration: 200 }}
    >
      <div class="flex items-center justify-between gap-4 mb-4 border-b border-base-300/60 pb-2">
        <div class="flex items-center gap-2">
          <Layers class="w-4 h-4 text-primary" />
          <span class="text-[10px] font-bold uppercase tracking-wider opacity-50"
            >Schema Stats</span
          >
        </div>
        <button
          onclick={() => (isCollapsed = true)}
          class="btn btn-ghost btn-xs btn-circle hover:bg-base-200"
        >
          <ChevronUp class="w-3.5 h-3.5 opacity-60" />
        </button>
      </div>

      <div class="flex flex-col gap-3">
        <!-- Entity Breakdown -->
        <div class="grid grid-cols-3 gap-2">
          <button
            onclick={() =>
              (schemaState.activeFilter =
                schemaState.activeFilter === "d1" ? null : "d1")}
            class="flex flex-col items-center p-2 bg-primary/5 rounded-xl border transition-all {schemaState.activeFilter ===
            'd1'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-primary/10 hover:bg-primary/10 hover:border-primary/30'}"
          >
            <Database class="w-3 h-3 text-primary mb-1" />
            <span class="text-xs font-bold text-base-content/85">{stats.d1}</span>
            <span class="text-[8px] opacity-50 uppercase font-semibold">D1</span>
          </button>
          <button
            onclick={() =>
              (schemaState.activeFilter =
                schemaState.activeFilter === "do" ? null : "do")}
            class="flex flex-col items-center p-2 bg-secondary/5 rounded-xl border transition-all {schemaState.activeFilter ===
            'do'
              ? 'border-secondary bg-secondary/10 shadow-sm'
              : 'border-secondary/10 hover:bg-secondary/10 hover:border-secondary/30'}"
          >
            <Cpu class="w-3 h-3 text-secondary mb-1" />
            <span class="text-xs font-bold text-base-content/85">{stats.do}</span>
            <span class="text-[8px] opacity-50 uppercase font-semibold">DO</span>
          </button>
          <button
            onclick={() =>
              (schemaState.activeFilter =
                schemaState.activeFilter === "kv" ? null : "kv")}
            class="flex flex-col items-center p-2 bg-accent/5 rounded-xl border transition-all {schemaState.activeFilter ===
            'kv'
              ? 'border-accent bg-accent/10 shadow-sm'
              : 'border-accent/10 hover:bg-accent/10 hover:border-accent/30'}"
          >
            <Zap class="w-3 h-3 text-accent mb-1" />
            <span class="text-xs font-bold text-base-content/85">{stats.kv}</span>
            <span class="text-[8px] opacity-50 uppercase font-semibold">KV</span>
          </button>
        </div>

        <!-- General Stats -->
        <div class="flex flex-col gap-1.5 px-1 border-t border-base-300/60 pt-2.5">
          <div class="flex items-center justify-between text-[10px]">
            <span class="opacity-55 font-semibold">Total Entities</span>
            <span class="font-mono font-bold text-base-content/85">{stats.total}</span>
          </div>
          <div class="flex items-center justify-between text-[10px]">
            <span class="opacity-55 font-semibold">Total Fields</span>
            <span class="font-mono font-bold text-base-content/85">{stats.columns}</span>
          </div>
          <div class="flex items-center justify-between text-[10px]">
            <span class="opacity-55 font-semibold">Active Edges</span>
            <span class="font-mono font-bold text-primary">{stats.relations}</span>
          </div>
          {#if schemaState.activeCoordinates}
            <div class="flex items-center justify-between text-[10px]">
              <span class="opacity-55 font-semibold">Coordinates</span>
              <span class="font-mono font-bold text-secondary">
                {schemaState.activeCoordinates.x}, {schemaState.activeCoordinates.y}
              </span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
