<!--
  Titlebar.svelte

  Summary: Custom Tauri window title bar for dragging, minimizing, maximizing, and closing the app window.
  Expects: None (shares global schemaState).
  Output: Interacts with Tauri window handlers.
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
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import { SAMPLE_TEMPLATES } from "#lib/mock";

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
</script>

<div
  class="w-full h-8 bg-base-300/40 border-b border-base-300 flex items-center justify-between px-3 select-none z-50 shrink-0"
  data-tauri-drag-region
  data-testid="titlebar"
>
  <div class="flex items-center gap-2" data-tauri-drag-region="false">
    <div class="flex items-center gap-1.5 pointer-events-none">
      <FileCode class="w-3.5 h-3.5 text-primary opacity-80" />
      <span class="text-[9px] font-black uppercase tracking-[0.2em] opacity-50 leading-none">Strata</span>
      <span class="text-[9px] opacity-30">/</span>
    </div>

    {#if schemaState.isSandboxMode}
      <!-- State C: Playground Sandbox Active -->
      <div class="dropdown dropdown-bottom" data-tauri-drag-region="false">
        <div
          tabindex="0"
          role="button"
          class="join border border-secondary/40 rounded-field overflow-hidden bg-secondary/10 p-0.5 shadow-2xs hover:bg-secondary/15 transition-colors cursor-pointer"
          title="Playground Sandbox Mode (In-Memory Engine)"
          data-tauri-drag-region="false"
        >
          <div
            class="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-secondary max-w-44 sm:max-w-64 truncate"
          >
            <Sparkles class="w-3 h-3 text-secondary shrink-0" />
            <span class="capitalize truncate"
              >{schemaState.sandboxTemplateKey} Demo</span
            >
            <ChevronDown
              class="w-2.5 h-2.5 opacity-70 shrink-0 ml-0.5 text-secondary"
            />
          </div>
        </div>

        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 border border-base-300/80 rounded-box z-50 w-auto p-1.5 shadow-2xl mt-1 text-xs gap-0.5"
          data-tauri-drag-region="false"
        >
          <li
            class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1"
          >
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

          <li
            class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1"
          >
            Switch Starter Demo
          </li>
          {#each Object.values(SAMPLE_TEMPLATES) as tpl}
            <li>
              <button
                class="flex items-center justify-between rounded-field py-1.5 px-2 text-[11px] {schemaState.sandboxTemplateKey ===
                tpl.key
                  ? 'active font-bold'
                  : ''}"
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
      <!-- State B: Active File Mode -->
      <div class="dropdown dropdown-bottom" data-tauri-drag-region="false">
        <div
          tabindex="0"
          role="button"
          class="join border border-base-300/80 rounded-field overflow-hidden bg-base-200/50 p-0.5 shadow-2xs hover:bg-base-200/80 transition-colors cursor-pointer"
          title={schemaState.filePath}
          data-tauri-drag-region="false"
        >
          <div
            class="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold text-base-content/85 max-w-44 sm:max-w-64 truncate"
          >
            <FolderOpen class="w-3 h-3 text-primary shrink-0" />
            <span class="truncate">{schemaState.filePath.split(/[/\\]/).pop()}</span
            >
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
          <li
            class="menu-title text-[9px] uppercase tracking-wider opacity-50 px-2 py-1"
          >
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
      <!-- State A: Empty State -->
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

  <div class="flex items-center gap-0.5" data-tauri-drag-region="false">
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

