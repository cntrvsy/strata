<script lang="ts">
  /**
   * TableNode.svelte
   *
   * The primary visual entity in Strata.
   * Renders a table/object with its columns/fields.
   * Dynamically adapts its styling (icons, colors, badges) based on the storage target:
   * - D1: Standard SQLite relational tables.
   * - DO: Durable Object storage representations.
   * - KV: Cloudflare KV namespace representations.
   */
  import { Handle, Position } from "@xyflow/svelte";
  import { schemaState } from "$lib/state.svelte";
  import { Database, Key, Zap, Cpu, Trash2 } from "lucide-svelte";

  const { data } = $props<{
    data: {
      label: string;
      columns: Array<{
        name: string;
        definition: string;
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      target?: "d1" | "do" | "kv";
    };
  }>();

  const isD1 = $derived(data.target === "d1" || !data.target);
  const isMatch = $derived(
    !schemaState.activeFilter ||
      (schemaState.activeFilter === "d1" && isD1) ||
      schemaState.activeFilter === data.target,
  );

  const targetConfig = {
    d1: {
      icon: Database,
      label: "D1",
      color: "primary",
      bg: "bg-primary/10",
      bgHover: "group-hover/node:bg-primary/20",
      text: "text-primary",
      border: "hover:border-primary/50",
      borderTop: "border-t-primary",
      badge: "badge-primary",
    },
    do: {
      icon: Cpu,
      label: "DO",
      color: "secondary",
      bg: "bg-secondary/10",
      bgHover: "group-hover/node:bg-secondary/20",
      text: "text-secondary",
      border: "hover:border-secondary/50",
      borderTop: "border-t-secondary",
      badge: "badge-secondary",
    },
    kv: {
      icon: Zap,
      label: "KV",
      color: "accent",
      bg: "bg-accent/10",
      bgHover: "group-hover/node:bg-accent/20",
      text: "text-accent",
      border: "hover:border-accent/50",
      borderTop: "border-t-accent",
      badge: "badge-accent",
    },
  };

  const config = $derived(
    targetConfig[(data.target as keyof typeof targetConfig) || "d1"],
  );
</script>

<div
  class="relative group/node min-w-[220px] transition-[opacity,filter] duration-500 {isMatch
    ? 'opacity-100'
    : 'opacity-20 grayscale pointer-events-none'}"
  data-testid="table-node"
  data-table-name={data.label}
>
  <div
    class="bg-base-100 border border-base-400 rounded-xl overflow-hidden transition-all {config.border} border-t-4 {config.borderTop}"
  >
    <!-- Header -->
    <div
      class="bg-base-200/90 px-4 py-3 border-b border-base-300 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <div
          class="p-1.5 {config.bg} rounded-lg {config.bgHover} transition-colors"
        >
          <config.icon class="w-4 h-4 {config.text}" />
        </div>
        <span class="font-bold text-xs tracking-wide uppercase"
          >{data.label}</span
        >
      </div>
      <div
        class="badge badge-outline badge-xs opacity-50 font-mono text-[10px]"
      >
        {config.label}
      </div>
    </div>

    <!-- Columns -->
    <div class="p-1.5 flex flex-col gap-0.5 bg-base-100">
      {#each data.columns as col (col.name)}
        {@const isPk = col.isPk}
        {@const isFk = col.isReferences}
        <div
          class="relative px-3 py-2 rounded-lg flex items-center justify-between hover:bg-base-200/50 transition-all group/row {isPk
            ? 'bg-amber-500/5'
            : ''} {isFk ? 'bg-secondary/5' : ''}"
        >
          <div class="flex items-center gap-3">
            <div class="w-4 flex justify-center">
              {#if isPk}
                <Key class="w-3 h-3 text-amber-500 shadow-sm" />
              {:else if isFk}
                <div
                  class="w-2 h-2 rounded-full border-2 border-secondary/50 group-hover/row:bg-secondary transition-colors"
                ></div>
              {:else}
                <div
                  class="w-1.5 h-1.5 rounded-full bg-base-300 group-hover/row:bg-primary/30 transition-colors"
                ></div>
              {/if}
            </div>
            <span
              class="text-[13px] font-medium tracking-tight transition-colors {isPk
                ? 'text-amber-700'
                : ''} {isFk ? 'text-secondary' : ''} {!isPk && !isFk
                ? 'text-base-content/80'
                : ''}"
            >
              {col.name}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <span
              class="text-[10px] opacity-40 font-mono group-hover/row:opacity-0 transition-opacity bg-base-200 px-1.5 py-0.5 rounded uppercase leading-none"
            >
              {col.definition
                .split("(")[0]
                .replace("text", "txt")
                .replace("integer", "int")}
            </span>
            <button
              class="absolute right-2 opacity-0 group-hover/row:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10 transition-all"
              onclick={(e) => {
                e.stopPropagation();
                schemaState.deleteColumn(data.label, col.name);
              }}
              title="Delete Field"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Handles -->
  <Handle
    id="target"
    type="target"
    position={Position.Left}
    isConnectable={true}
    style="width: 12px; height: 12px; background: var(--color-primary); border: 2px solid var(--color-base-100);"
  />
  <Handle
    id="source"
    type="source"
    position={Position.Right}
    isConnectable={true}
    style="width: 12px; height: 12px; background: var(--color-primary); border: 2px solid var(--color-base-100);"
  />
</div>
