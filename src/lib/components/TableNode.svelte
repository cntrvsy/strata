<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import { Database, Key } from "lucide-svelte";

  const { data } = $props<{
    data: {
      label: string;
      columns: Array<{ name: string; definition: string }>;
    };
  }>();
</script>

<div
  class="bg-base-100 border border-base-300 rounded-xl shadow-2xl overflow-hidden min-w-[220px] transition-all hover:border-primary/50 group/node"
>
  <!-- Header -->
  <div
    class="bg-base-200/80 backdrop-blur px-4 py-3 border-b border-base-300 flex items-center justify-between"
  >
    <div class="flex items-center gap-2">
      <div
        class="p-1.5 bg-primary/10 rounded-lg group-hover/node:bg-primary/20 transition-colors"
      >
        <Database class="w-4 h-4 text-primary" />
      </div>
      <span class="font-bold text-xs tracking-wide uppercase">{data.label}</span
      >
    </div>
    <div class="badge badge-outline badge-xs opacity-30 font-mono">SQLITE</div>
  </div>

  <!-- Columns -->
  <div class="p-1.5 flex flex-col gap-0.5 bg-base-100">
    {#each data.columns as col (col.name)}
      <div
        class="px-3 py-2 rounded-lg flex items-center justify-between hover:bg-base-200/50 transition-all group/row"
      >
        <div class="flex items-center gap-3">
          <div class="w-4 flex justify-center">
            {#if col.definition.includes("id") || col.definition.includes("primaryKey")}
              <Key class="w-3 h-3 text-amber-500 shadow-sm" />
            {:else}
              <div
                class="w-1.5 h-1.5 rounded-full bg-base-300 group-hover/row:bg-primary/30 transition-colors"
              ></div>
            {/if}
          </div>
          <span
            class="text-[13px] font-medium tracking-tight text-base-content/80 group-hover/row:text-base-content transition-colors"
          >
            {col.name}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span
            class="text-[10px] opacity-40 font-mono group-hover/row:opacity-100 transition-opacity bg-base-200 px-1.5 py-0.5 rounded uppercase"
          >
            {col.definition
              .split("(")[0]
              .replace("text", "txt")
              .replace("integer", "int")}
          </span>
        </div>
      </div>
    {/each}
  </div>

  <Handle
    type="target"
    position={Position.Left}
    class="w-3! h-3! bg-primary border-4 border-(--color-base-100) shadow-sm transition-transform hover:scale-125"
  />
  <Handle
    type="source"
    position={Position.Right}
    class="w-3! h-3! bg-primary border-4 border-(--color-base-100) shadow-sm transition-transform hover:scale-125"
  />
</div>

<style>
  :global(.svelte-flow__handle) {
    border-color: var(--color-base-100);
  }
</style>
