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
    BadgeQuestionMark,
    Eye,
    EyeOff,
    Workflow,
    Save,
    Undo,
    Settings,
    Menu,
    GitCompare,
    RotateCcw,
    Sparkles,
    CircleArrowUp,
    X,
    ChevronDown,
    FileCode,
    Code,
    DraftingCompass,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";
  import { updateState } from "$lib/state/updateState.svelte";
  import { toPng } from "html-to-image";
  import { getNodesBounds, getViewportForBounds } from "@xyflow/svelte";
  import HelpModal from "$lib/components/HelpModal.svelte";
  import DiffPreviewModal from "$lib/components/DiffPreviewModal.svelte";
  import UpdateModal from "$lib/components/UpdateModal.svelte";
  import { arrangeLayout } from "$lib/services/layout";
  import { SAMPLE_TEMPLATES } from "$lib/mock";

  let showHelp = $state(false);
  let showDiffPreview = $state(false);

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
  class="navbar w-full h-11 border-b border-base-300/80 bg-base-100/90 backdrop-blur-md z-30 px-4 select-none shrink-0"
  data-testid="navbar"
>
  <!-- Left Side: Session Context & Adaptive Schema Controls -->
  <div class="navbar-start flex items-center gap-2">
    {#if schemaState.isSandboxMode}
      <!-- State C: Playground Sandbox Active (Unified Compact Dropdown Pill) -->
      <div class="dropdown dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="join border border-secondary/40 rounded-lg overflow-hidden bg-secondary/10 p-0.5 shadow-2xs hover:bg-secondary/15 transition-colors cursor-pointer"
          title="Playground Sandbox Mode (In-Memory Engine)"
        >
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-secondary max-w-44 sm:max-w-64 truncate"
          >
            <Sparkles class="w-3.5 h-3.5 text-secondary shrink-0" />
            <span class="capitalize truncate"
              >{schemaState.sandboxTemplateKey} Demo</span
            >
            <ChevronDown
              class="w-3 h-3 opacity-70 shrink-0 ml-0.5 text-secondary"
            />
          </div>
        </div>

        <!-- Sandbox Options & Demo Switcher Dropdown Menu -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-xl z-50 w-auto p-1.5 shadow-2xl mt-1.5 text-xs gap-0.5"
        >
          <li
            class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1"
          >
            Sandbox Session Actions
          </li>
          <li>
            <button
              class="flex items-center gap-2 rounded-lg py-1.5 px-2 text-[11px] font-medium text-secondary hover:bg-secondary/10"
              onclick={() =>
                schemaState.loadSandboxDemo(schemaState.sandboxTemplateKey)}
              data-testid="reset-sandbox-button"
            >
              <RotateCcw class="w-3.5 h-3.5 text-secondary" />
              <span>Reset Sandbox Demo</span>
            </button>
          </li>
          <li>
            <button
              class="flex items-center gap-2 rounded-lg py-1.5 px-2 text-[11px] text-error hover:bg-error/10 font-medium"
              onclick={() => schemaState.closeFile()}
            >
              <X class="w-3.5 h-3.5 text-error" />
              <span>Exit Sandbox Mode</span>
            </button>
          </li>

          <div class="h-px bg-base-300/50 my-1"></div>

          <li
            class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1"
          >
            Switch Starter Demo
          </li>
          {#each Object.values(SAMPLE_TEMPLATES) as tpl}
            <li>
              <button
                class="flex items-center justify-between rounded-lg py-1.5 px-2 text-[11px] {schemaState.sandboxTemplateKey ===
                tpl.key
                  ? 'active font-bold'
                  : ''}"
                onclick={() => schemaState.loadSandboxDemo(tpl.key)}
              >
                <div class="flex items-center gap-1.5 min-w-0 truncate">
                  <Sparkles class="w-3 h-3 text-secondary shrink-0" />
                  <span class="truncate">{tpl.name}</span>
                </div>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else if schemaState.filePath}
      <!-- State B: Active File Mode (Compact File Pill with Menu Dropdown) -->
      <div class="dropdown dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="join border border-base-300/80 rounded-lg overflow-hidden bg-base-200/50 p-0.5 shadow-2xs hover:bg-base-200/80 transition-colors cursor-pointer"
          title={schemaState.filePath}
        >
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-base-content/85 max-w-44 sm:max-w-64 truncate"
          >
            <FolderOpen class="w-3.5 h-3.5 text-primary shrink-0" />
            <span class="truncate">{schemaState.filePath.split("/").pop()}</span
            >
            <ChevronDown class="w-3 h-3 opacity-60 shrink-0 ml-0.5" />
          </div>
        </div>

        <!-- File Options Dropdown Menu -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-xl z-50 w-52 p-1.5 shadow-2xl mt-1.5 text-xs gap-0.5"
        >
          <li
            class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1"
          >
            File Session Actions
          </li>
          <li>
            <button
              class="flex items-center gap-2 rounded-lg py-1.5 px-2 text-[11px] font-medium"
              onclick={onOpenFile}
            >
              <FolderOpen class="w-3.5 h-3.5 text-primary" />
              <span>Switch / Open File...</span>
            </button>
          </li>
          <li>
            <button
              class="flex items-center gap-2 rounded-lg py-1.5 px-2 text-[11px] text-error hover:bg-error/10 font-medium"
              onclick={() => schemaState.closeFile()}
            >
              <X class="w-3.5 h-3.5 text-error" />
              <span>Close Schema</span>
            </button>
          </li>
        </ul>
      </div>
    {:else}
      <!-- State A: Empty State (Minimal App Branding, Welcome Overlay Active) -->
      <div class="flex items-center gap-2">
        <div class="p-1.5 bg-primary/10 rounded-xl ring-1 ring-primary/20">
          <FileCode class="w-4 h-4 text-primary" />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-sm tracking-tight text-base-content"
            >Strata</span
          >
          <span
            class="badge badge-xs badge-neutral opacity-70 font-mono text-[9px]"
            >No Schema</span
          >
        </div>
      </div>
    {/if}
  </div>

  <!-- Center Side: View Mode Segment Switch (Sleek pill switch) -->
  <div class="navbar-center flex items-center justify-center">
    {#if schemaState.filePath || schemaState.isSandboxMode}
      <div
        class="join border border-base-300/80 rounded-lg overflow-hidden bg-base-200/40 p-0.5"
      >
        <button
          class="btn btn-xs join-item font-semibold px-3 h-6 min-h-0 border-0 transition-all text-[10px] {schemaState.isCodeCollapsed
            ? 'btn-ghost text-base-content/40 hover:text-base-content/80'
            : 'bg-base-100 text-primary shadow-sm hover:bg-base-100'}"
          onclick={() => schemaState.toggleCodePane()}
          title="Toggle Code Editor View"
        >
          <Code class="w-3.5 h-3.5" />
        </button>
        <button
          class="btn btn-xs join-item font-semibold px-3 h-6 min-h-0 border-0 transition-all text-[10px] {schemaState.isDiagramCollapsed
            ? 'btn-ghost text-base-content/40 hover:text-base-content/80'
            : 'bg-base-100 text-primary shadow-sm hover:bg-base-100'}"
          onclick={() => schemaState.toggleDiagramPane()}
          title="Toggle Diagram Canvas View"
        >
          <DraftingCompass class="w-3.5 h-3.5" />
        </button>
      </div>
    {/if}
  </div>

  <!-- Right Side: Action Tools -->
  <div class="navbar-end flex items-center justify-end gap-1.5">
    {#if schemaState.filePath || schemaState.isSandboxMode}
      <!-- Primary Action: New Table (Solid, bold) -->
      <button
        class="btn btn-primary btn-sm gap-1 rounded-lg shadow-sm font-semibold h-7 min-h-0 px-3 text-xs"
        onclick={() => (schemaState.showNewTableModal = true)}
        data-testid="new-table-button"
      >
        <span class="text-sm font-bold leading-none">+</span>
        <span>New Table</span>
      </button>

      {#if schemaState.nodes.length > 0}
        <div class="h-4 w-px bg-base-300/80 mx-1"></div>

        <!-- Quick Layout & Canvas Actions (Icon-only, uniform h-8/w-8 ghost buttons with tooltips) -->
        <div
          class="tooltip tooltip-bottom text-[10px] font-sans"
          data-tip={schemaState.compactMode
            ? "Disable Compact View"
            : "Enable Compact View"}
        >
          <button
            class="btn btn-ghost btn-sm btn-square w-8 h-8 rounded-lg text-base-content/70 hover:text-base-content hover:bg-base-200/80"
            onclick={() => (schemaState.compactMode = !schemaState.compactMode)}
          >
            {#if schemaState.compactMode}
              <EyeOff class="w-3.5 h-3.5 text-warning" />
            {:else}
              <Eye class="w-3.5 h-3.5" />
            {/if}
          </button>
        </div>

        <div
          class="tooltip tooltip-bottom text-[10px] font-sans"
          data-tip="Auto Layout Diagram"
        >
          <button
            class="btn btn-ghost btn-sm btn-square w-8 h-8 rounded-lg text-base-content/70 hover:text-base-content hover:bg-base-200/80"
            onclick={onAutoLayout}
          >
            <Workflow class="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          class="tooltip tooltip-bottom text-[10px] font-sans"
          data-tip="Export Diagram as PNG"
        >
          <button
            class="btn btn-ghost btn-sm btn-square w-8 h-8 rounded-lg text-primary/80 hover:text-primary hover:bg-primary/10"
            onclick={exportToImage}
            aria-label="Export"
          >
            <Camera class="w-3.5 h-3.5" />
          </button>
        </div>
      {/if}

      {#if schemaState.hasUnsavedChanges && schemaState.filePath}
        <div class="h-4 w-px bg-base-300/80 mx-1"></div>

        <!-- Diff Preview Action -->
        <button
          class="btn btn-outline btn-warning btn-sm gap-1.5 rounded-lg font-semibold h-8 min-h-0 px-2.5 text-xs hover:bg-warning/20"
          onclick={() => (showDiffPreview = true)}
          title="Preview AST Code Changes"
        >
          <GitCompare class="w-3.5 h-3.5" />
          <span>Preview Diff</span>
        </button>

        <!-- Save Action (Solid warning state) -->
        <button
          class="btn btn-warning btn-sm gap-1.5 rounded-lg shadow-sm font-semibold text-warning-content h-8 min-h-0 px-3 text-xs animate-pulse hover:animate-none"
          onclick={() => schemaState.saveToFile()}
          data-testid="save-layout-button"
        >
          <Save class="w-3.5 h-3.5" />
          <span>Save Layout</span>
        </button>

        <!-- Discard Action (Ghost action) -->
        <button
          class="btn btn-ghost btn-sm rounded-lg hover:bg-error/10 hover:text-error font-semibold h-8 min-h-0 px-2.5 text-xs text-base-content/75"
          onclick={() => schemaState.syncWithFile()}
          data-testid="discard-layout-button"
        >
          <Undo class="w-3.5 h-3.5 opacity-80" />
          <span>Discard</span>
        </button>
      {/if}
    {/if}

    <div class="h-4 w-px bg-base-300/80 mx-1"></div>

    <!-- Settings & Help Dropdown -->
    <div class="dropdown dropdown-end">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-sm btn-square w-8 h-8 rounded-lg hover:bg-base-200/80 flex items-center justify-center relative"
        title="Settings & Help"
      >
        <Menu class="w-3.5 h-3.5 text-base-content/75" />
        {#if updateState.hasUnseenUpdate}
          <span
            class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-base-100 animate-pulse"
          ></span>
        {/if}
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-xl z-50 w-48 p-1.5 shadow-2xl mt-1.5 gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150"
      >
        {#if schemaState.filePath || schemaState.isSandboxMode}
          <li>
            <button
              class="flex items-center gap-2 rounded-lg py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
              onclick={() => (schemaState.showProjectSettingsModal = true)}
            >
              <Settings class="w-3.5 h-3.5 text-base-content/70" />
              <span>Project Settings</span>
            </button>
          </li>
          <div class="h-px bg-base-300/40 my-1"></div>
        {/if}
        <li>
          <button
            class="flex items-center justify-between rounded-lg py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
            onclick={() => updateState.openModal()}
          >
            <div class="flex items-center gap-2">
              <CircleArrowUp class="w-3.5 h-3.5 text-base-content/70" />
              <span>Check for Updates...</span>
            </div>
            {#if updateState.hasUnseenUpdate}
              <span class="w-2 h-2 rounded-full bg-primary animate-pulse"
              ></span>
            {/if}
          </button>
        </li>
        <li>
          <button
            class="flex items-center gap-2 rounded-lg py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
            onclick={() => (showHelp = true)}
          >
            <BadgeQuestionMark class="w-3.5 h-3.5 text-base-content/70" />
            <span>Help & Shortcuts</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</div>

<HelpModal bind:show={showHelp} />
<DiffPreviewModal bind:show={showDiffPreview} />
<UpdateModal />
