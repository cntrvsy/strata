<!--
  Navbar.svelte

  Summary: Top navigation bar rendering filters, view mode selectors, export controls, and file persistence triggers.
  Expects: None (shares global schemaState).
  Output: Triggers file opens, layout resets, PNG exports, help modals, and code vs diagram view toggles.
-->
<script lang="ts">
  import {
    Camera,
    FolderOpen,
    RefreshCw,
    BadgeQuestionMark,
    Eye,
    EyeOff,
    Workflow,
    Save,
    Undo,
    Settings,
    Menu,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";
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
      const arranged = await arrangeLayout(
        schemaState.nodes,
        schemaState.edges,
      );
      schemaState.nodes = arranged;
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
    const el = document.querySelector(".svelte-flow__viewport") as HTMLElement;
    if (!el || !schemaState.nodes.length) return;

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

      const dataUrl = await toPng(el, {
        backgroundColor: "#282c34",
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
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
              : schemaState.hasUnsavedChanges
                ? 'bg-warning animate-pulse'
                : 'bg-success'} shadow-[0_0_8px_currentColor] {!schemaState.filePath
            ? 'text-warning'
            : !schemaState.isValid
              ? 'text-error'
              : schemaState.hasUnsavedChanges
                ? 'text-warning'
                : 'text-success'}"
        ></div>
        <span
          class="text-[9px] font-mono uppercase font-bold text-base-content/60"
        >
          {!schemaState.filePath
            ? "No Schema Loaded"
            : !schemaState.isValid
              ? "Sync Error"
              : schemaState.hasUnsavedChanges
                ? "Unsaved Layout Changes"
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
          <span>Drizzle ORM: v0.45.2</span>
          <span>AST: ts-morph</span>
          <span>Watcher: notify (Rust)</span>
        </div>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-3">
    {#if schemaState.filePath}
      <button
        class="btn btn-primary btn-sm gap-2 rounded-xl shadow-lg shadow-primary/20 font-bold"
        onclick={() => (schemaState.showNewTableModal = true)}
        data-testid="new-table-button"
      >
        <span class="text-lg leading-none">+</span>
        New Table
      </button>
    {/if}
    {#if schemaState.hasUnsavedChanges}
      <button
        class="btn btn-warning btn-sm gap-2 rounded-xl shadow-lg shadow-warning/20 animate-pulse hover:animate-none"
        onclick={() => schemaState.saveToFile()}
        data-testid="save-layout-button"
        title="Save current layout changes to disk"
      >
        <Save class="w-4 h-4" />
        Save Layout
      </button>
      <button
        class="btn btn-ghost btn-sm gap-2 rounded-xl hover:bg-base-200"
        onclick={() => schemaState.syncWithFile()}
        data-testid="discard-layout-button"
        title="Discard unsaved layout changes and revert to disk schema"
      >
        <Undo class="w-4 h-4 text-base-content/70" />
        <span class="text-base-content/75">Discard</span>
      </button>
    {/if}

    <button class="btn btn-ghost btn-sm gap-2 rounded-xl" onclick={onOpenFile}>
      <FolderOpen class="w-4 h-4 text-base-content/70" />
      Open Schema
    </button>

    <!-- Unified Menu Dropdown -->
    <div class="dropdown dropdown-end">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-sm gap-2 rounded-xl border border-base-300 hover:bg-base-200 transition-all"
        title="More Actions"
      >
        <Menu class="w-4 h-4 text-base-content/70" />
        <span class="text-xs font-semibold text-base-content/85">Menu</span>
      </div>
      <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 border border-base-300 rounded-2xl z-50 w-56 p-2 shadow-2xl mt-2 gap-1 animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {#if schemaState.nodes.length > 0}
          <li>
            <button
              class="flex items-center gap-2.5 rounded-xl py-2 px-3 hover:bg-base-200 transition-colors"
              onclick={() => (schemaState.compactMode = !schemaState.compactMode)}
            >
              {#if schemaState.compactMode}
                <EyeOff class="w-4 h-4 text-warning" />
                <span class="text-warning font-semibold text-xs">Disable Compact View</span>
              {:else}
                <Eye class="w-4 h-4 text-base-content/70" />
                <span class="text-base-content/75 font-semibold text-xs">Enable Compact View</span>
              {/if}
            </button>
          </li>
          <li>
            <button
              class="flex items-center gap-2.5 rounded-xl py-2 px-3 hover:bg-base-200 transition-colors"
              onclick={onAutoLayout}
            >
              <Workflow class="w-4 h-4 text-base-content/70" />
              <span class="text-base-content/75 font-semibold text-xs">Auto Layout Diagram</span>
            </button>
          </li>
          <li>
            <button
              class="flex items-center gap-2.5 rounded-xl py-2 px-3 text-primary hover:bg-primary/5 transition-colors"
              onclick={exportToImage}
            >
              <Camera class="w-4 h-4" />
              <span class="font-bold text-xs">Export as PNG</span>
            </button>
          </li>
          <div class="h-px bg-base-300/60 my-1"></div>
        {/if}
        
        {#if schemaState.filePath}
          <li>
            <button
              class="flex items-center gap-2.5 rounded-xl py-2 px-3 hover:bg-base-200 transition-colors"
              onclick={() => (schemaState.showProjectSettingsModal = true)}
            >
              <Settings class="w-4 h-4 text-base-content/70" />
              <span class="text-base-content/75 font-semibold text-xs">Project Settings</span>
            </button>
          </li>
        {/if}

        <li>
          <button
            class="flex items-center gap-2.5 rounded-xl py-2 px-3 hover:bg-base-200 transition-colors"
            onclick={() => (showHelp = true)}
          >
            <BadgeQuestionMark class="w-4 h-4 text-base-content/70" />
            <span class="text-base-content/75 font-semibold text-xs">Help & Shortcuts</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</div>

<HelpModal bind:show={showHelp} />
