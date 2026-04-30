<script lang="ts">
  import { schemaState } from "$lib/state.svelte";
  import { Database, Cpu, Zap, Layers } from "lucide-svelte";

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
  class="absolute top-24 left-6 z-10 flex flex-col gap-2 animate-in fade-in slide-in-from-left-4 duration-500"
>
  <div
    class="bg-base-100/80 backdrop-blur-md border border-base-300 rounded-2xl shadow-xl p-4 min-w-[180px]"
  >
    <div class="flex items-center gap-2 mb-4 border-b border-base-300 pb-2">
      <Layers class="w-4 h-4 text-primary" />
      <span class="text-[10px] font-black uppercase tracking-widest opacity-40"
        >Schema Stats</span
      >
    </div>

    <div class="flex flex-col gap-3">
      <!-- Entity Breakdown -->
      <div class="grid grid-cols-3 gap-2">
        <div
          class="flex flex-col items-center p-2 bg-primary/5 rounded-xl border border-primary/10"
        >
          <Database class="w-3 h-3 text-primary mb-1" />
          <span class="text-xs font-bold">{stats.d1}</span>
          <span class="text-[8px] opacity-40 uppercase">D1</span>
        </div>
        <div
          class="flex flex-col items-center p-2 bg-secondary/5 rounded-xl border border-secondary/10"
        >
          <Cpu class="w-3 h-3 text-secondary mb-1" />
          <span class="text-xs font-bold">{stats.do}</span>
          <span class="text-[8px] opacity-40 uppercase">DO</span>
        </div>
        <div
          class="flex flex-col items-center p-2 bg-accent/5 rounded-xl border border-accent/10"
        >
          <Zap class="w-3 h-3 text-accent mb-1" />
          <span class="text-xs font-bold">{stats.kv}</span>
          <span class="text-[8px] opacity-40 uppercase">KV</span>
        </div>
      </div>

      <!-- General Stats -->
      <div class="flex flex-col gap-1.5 px-1">
        <div class="flex items-center justify-between text-[10px]">
          <span class="opacity-40">Total Fields</span>
          <span class="font-mono font-bold">{stats.columns}</span>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span class="opacity-40">Active Edges</span>
          <span class="font-mono font-bold text-primary">{stats.relations}</span
          >
        </div>
      </div>
    </div>
  </div>
</div>
