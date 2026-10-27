<!--
  ContextMenu.svelte

  Summary: Context menu popup containing actions for canvas background and diagram table nodes.
  Expects: x, y coordinate props, menu type, targetId, onClose and onAction callbacks.
  Output: Triggers entity additions, renaming, deletion, or focus operations.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Trash2, FilePen, Focus, ShieldCheck, Sparkles, ExternalLink, Copy, SlidersHorizontal, FileCode } from "lucide-svelte";
  import { schemaState } from "#lib/state";

  const { x, y, type, targetId, nodeType, nodeData, onClose, onAction } = $props<{
    x: number;
    y: number;
    type: "canvas" | "node";
    targetId?: string;
    nodeType?: string;
    nodeData?: any;
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
  class="fixed z-200 w-56 bg-base-100/95 border border-base-300/80 rounded-box shadow-2xl py-1 flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
>
  {#if type === "node" && targetId}
    {#if nodeType === "identity"}
      <div
        class="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider opacity-60 border-b border-base-300/40 mb-1 leading-none text-base-content flex items-center justify-between"
      >
        <span>{nodeData?.title || targetId}</span>
        <span class="badge badge-xs {nodeData?.provider === 'clerk' ? 'badge-secondary' : 'badge-accent'} text-[8px] py-0.5">IdP</span>
      </div>
      <button
        class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/85"
        onclick={() => {
          onAction("inspect_node", targetId);
          onClose();
        }}
      >
        <ShieldCheck class="w-3.5 h-3.5 opacity-80 text-primary" />
        Inspect Provider
      </button>
      <button
        class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/85"
        onclick={() => {
          onAction("copy_mirror_snippet", targetId);
          onClose();
        }}
      >
        <Copy class="w-3.5 h-3.5 opacity-80 text-warning" />
        Copy Mirror Schema
      </button>
      <button
        class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/85"
        onclick={() => {
          onAction("open_blueprint_guide", targetId);
          onClose();
        }}
      >
        <Sparkles class="w-3.5 h-3.5 opacity-80 text-secondary" />
        View Auth Blueprints
      </button>
      <div class="h-px bg-base-300/40 my-1"></div>
      <button
        class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/70"
        onclick={() => {
          onAction("open_docs", nodeData?.provider);
          onClose();
        }}
      >
        <ExternalLink class="w-3.5 h-3.5 opacity-70 text-info" />
        Provider Docs
      </button>
    {:else}
      <div
        class="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider opacity-40 border-b border-base-300/40 mb-1 leading-none text-base-content/70 flex items-center justify-between"
      >
        <span>{targetId}</span>
        <span class="badge badge-xs {nodeData?.target === 'do' ? 'badge-secondary' : nodeData?.target === 'kv' ? 'badge-warning' : nodeData?.target === 'r2' ? 'badge-info' : 'badge-neutral'} text-[8px] uppercase">{nodeData?.target || 'd1'}</span>
      </div>
      <button
        class="flex items-center justify-between px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/85"
        onclick={() => {
          onAction("open_in_editor", targetId);
          onClose();
        }}
      >
        <span class="flex items-center gap-2.5">
          <FileCode class="w-3.5 h-3.5 opacity-75 text-primary" />
          <span>Open in Editor</span>
        </span>
        <kbd class="kbd kbd-xs text-[9px] opacity-60">2× Click</kbd>
      </button>
      <button
        class="flex items-center justify-between px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
        onclick={() => {
          onAction("copy_drizzle_code", targetId);
          onClose();
        }}
      >
        <span class="flex items-center gap-2.5">
          <Copy class="w-3.5 h-3.5 opacity-60 text-info" />
          <span>
            {#if nodeData?.target === "do"}
              Copy DO Interface
            {:else if nodeData?.target === "kv"}
              Copy KV Interface
            {:else if nodeData?.target === "r2"}
              Copy R2 Interface
            {:else}
              Copy Drizzle Snippet
            {/if}
          </span>
        </span>
      </button>
      <button
        class="flex items-center justify-between px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
        onclick={() => {
          onAction("toggle_focus", targetId);
          onClose();
        }}
      >
        <span class="flex items-center gap-2.5">
          <Focus class="w-3.5 h-3.5 opacity-60 text-primary" />
          <span>Focus Subgraph</span>
        </span>
        <kbd class="kbd kbd-xs text-[9px] opacity-60">F</kbd>
      </button>
      <button
        class="flex items-center justify-between px-3 py-2 text-xs hover:bg-base-200/60 transition-all text-left font-semibold text-base-content/80"
        onclick={() => {
          onAction("inspect_node", targetId);
          onClose();
        }}
      >
        <span class="flex items-center gap-2.5">
          <SlidersHorizontal class="w-3.5 h-3.5 opacity-60 text-secondary" />
          <span>Inspect Architecture</span>
        </span>
        <kbd class="kbd kbd-xs text-[9px] opacity-60">↵</kbd>
      </button>
      {#if schemaState.isSandboxMode}
        <div class="h-px bg-base-300/40 my-1"></div>
        <button
          class="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-error/10 transition-all text-left font-semibold text-error"
          onclick={() => {
            onAction("delete_sandbox", targetId);
            onClose();
          }}
        >
          <Trash2 class="w-3.5 h-3.5 opacity-70" />
          <span>Delete (Sandbox)</span>
        </button>
      {/if}
    {/if}
  {:else if type === "canvas"}
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
