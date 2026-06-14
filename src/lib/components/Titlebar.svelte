<script lang="ts">
  import { Minus, Square, X } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";
  import { PlatformService } from "$lib/services/platform";

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
  class="w-full h-8 bg-base-300/40 border-b border-base-300 flex items-center justify-between px-4 select-none z-50 shrink-0"
  data-tauri-drag-region
  data-testid="titlebar"
>
  <div class="flex items-center gap-2 pointer-events-none">
    <span class="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 leading-none">Strata</span>
    <span class="text-[9px] opacity-30">/</span>
    <span class="text-[10px] font-bold opacity-60 leading-none">
      {schemaState.filePath?.split("/").pop() || "No Schema"}
    </span>
    {#if schemaState.hasUnsavedChanges}
      <span class="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_currentColor] text-amber-500 animate-pulse" title="Unsaved Changes"></span>
    {/if}
  </div>

  <div class="flex items-center gap-0.5">
    <button
      class="btn btn-ghost btn-xs btn-square w-6 h-6 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center rounded"
      onclick={minimizeWindow}
      title="Minimize"
    >
      <Minus class="w-2.5 h-2.5 text-base-content" />
    </button>
    <button
      class="btn btn-ghost btn-xs btn-square w-6 h-6 opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center rounded"
      onclick={toggleMaximizeWindow}
      title="Maximize"
    >
      <Square class="w-2 h-2 text-base-content" />
    </button>
    <button
      class="btn btn-ghost btn-xs btn-square w-6 h-6 opacity-60 hover:opacity-100 hover:bg-error hover:text-error-content transition-all flex items-center justify-center rounded"
      onclick={closeWindow}
      title="Close"
    >
      <X class="w-3 h-3" />
    </button>
  </div>
</div>
