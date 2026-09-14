<!--
  Titlebar.svelte

  Summary: Unified modern desktop header combining window controls, file session state, canvas toolbar actions, and settings.
  Expects: None (shares global schemaState).
  Output: Interacts with Tauri window handlers, schema file operations, and canvas tools.
-->
<script lang="ts">
  import {
    Minus,
    Square,
    X,
    FolderOpen,
    Sparkles,
    RotateCcw,
    ChevronDown,
    FileCode,
    Camera,
    Eye,
    EyeOff,
    Workflow,
    Settings,
    Menu,
    CircleArrowUp,
    BadgeQuestionMark,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { updateState } from "#lib/state/updateState.svelte";
  import { PlatformService } from "#lib/services/platform";
  import { SAMPLE_TEMPLATES } from "#lib/mock";
  import { toPng } from "html-to-image";
  import { getNodesBounds, getViewportForBounds } from "@xyflow/svelte";
  import UpdateModal from "#lib/components/modals/UpdateModal.svelte";
  import { arrangeLayout } from "#lib/services/layout";

  /** Dismiss active element focus to cleanly close DaisyUI dropdowns */
  function closeDropdown() {
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement)?.blur();
    }
  }

  /** Opens native file dialog to select a Drizzle schema file */
  async function onOpenFile() {
    closeDropdown();
    await schemaState.openNewFile();
  }

  /** Window management operations */
  async function minimizeWindow() {
    try {
      await PlatformService.minimizeWindow();
    } catch (e) {
      console.warn("Window control not available:", e);
    }
  }

  async function toggleMaximizeWindow() {
    try {
      await PlatformService.toggleMaximizeWindow();
    } catch (e) {
      console.warn("Window control not available:", e);
    }
  }

  async function closeWindow() {
    try {
      await PlatformService.closeWindow();
    } catch (e) {
      console.warn("Window control not available:", e);
    }
  }

  /**
   * Automatically arranges all table nodes in the diagram.
   * Patches the layout and updates the disk schema file in one pass.
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
   * Automatically calculates bounds and viewport to ensure perfect framing.
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
      a.download = `strata-${schemaState.filePath?.split(/[/\\]/).pop() || "schema"}-${Date.now()}.png`;
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

<header
  class="navbar w-full h-10 min-h-10 bg-base-200/60 border-b border-base-300/80 backdrop-blur-md px-3 py-0 select-none z-50 shrink-0 gap-1 text-xs"
  data-tauri-drag-region
  data-testid="titlebar"
>
  <div class="contents" data-testid="navbar">
    <!-- START: Branding & File/Sandbox Session -->
    <div class="navbar-start flex items-center gap-2 w-auto min-w-0 shrink-0" data-tauri-drag-region="false">
      <!-- Brand Identifier -->
      <div class="flex items-center gap-1.5 pointer-events-none shrink-0">
        <FileCode class="w-3.5 h-3.5 text-primary opacity-90" />
        <span class="text-[9.5px] font-black uppercase tracking-[0.2em] opacity-60 leading-none">Strata</span>
        <span class="text-[9.5px] opacity-30">/</span>
      </div>

      {#if schemaState.isSandboxMode}
        <!-- Sandbox State -->
        <div class="dropdown dropdown-bottom" data-tauri-drag-region="false">
          <div
            tabindex="0"
            role="button"
            class="join border border-secondary/40 rounded-field overflow-hidden bg-secondary/10 p-0.5 shadow-2xs hover:bg-secondary/15 transition-colors cursor-pointer"
            title="Playground Sandbox Mode (In-Memory Engine)"
            data-tauri-drag-region="false"
          >
            <div class="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-secondary max-w-44 sm:max-w-60 truncate">
              <Sparkles class="w-3 h-3 text-secondary shrink-0" />
              <span class="capitalize truncate">{schemaState.sandboxTemplateKey} Demo</span>
              <ChevronDown class="w-2.5 h-2.5 opacity-70 shrink-0 ml-0.5 text-secondary" />
            </div>
          </div>

          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-box z-50 w-auto p-1.5 shadow-2xl mt-1 text-xs gap-0.5"
            data-tauri-drag-region="false"
          >
            <li class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1">
              Sandbox Session Actions
            </li>
            <li>
              <button
                class="flex items-center gap-2 rounded-field py-1.5 px-2 text-[11px] font-medium text-secondary hover:bg-secondary/10"
                onclick={() => {
                  closeDropdown();
                  schemaState.loadSandboxDemo(schemaState.sandboxTemplateKey);
                }}
                data-testid="reset-sandbox-button"
              >
                <RotateCcw class="w-3.5 h-3.5 text-secondary" />
                <span>Reset Sandbox Demo</span>
              </button>
            </li>
            <li>
              <button
                class="flex items-center gap-2 rounded-field py-1.5 px-2 text-[11px] text-error hover:bg-error/10 font-medium"
                onclick={() => {
                  closeDropdown();
                  schemaState.closeFile();
                }}
              >
                <X class="w-3.5 h-3.5 text-error" />
                <span>Exit Sandbox Mode</span>
              </button>
            </li>

            <div class="h-px bg-base-300/50 my-1"></div>

            <li class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1">
              Switch Starter Demo
            </li>
            {#each Object.values(SAMPLE_TEMPLATES) as tpl}
              <li>
                <button
                  class="flex items-center justify-between rounded-field py-1.5 px-2 text-[11px] {schemaState.sandboxTemplateKey === tpl.key ? 'active font-bold' : ''}"
                  onclick={() => {
                    closeDropdown();
                    schemaState.loadSandboxDemo(tpl.key);
                  }}
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
        <!-- Active File Mode -->
        <div class="dropdown dropdown-bottom" data-tauri-drag-region="false">
          <div
            tabindex="0"
            role="button"
            class="join border border-base-300/80 rounded-field overflow-hidden bg-base-200/50 p-0.5 shadow-2xs hover:bg-base-200/80 transition-colors cursor-pointer"
            title={schemaState.filePath}
            data-tauri-drag-region="false"
          >
            <div class="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-base-content/85 max-w-44 sm:max-w-60 truncate">
              <FolderOpen class="w-3 h-3 text-primary shrink-0" />
              <span class="truncate">{schemaState.filePath.split(/[/\\]/).pop()}</span>
              {#if schemaState.hasUnsavedChanges}
                <span class="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" title="Unsaved Changes"></span>
              {/if}
              <ChevronDown class="w-2.5 h-2.5 opacity-60 shrink-0 ml-0.5" />
            </div>
          </div>

          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-box z-50 w-52 p-1.5 shadow-2xl mt-1 text-xs gap-0.5"
            data-tauri-drag-region="false"
          >
            <li class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1">
              File Session Actions
            </li>
            <li>
              <button
                class="flex items-center gap-2 rounded-field py-1.5 px-2 text-[11px] font-medium"
                onclick={onOpenFile}
              >
                <FolderOpen class="w-3.5 h-3.5 text-primary" />
                <span>Switch / Open File...</span>
              </button>
            </li>
            <li>
              <button
                class="flex items-center gap-2 rounded-field py-1.5 px-2 text-[11px] text-error hover:bg-error/10 font-medium"
                onclick={() => {
                  closeDropdown();
                  schemaState.closeFile();
                }}
              >
                <X class="w-3.5 h-3.5 text-error" />
                <span>Close Schema</span>
              </button>
            </li>
          </ul>
        </div>
      {:else}
        <!-- Empty State -->
        <button
          class="btn btn-ghost btn-xs gap-1 rounded-field text-[10px] font-bold text-primary hover:bg-primary/10 h-6 min-h-0 px-2"
          onclick={onOpenFile}
          data-tauri-drag-region="false"
        >
          <FolderOpen class="w-3 h-3 text-primary" />
          <span>Open Schema...</span>
        </button>
      {/if}
    </div>

    <!-- CENTER: Window Drag Region & Subtle Status -->
    <div
      class="navbar-center flex-1 flex items-center justify-center h-full cursor-default select-none"
      data-tauri-drag-region
    >
      <div class="flex items-center gap-1.5 opacity-40 hover:opacity-75 transition-opacity text-[10px] font-mono pointer-events-none truncate max-w-xs">
        {#if schemaState.isSandboxMode}
          <span>in-memory playground</span>
        {:else if schemaState.filePath}
          <span class="truncate">{schemaState.filePath.split(/[/\\]/).slice(-2).join('/')}</span>
        {/if}
      </div>
    </div>

    <!-- END: Canvas Actions, Settings, & Window Controls -->
    <div class="navbar-end flex items-center justify-end gap-1.5 w-auto shrink-0 ml-auto" data-tauri-drag-region="false">
      {#if schemaState.filePath || schemaState.isSandboxMode}
        <!-- Primary Action: New Entity -->
        <button
          class="btn btn-primary btn-xs h-7 min-h-0 font-semibold px-2.5 shadow-sm text-[11px] gap-1 rounded-field"
          onclick={() => (schemaState.showNewTableModal = true)}
          data-testid="new-table-button"
        >
          <span class="text-xs font-bold leading-none">+</span>
          <span>New Entity</span>
        </button>

        {#if schemaState.nodes.length > 0}
          <div class="h-4 w-px bg-base-300/80 mx-0.5"></div>

          <!-- Quick Canvas Actions -->
          <div
            class="tooltip tooltip-bottom text-[10px] font-sans"
            data-tip={schemaState.compactMode ? "Disable Compact View" : "Enable Compact View"}
          >
            <button
              class="btn btn-ghost btn-xs btn-square w-7 h-7 rounded-field text-base-content/70 hover:text-base-content hover:bg-base-200/80"
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
              class="btn btn-ghost btn-xs btn-square w-7 h-7 rounded-field text-base-content/70 hover:text-base-content hover:bg-base-200/80"
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
              class="btn btn-ghost btn-xs btn-square w-7 h-7 rounded-field text-primary/80 hover:text-primary hover:bg-primary/10"
              onclick={exportToImage}
              aria-label="Export"
            >
              <Camera class="w-3.5 h-3.5" />
            </button>
          </div>
        {/if}

        {#if schemaState.isRecentlySaved}
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-field bg-success/10 text-success text-[10.5px] font-semibold animate-in fade-in duration-150">
            <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
            <span>Layout Saved</span>
          </div>
        {/if}
      {/if}

      <div class="h-4 w-px bg-base-300/80 mx-0.5"></div>

      <!-- Settings & Help Dropdown -->
      <div class="dropdown dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn btn-ghost btn-xs btn-square w-7 h-7 rounded-field hover:bg-base-200/80 flex items-center justify-center relative"
          title="Settings & Help"
        >
          <Menu class="w-3.5 h-3.5 text-base-content/75" />
          {#if updateState.hasUnseenUpdate}
            <span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary ring-2 ring-base-100 animate-pulse"></span>
          {/if}
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-box z-50 w-52 p-1.5 shadow-2xl mt-1 gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {#if schemaState.filePath || schemaState.isSandboxMode}
            <li>
              <button
                class="flex items-center gap-2 rounded-field py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
                onclick={() => {
                  closeDropdown();
                  schemaState.openHelpTopic("identity-auth");
                }}
              >
                <Sparkles class="w-3.5 h-3.5 text-secondary" />
                <span>Auth & Identity Blueprints...</span>
              </button>
            </li>
            <li>
              <button
                class="flex items-center gap-2 rounded-field py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
                onclick={() => {
                  closeDropdown();
                  schemaState.showProjectSettingsModal = true;
                }}
              >
                <Settings class="w-3.5 h-3.5 text-base-content/70" />
                <span>Project Settings</span>
              </button>
            </li>
            <div class="h-px bg-base-300/40 my-1"></div>
          {/if}
          <li>
            <button
              class="flex items-center justify-between rounded-field py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
              onclick={() => {
                closeDropdown();
                updateState.openModal();
              }}
            >
              <div class="flex items-center gap-2">
                <CircleArrowUp class="w-3.5 h-3.5 text-base-content/70" />
                <span>Check for Updates...</span>
              </div>
              {#if updateState.hasUnseenUpdate}
                <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              {/if}
            </button>
          </li>
          <li>
            <button
              class="flex items-center gap-2 rounded-field py-1.5 px-2.5 hover:bg-base-200/60 font-medium text-[11px] text-base-content/85"
              onclick={() => {
                closeDropdown();
                schemaState.openHelpTopic("all");
              }}
            >
              <BadgeQuestionMark class="w-3.5 h-3.5 text-base-content/70" />
              <span>Help & Shortcuts</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="h-4 w-px bg-base-300/80 mx-0.5"></div>

      <!-- Window Controls -->
      <div class="flex items-center gap-0.5">
        <button
          class="btn btn-ghost btn-xs btn-square w-6 h-6 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center rounded-field"
          onclick={minimizeWindow}
          title="Minimize"
        >
          <Minus class="w-2.5 h-2.5 text-base-content" />
        </button>
        <button
          class="btn btn-ghost btn-xs btn-square w-6 h-6 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center rounded-field"
          onclick={toggleMaximizeWindow}
          title="Maximize"
        >
          <Square class="w-2 h-2 text-base-content" />
        </button>
        <button
          class="btn btn-ghost btn-xs btn-square w-6 h-6 opacity-60 hover:opacity-100 hover:bg-error hover:text-error-content transition-all flex items-center justify-center rounded-field"
          onclick={closeWindow}
          title="Close"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</header>

<UpdateModal />
