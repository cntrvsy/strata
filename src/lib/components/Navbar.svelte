<script lang="ts">
  import { 
    Share2, 
    Camera, 
    FolderOpen, 
    HelpCircle,
    HelpCircle as HelpIcon
  } from "lucide-svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { schemaState } from "$lib/state.svelte";
  import { toPng } from "html-to-image";
  import { getNodesBounds, getViewportForBounds } from "@xyflow/svelte";
  import HelpModal from "$lib/components/HelpModal.svelte";

  let showHelp = $state(false);

  /**
   * Opens a native file dialog to select a Drizzle schema file.
   */
  async function onOpenFile() {
    await schemaState.openNewFile();
  }

  /**
   * Captures the current diagram state as a high-resolution PNG.
   * Automatically calculates bounds and viewport to ensure a perfect framing.
   */
  async function exportToImage() {
    const el = document.querySelector(".svelte-flow") as HTMLElement;
    if (!el || !schemaState.nodes.length) return;

    schemaState.machine.send("SAVE");
    try {
      const nodesBounds = getNodesBounds(schemaState.nodes);
      const imageWidth = nodesBounds.width + 100;
      const imageHeight = nodesBounds.height + 100;

      const viewport = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.5,
        2.0,
        0.2,
      );

      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
        pixelRatio: 4,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `strata-forge-${schemaState.filePath?.split("/").pop() || "schema"}-${Date.now()}.png`;
      a.click();
      schemaState.machine.send("SAVE_SUCCESS");
    } catch (err: any) {
      console.error("[Strata] Capture failed:", err);
      schemaState.machine.send("SAVE_ERROR");
    }
  }
</script>

<div
  class="absolute top-0 left-0 right-0 h-16 border-b border-base-300 bg-base-100/80 backdrop-blur-xl z-30 flex items-center justify-between px-6"
  data-testid="navbar"
>
  <div class="flex items-center gap-4">
    <div class="p-2.5 bg-primary/10 rounded-2xl shadow-inner">
      <Share2 class="w-6 h-6 text-primary" />
    </div>
    <div class="flex flex-col">
      <span
        class="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 leading-none mb-1"
        >Strata Forge</span
      >
      <h1 class="text-sm font-bold tracking-tight">
        {schemaState.filePath?.split("/").pop() || "No Schema Loaded"}
      </h1>
    </div>
    <div class="h-6 w-px bg-base-300 mx-2"></div>
    <div class="flex items-center gap-2">
      <div
        class="w-2 h-2 rounded-full {!schemaState.isValid
          ? 'bg-error animate-pulse'
          : 'bg-success'} shadow-[0_0_8px_currentColor]"
      ></div>
      <span class="text-[9px] font-mono uppercase opacity-50 tracking-wider">
        {!schemaState.isValid ? "Parsing Error" : "Live Mirror Active"}
      </span>
    </div>

    <!-- Mode Toggle -->
    {#if schemaState.filePath}
      <div class="flex items-center gap-1 bg-base-200 p-1 rounded-xl ml-4 shadow-inner border border-base-300">
        <button 
          class="btn btn-xs rounded-lg border-none {schemaState.viewMode === 'diagram' ? 'bg-base-100 shadow-sm text-primary' : 'bg-transparent text-base-content/40 hover:text-base-content'}"
          onclick={() => schemaState.viewMode = 'diagram'}
          data-testid="diagram-mode-button"
        >
          Diagram
        </button>
        <button 
          class="btn btn-xs rounded-lg border-none {schemaState.viewMode === 'code' ? 'bg-base-100 shadow-sm text-primary' : 'bg-transparent text-base-content/40 hover:text-base-content'}"
          onclick={() => schemaState.viewMode = 'code'}
          data-testid="code-mode-button"
        >
          Code
        </button>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-3">
    {#if schemaState.filePath}
      <button
        class="btn btn-primary btn-sm gap-2 rounded-xl shadow-lg shadow-primary/20"
        onclick={() => (schemaState.showNewTableModal = true)}
        data-testid="new-table-button"
      >
        <span class="text-lg leading-none">+</span>
        New Table
      </button>
    {/if}
    {#if schemaState.nodes.length > 0}
      <button
        class="btn btn-ghost btn-sm gap-2 rounded-xl text-primary hover:bg-primary/5"
        onclick={exportToImage}
        title="Export as PNG"
      >
        <Camera class="w-4 h-4" />
        Export
      </button>
    {/if}
    <button class="btn btn-ghost btn-sm gap-2 rounded-xl" onclick={onOpenFile}>
      <FolderOpen class="w-4 h-4" />
      Open Schema
    </button>
    <button
      class="btn btn-ghost btn-sm btn-circle"
      onclick={() => (showHelp = true)}
      data-testid="help-button"
    >
      <HelpIcon class="w-5 h-5 opacity-40 hover:opacity-100 transition-all" />
    </button>
  </div>
</div>

<HelpModal bind:show={showHelp} />
