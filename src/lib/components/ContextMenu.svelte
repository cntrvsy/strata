<!--
  ContextMenu.svelte

  Summary: Context menu popup containing actions for canvas background and diagram table nodes.
  Expects: x, y coordinate props, menu type, targetId, onClose and onAction callbacks.
  Output: Triggers entity additions, renaming, deletion, or focus operations.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2, FilePen, Focus } from "lucide-svelte";

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
  class="fixed z-200 w-52 bg-base-100/95 border border-base-300/80 rounded-xl shadow-2xl py-1 flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
>
  {#if type === "node" && targetId}
    <div
      class="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider opacity-40 border-b border-base-300/40 mb-1 leading-none text-base-content/70"
    >
      {targetId}
    </div>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
      onclick={() => {
        onAction("add_field", targetId);
        onClose();
      }}
    >
      <Plus class="w-3.5 h-3.5 opacity-60 text-primary" />
      Add Field
    </button>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
      onclick={() => {
        onAction("rename_table", targetId);
        onClose();
      }}
    >
      <FilePen class="w-3.5 h-3.5 opacity-60 text-secondary" />
      Rename Entity
    </button>
    <div class="h-px bg-base-300/40 my-1"></div>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-error/10 hover:text-error transition-all text-left font-semibold text-error/90"
      onclick={() => {
        onAction("delete_table", targetId);
        onClose();
      }}
    >
      <Trash2 class="w-3.5 h-3.5 opacity-70" />
      Delete Entity
    </button>
  {:else if type === "canvas"}
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
      onclick={() => {
        onAction("new_table");
        onClose();
      }}
    >
      <Plus class="w-3.5 h-3.5 opacity-60 text-primary" />
      Create New Entity
    </button>
    <button
      class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
      onclick={() => {
        onAction("fit_view");
        onClose();
      }}
    >
      <Focus class="w-3.5 h-3.5 opacity-60 text-info" />
      Fit View
    </button>
  {/if}
</div>
