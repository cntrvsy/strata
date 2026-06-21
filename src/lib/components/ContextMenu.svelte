<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, FilePen, Focus } from "lucide-svelte";
  import { schemaState } from "../state.svelte";

  const { x, y, type, targetId, onClose, onAction } = $props<{
    x: number;
    y: number;
    type: "canvas" | "node";
    targetId?: string;
    onClose: () => void;
    onAction: (action: string, data?: any) => void;
  }>();

  let menuElement = $state<HTMLDivElement | null>(null);

  function handleClickOutside(e: MouseEvent) {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      onClose();
    }
  }

  onMount(() => {
    // Add click listener to close context menu
    window.addEventListener("click", handleClickOutside, { capture: true });
    window.addEventListener("contextmenu", handleClickOutside, {
      capture: true,
    });

    return () => {
      window.removeEventListener("click", handleClickOutside, {
        capture: true,
      });
      window.removeEventListener("contextmenu", handleClickOutside, {
        capture: true,
      });
    };
  });
</script>

<div
  bind:this={menuElement}
  style="top: {y}px; left: {x}px;"
  class="fixed z-200 w-52 bg-base-100 border border-base-300 rounded-lg shadow-xl py-1 flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-100"
>
  {#if type === "node" && targetId}
    <div
      class="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider opacity-40 border-b border-base-300/50 mb-1 leading-none"
    >
      {targetId}
    </div>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200 transition-colors text-left font-medium"
      onclick={() => {
        onAction("add_field", targetId);
        onClose();
      }}
    >
      <Plus class="w-3.5 h-3.5 opacity-60" />
      Add Field
    </button>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200 transition-colors text-left font-medium"
      onclick={() => {
        onAction("rename_table", targetId);
        onClose();
      }}
    >
      <FilePen class="w-3.5 h-3.5 opacity-60" />
      Rename Entity
    </button>
    <div class="h-px bg-base-300/50 my-1"></div>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-error/15 hover:text-error transition-colors text-left font-medium"
      onclick={() => {
        onAction("delete_table", targetId);
        onClose();
      }}
    >
      <Trash2 class="w-3.5 h-3.5 opacity-60" />
      Delete Entity
    </button>
  {:else if type === "canvas"}
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200 transition-colors text-left font-medium"
      onclick={() => {
        onAction("new_table");
        onClose();
      }}
    >
      <Plus class="w-3.5 h-3.5 opacity-60" />
      Forge New Entity
    </button>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200 transition-colors text-left font-medium"
      onclick={() => {
        onAction("fit_view");
        onClose();
      }}
    >
      <Focus class="w-3.5 h-3.5 opacity-60" />
      Fit View
    </button>
  {/if}
</div>
