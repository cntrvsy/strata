<script lang="ts">
  import {
    Share2,
    Camera,
    FolderOpen,
    RefreshCw,
    BadgeQuestionMark,
    Eye,
    EyeOff,
    Workflow,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";
  import { toPng } from "html-to-image";
  import { getNodesBounds, getViewportForBounds } from "@xyflow/svelte";
  import HelpModal from "$lib/components/HelpModal.svelte";
  import { arrangeLayout } from "$lib/services/layout";

  let showHelp = $state(false);

  /**
   * Opens a native file dialog to select a Drizzle schema file.
   */
  async function onOpenFile() {
    await schemaState.openNewFile();
  }

  /**
   * Automatically arranges all table nodes in the diagram.
   * Patches the layout and updates the disk schema.ts file in one pass.
   */
  async function onAutoLayout() {
    if (schemaState.nodes.length === 0) return;
    
    schemaState.machine.send("EDIT");
    try {
      const arranged = await arrangeLayout(schemaState.nodes, schemaState.edges);
      schemaState.nodes = arranged;
      await schemaState.saveToFile();
    } catch (err) {
      console.error("[Strata] Auto-layout failed:", err);
      schemaState.machine.send("FAIL");
    }
  }

  /**
   * Captures the current diagram state as a high-resolution PNG.
   * Automatically calculates bounds and viewport to ensure a perfect framing.
   */
  async function exportToImage() {
    const el = document.querySelector(".svelte-flow") as HTMLElement;
    if (!el || !schemaState.nodes.length) return;

    const viewportEl = el.querySelector(
      ".svelte-flow__viewport",
    ) as HTMLElement;
    const originalTransform = viewportEl ? viewportEl.style.transform : "";

    schemaState.machine.send("SAVE");
    try {
      const nodesBounds = getNodesBounds(schemaState.nodes);
      const padding = 100;
      const imageWidth = nodesBounds.width + padding * 2;
      const imageHeight = nodesBounds.height + padding * 2;

      const viewport = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.1,
        4.0,
        0.1,
      );

      // Temporarily override the live viewport transform so that html-to-image captures all tables perfectly in view
      if (viewportEl) {
        viewportEl.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
      }

      const dataUrl = await toPng(el, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
        },
        filter: (node) => {
          const cl = (node as HTMLElement).classList;
          if (cl) {
            return (
              !cl.contains("svelte-flow__controls") &&
              !cl.contains("svelte-flow__minimap")
            );
          }
          return true;
        },
        pixelRatio: 4,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `strata-${schemaState.filePath?.split("/").pop() || "schema"}-${Date.now()}.png`;
      a.click();
      schemaState.machine.send("SUCCESS");

      // Show the export successful toast for 4 seconds
      schemaState.showExportToast = true;
      setTimeout(() => {
        schemaState.showExportToast = false;
      }, 4000);
    } catch (err: any) {
      console.error("[Strata] Capture failed:", err);
      schemaState.machine.send("FAIL");
    } finally {
      // Cleanly restore the viewport's original user zoom and pan transformation
      if (viewportEl) {
        viewportEl.style.transform = originalTransform;
      }
    }
  }
</script>

<div
  class="w-full h-14 border-b border-base-300 bg-base-100/80 backdrop-blur-xl z-30 flex items-center justify-between px-6 select-none shrink-0"
  data-testid="navbar"
