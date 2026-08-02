<!--
  CanvasSearchPalette.svelte

  Summary: Quick Cmd+F search palette to instantly filter, jump to, and center canvas focus on any table or column field.
  Expects: show bindable prop.
  Output: Selects and centers target entity on the canvas.
-->
<script lang="ts">
  import {
    Search,
    Database,
    Cpu,
    Zap,
    HardDrive,
    CornerDownLeft,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";
  import { useSvelteFlow } from "@xyflow/svelte";

  let { show = $bindable(false) } = $props();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  const { fitBounds } = useSvelteFlow();

  const targetIcons = {
    d1: Database,
    do: Cpu,
    kv: Zap,
    r2: HardDrive,
  };

  const searchResults = $derived.by(() => {
    if (!query.trim()) {
      return schemaState.nodes.map((n) => ({
        id: n.id,
        name: n.id,
        target: (n.data as any)?.target || "d1",
        fieldMatch: null,
        node: n,
      }));
    }

    const q = query.toLowerCase();
    const results: Array<{
      id: string;
      name: string;
      target: string;
      fieldMatch: string | null;
      node: any;
    }> = [];

    for (const n of schemaState.nodes) {
      const data = n.data as any;
      const target = data?.target || "d1";
      const columns = data?.columns || [];

      if (n.id.toLowerCase().includes(q)) {
        results.push({
          id: n.id,
          name: n.id,
          target,
          fieldMatch: null,
          node: n,
        });
      } else {
        const matchingCol = columns.find((c: any) =>
          c.name.toLowerCase().includes(q),
        );
        if (matchingCol) {
          results.push({
            id: n.id,
            name: n.id,
            target,
            fieldMatch: matchingCol.name,
            node: n,
          });
        }
      }
    }

    return results;
  });

  $effect(() => {
    if (show) {
      query = "";
      selectedIndex = 0;
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  function jumpToEntity(result: (typeof searchResults)[0]) {
    if (!result) return;
    schemaState.activeInspectorNodeId = result.id;

    // Center canvas viewport on the selected node
    const node = result.node;
    if (node) {
      fitBounds(
        {
          x: node.position.x - 100,
          y: node.position.y - 100,
          width: 400,
          height: 300,
        },
        { duration: 400 },
      );
    }

    show = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        jumpToEntity(searchResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      show = false;
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-xs pt-20 p-4 animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="bg-base-100 rounded-3xl w-full max-w-xl shadow-2xl border border-base-300 overflow-hidden flex flex-col"
    >
      <!-- Search Input -->
      <div
        class="p-4 bg-base-200/50 border-b border-base-300 flex items-center gap-3"
      >
        <Search class="w-5 h-5 text-primary shrink-0" />
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={handleKeyDown}
          type="text"
          placeholder="Search entities, tables, or column fields... (↑ ↓ to navigate, Enter to jump)"
          class="input input-ghost input-sm w-full font-medium text-sm focus:outline-none bg-transparent"
        />
        <kbd class="kbd kbd-sm text-[10px]">ESC</kbd>
      </div>

      <!-- Results List -->
      <div class="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
        {#if searchResults.length === 0}
          <div class="p-8 text-center text-xs text-base-content/40 font-medium">
            No entities or fields matching "<span class="text-primary font-mono"
              >{query}</span
            >"
          </div>
        {:else}
          {#each searchResults as item, index}
            {@const Icon =
              targetIcons[item.target as keyof typeof targetIcons] || Database}
            <button
              class="w-full text-left p-3 rounded-2xl flex items-center justify-between transition-all group {index ===
              selectedIndex
                ? 'bg-primary text-primary-content shadow-md'
                : 'hover:bg-base-200/60 text-base-content'}"
              onclick={() => jumpToEntity(item)}
            >
              <div class="flex items-center gap-3">
                <div
                  class="p-2 rounded-xl {index === selectedIndex
                    ? 'bg-primary-content/20 text-primary-content'
                    : 'bg-base-200 text-base-content/70'}"
                >
                  <Icon class="w-4 h-4" />
                </div>
                <div class="flex flex-col">
                  <span class="font-bold text-xs">{item.name}</span>
                  {#if item.fieldMatch}
                    <span class="text-[10px] opacity-75 font-mono"
                      >Matched field: .{item.fieldMatch}</span
                    >
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span
                  class="badge badge-xs font-mono text-[9px] uppercase border-none {index ===
                  selectedIndex
                    ? 'bg-primary-content/20 text-primary-content'
                    : 'bg-base-300 text-base-content/60'}"
                >
                  {item.target}
                </span>
                <CornerDownLeft
                  class="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform"
                />
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Footer Legend -->
      <div
        class="px-5 py-2.5 bg-base-200/40 border-t border-base-300/60 flex items-center justify-between text-[10px] text-base-content/50 font-mono"
      >
        <div class="flex items-center gap-3">
          <span
            ><kbd class="kbd kbd-xs">↑</kbd> <kbd class="kbd kbd-xs">↓</kbd> Navigate</span
          >
          <span><kbd class="kbd kbd-xs">↵</kbd> Select & Center</span>
        </div>
        <span>{searchResults.length} entity result(s)</span>
      </div>
    </div>
  </div>
{/if}
