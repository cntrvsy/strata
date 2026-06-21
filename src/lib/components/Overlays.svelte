<script lang="ts">
  /**
   * Overlays.svelte
   *
   * Manages global UI layers including:
   * - Empty state (Select File prompt)
   * - Loading state (Busy/Syncing spinner)
   * - Reactive Sonner toasts for file sync, saves, and errors
   */
  import { FileCode, FolderOpen } from "lucide-svelte";
  import { schemaState } from "../state.svelte";
  import { toast } from "svelte-sonner";

  // Watch for save / syncing states
  $effect(() => {
    if (schemaState.isSaving) {
      toast.loading("Saving changes...", { id: "save-toast" });
    }
  });

  $effect(() => {
    if (schemaState.isRecentlySaved) {
      toast.success("Positions Synced", {
        id: "save-toast",
        description: "Local schema updated"
      });
    }
  });

  // Watch for errors
  $effect(() => {
    if (schemaState.machine.current === "ERROR") {
      const isDisk = schemaState.errorType === "disk";
      toast.error(isDisk ? "Failed to Save: Disk Write Error" : "Sync Paused: Parse Error", {
        id: "error-toast",
        description: schemaState.error || "An unknown error occurred",
        duration: Infinity,
        action: {
          label: "Retry",
          onClick: () => {
            if (isDisk) {
              schemaState.saveToFile();
            } else {
              schemaState.syncWithFile();
            }
          }
        },
        cancel: {
          label: "Open Different",
          onClick: () => {
            schemaState.openNewFile();
          }
        }
      });
    } else {
      toast.dismiss("error-toast");
    }
  });

  // Watch for export toast
  $effect(() => {
    if (schemaState.showExportToast) {
      toast.success("Export Successful", {
        description: "Check your Downloads folder for the PNG"
      });
      schemaState.showExportToast = false;
    }
  });
</script>

<!-- Empty State Overlay -->
{#if schemaState.machine.current === "EMPTY"}
  <div
    class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-base-100/60 backdrop-blur-sm animate-in fade-in duration-700"
  >
    <div
      class="p-8 bg-base-100 border border-base-300 rounded-[3rem] shadow-2xl flex flex-col items-center w-full max-w-md text-center"
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
        class="btn btn-primary btn-lg rounded-2xl w-full px-12 shadow-xl shadow-primary/30"
        onclick={() => schemaState.openNewFile()}
      >
        <FolderOpen class="w-5 h-5 mr-3" />
        Select File
      </button>

      {#if schemaState.recentFiles.length > 0}
        <div class="w-full border-t border-base-300 pt-6 mt-6 text-left">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3">Recent Schemas</h3>
          <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {#each schemaState.recentFiles as path}
              <button
                class="w-full text-left p-3 rounded-xl hover:bg-base-200 border border-base-200 hover:border-base-300 flex items-center justify-between group transition-all"
                onclick={() => schemaState.openFileDirectly(path)}
              >
                <div class="flex flex-col min-w-0 flex-1 pr-2">
                  <span class="font-bold text-xs truncate text-base-content/80 group-hover:text-primary transition-colors">
                    {path.split('/').pop()}
                  </span>
                  <span class="text-[9px] opacity-40 font-mono truncate">{path}</span>
                </div>
                <FolderOpen class="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Loading State Overlay -->
{#if schemaState.machine.current === "BUSY" && !schemaState.filePath}
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