>
  <div class="flex items-center gap-4">
    <div
      class="flex items-center gap-2.5 bg-base-200/40 hover:bg-base-200/80 px-3.5 py-1.5 rounded-full border border-base-300 transition-all cursor-help relative group"
    >
      <span
        class="text-[9px] font-black uppercase tracking-wider text-base-content/60"
        >Code</span
      >
      <div class="flex items-center gap-0.5 text-primary">
        <RefreshCw
          class="w-3 h-3 animate-spin duration-3000 [animation-duration:8s]"
        />
      </div>
      <span
        class="text-[9px] font-black uppercase tracking-wider text-base-content/60"
        >UI</span
      >
      <div class="h-3 w-px bg-base-300"></div>
      <div class="flex items-center gap-1.5">
        <div
          class="w-1.5 h-1.5 rounded-full {!schemaState.filePath
            ? 'bg-warning'
            : !schemaState.isValid
            ? 'bg-error animate-ping'
            : 'bg-success'} shadow-[0_0_8px_currentColor] {!schemaState.filePath
            ? 'text-warning'
            : !schemaState.isValid
            ? 'text-error'
            : 'text-success'}"
        ></div>
        <span
          class="text-[9px] font-mono uppercase font-bold text-base-content/60"
        >
          {!schemaState.filePath
            ? "No Schema Loaded"
            : !schemaState.isValid
            ? "Sync Error"
            : "Live Mirror Active"}
        </span>
      </div>

      <!-- Detail Card (glorious tooltip) -->
      <div
        class="absolute top-12 left-0 w-80 p-5 bg-base-100/98 border border-base-300 rounded-3xl shadow-2xl opacity-0 scale-95 translate-y-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 pointer-events-none transition-all duration-300 z-50 origin-top-left flex flex-col gap-3 backdrop-blur-md"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-primary/10 rounded-xl">
            <RefreshCw class="w-4 h-4 text-primary" />
          </div>
          <div>
            <span
              class="text-[9px] font-black uppercase tracking-widest text-primary/75 block leading-none mb-0.5"
              >Bi-Directional Engine</span
            >
            <span class="font-bold text-xs text-base-content"
              >Code ⇄ UI Synchronization</span
            >
          </div>
        </div>
        <p class="text-[11px] leading-relaxed text-base-content/75">
          Strata keeps your <code
            class="bg-base-200 px-1 py-0.5 rounded font-mono text-[10px] text-primary"
            >schema.ts</code
          > file as the absolute single source of truth.
        </p>
        <div
          class="text-[11px] leading-relaxed text-base-content/70 pl-2 border-l-2 border-primary/30 flex flex-col gap-1"
        >
          <span
            >• <strong>Disk ➔ UI:</strong> External saves (e.g. in VS Code) trigger
            the file watcher to instantly parse the AST and refresh the diagram.</span
          >
          <span
            >• <strong>UI ➔ Disk:</strong> Canvas drags or visual modifications surgically
            patch the AST and write back in real-time.</span
          >
        </div>
        <div class="h-px bg-base-200/80 my-1"></div>
        <div
          class="flex items-center justify-between text-[9px] font-mono text-base-content/40"
        >
          <span>AST engine: ts-morph</span>
          <span>Watcher: notify (Rust)</span>
        </div>
      </div>
    </div>
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
      <button
        class="btn btn-ghost btn-sm gap-2 rounded-xl hover:bg-base-200"
        onclick={() => (schemaState.compactMode = !schemaState.compactMode)}
        title="Toggle Compact View (Keys/References Only)"
        data-testid="compact-mode-button"
      >
        {#if schemaState.compactMode}
          <EyeOff class="w-4 h-4 text-warning" />
          <span class="text-warning">Compact Mode</span>
        {:else}
          <Eye class="w-4 h-4 text-base-content/70" />
          <span class="text-base-content/75">Compact Mode</span>
        {/if}
      </button>
      <button
        class="btn btn-ghost btn-sm gap-2 rounded-xl hover:bg-base-200"
        onclick={onAutoLayout}
        title="Arrange tables automatically using ELK layout algorithm"
        data-testid="auto-layout-button"
      >
        <Workflow class="w-4 h-4 text-base-content/70" />
        <span class="text-base-content/75">Auto Layout</span>
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
      <BadgeQuestionMark
        class="w-5 h-5 opacity-40 hover:opacity-100 transition-all"
      />
    </button>
  </div>
</div>

<HelpModal bind:show={showHelp} />
