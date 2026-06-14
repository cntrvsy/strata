<script lang="ts">
  /**
   * Overlays.svelte
   *
   * Manages global UI layers including:
   * - Empty state (Select File prompt)
   * - Validation errors (Parse failures)
   * - Unsaved changes toast (Ctrl+S reminder)
   * - Live coordinate stats
   */
  import { FileCode, FolderOpen, AlertCircle, Check } from "lucide-svelte";
  import { schemaState } from "../state.svelte";
  import { fade, fly } from "svelte/transition";
</script>

<!-- Empty State Overlay -->
{#if schemaState.machine.current === "EMPTY"}
  <div
    class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-base-100/60 backdrop-blur-sm animate-in fade-in duration-700"
  >
    <div
      class="p-8 bg-base-100 border border-base-300 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-sm text-center"
    >
      <div
        class="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-primary/10"
      >
        <FileCode class="w-10 h-10 text-primary/40" />
      </div>
      <h2 class="text-2xl font-black mb-3 tracking-tight">Ready?</h2>
      <p class="text-sm text-base-content/50 mb-8 leading-relaxed">
        Drag & drop your Drizzle <code
          class="bg-base-200 px-1.5 py-0.5 rounded text-primary">schema.ts</code
        > here and see your mental model come to life.
      </p>
      <button
        class="btn btn-primary btn-lg rounded-2xl px-12 shadow-xl shadow-primary/30"
        onclick={() => schemaState.openNewFile()}
      >
        <FolderOpen class="w-5 h-5 mr-3" />
        Select File
      </button>
    </div>
  </div>
{/if}

<!-- Loading State Overlay -->
{#if schemaState.machine.current === "BUSY"}
  <div
    class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-base-100/10 backdrop-blur-[1px] animate-in fade-in duration-300"
  >
    <div
      class="p-4 bg-base-100 border border-base-300 rounded-2xl shadow-xl flex items-center gap-3"
    >
      <span class="loading loading-spinner loading-sm text-primary"></span>
      <span class="text-[10px] font-black uppercase tracking-widest opacity-40"
        >Syncing Schema...</span
      >
    </div>
  </div>
{/if}

<!-- Validation / Disk Error Overlay -->
{#if schemaState.machine.current === "ERROR"}
  <div
    class="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl animate-in slide-in-from-bottom-8"
  >
    <div
      class="alert alert-error shadow-2xl rounded-2xl border-none bg-error/90 backdrop-blur-md text-error-content flex items-start gap-4"
    >
      <div class="p-2 bg-white/20 rounded-xl">
        <AlertCircle class="w-5 h-5" />
      </div>
      <div class="flex flex-col gap-1 grow">
        <h3 class="font-bold text-sm uppercase tracking-tight">
          {schemaState.errorType === "disk"
            ? "Failed to Save: Disk Write Error"
            : "Sync Paused: Parse Error"}
        </h3>
        <p class="text-[10px] opacity-90 font-mono leading-tight">
          {schemaState.error}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="btn btn-sm btn-ghost bg-white/10 hover:bg-white/20 rounded-xl whitespace-nowrap"
          onclick={() =>
            schemaState.errorType === "disk"
              ? schemaState.saveToFile()
              : schemaState.syncWithFile()}
        >
          Retry
        </button>
        <button
          class="btn btn-sm btn-ghost bg-white/10 hover:bg-white/20 rounded-xl whitespace-nowrap"
          onclick={() => schemaState.openNewFile()}
        >
          Open Different
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Export Completed Toast -->
{#if schemaState.showExportToast}
  <div
    in:fly={{ y: 20, duration: 400 }}
    out:fade={{ duration: 400 }}
    class="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm"
  >
    <div
      class="alert bg-success text-success-content backdrop-blur-md shadow-2xl rounded-2xl border border-white/10 py-3"
    >
      <div class="p-2 bg-white/20 rounded-xl">
        <Check class="w-4 h-4" />
      </div>
      <div class="flex flex-col">
        <span class="text-xs font-bold tracking-tight">Export Successful</span>
        <span
          class="text-[9px] opacity-80 uppercase tracking-widest font-black"
        >
          Check your Downloads folder for the PNG
        </span>
      </div>
    </div>
  </div>
{/if}

<!-- Unsaved Changes Toast -->
{#if (schemaState.hasUnsavedChanges || schemaState.isRecentlySaved) && !schemaState.showExportToast}
  <div
    in:fly={{ y: 20, duration: 400 }}
    out:fade={{ duration: 1000 }}
    class="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm"
  >
    <div
      class="alert {schemaState.isRecentlySaved
        ? 'bg-success text-success-content'
        : 'bg-neutral/95 text-neutral-content'} backdrop-blur-md shadow-2xl rounded-2xl border border-white/10 py-3 transition-colors duration-500"
    >
      <div
        class="p-2 {schemaState.isRecentlySaved
          ? 'bg-white/20'
          : 'bg-primary/20'} rounded-xl"
      >
        {#if schemaState.isRecentlySaved}
          <Check class="w-4 h-4" />
        {:else}
          <FileCode class="w-4 h-4 text-primary" />
        {/if}
      </div>
      <div class="flex flex-col">
        <span class="text-xs font-bold tracking-tight">
          {schemaState.isRecentlySaved
            ? "Positions Synced"
            : "Saving Changes..."}
        </span>
        {#if !schemaState.isRecentlySaved}
          <span
            class="text-[9px] opacity-60 uppercase tracking-widest font-black"
            >Autosaving coordinate updates</span
          >
        {:else}
          <span
            class="text-[9px] opacity-80 uppercase tracking-widest font-black"
            >Local schema updated</span
          >
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Coordinate Stats -->
<div
  class="absolute bottom-10 right-28 z-10 pointer-events-none opacity-40 hover:opacity-100 transition-opacity"
>
  <div
    class="bg-neutral text-neutral-content px-3 py-1.5 rounded-xl text-[10px] font-mono shadow-2xl flex gap-3 border border-white/10 backdrop-blur-md"
  >
    <span class="opacity-30">NODES: {schemaState.nodes.length}</span>
    <div class="h-3 w-px bg-white/10"></div>
    <span
      >COORD: {Math.round(
        schemaState.nodes.find((n) => n.selected)?.position.x ?? 0,
      )}, {Math.round(
        schemaState.nodes.find((n) => n.selected)?.position.y ?? 0,
      )}</span
    >
  </div>
</div>
