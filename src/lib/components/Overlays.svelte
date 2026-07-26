<!--
  Overlays.svelte

  Summary: Global UI overlays showing empty/landing view, loading spinner overlay, and reactive Sonner toasts.
  Expects: None (shares global schemaState).
  Output: Interactive file loading buttons and toast notifications.
-->
<script lang="ts">
  import { FileCode, FolderOpen, Sparkles } from "lucide-svelte";
  import { schemaState } from "$lib/state";
  import { toast } from "svelte-sonner";
  import ProjectSettingsModal from "$lib/components/ProjectSettingsModal.svelte";
  import RenameEntityModal from "$lib/components/RenameEntityModal.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import { SAMPLE_TEMPLATES } from "$lib/mock";

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
        description: "Local schema updated",
      });
    }
  });

  // Watch for errors
  $effect(() => {
    if (schemaState.machine.current === "ERROR") {
      const isDisk = schemaState.errorType === "disk";
      toast.error(
        isDisk
          ? "Failed to Save: Disk Write Error"
          : "Sync Paused: Parse Error",
        {
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
            },
          },
          cancel: {
            label: "Open Different",
            onClick: () => {
              schemaState.openNewFile();
            },
          },
        },
      );
    } else {
      toast.dismiss("error-toast");
    }
  });

  // Watch for export toast
  $effect(() => {
    if (schemaState.showExportToast) {
      toast.success("Export Successful", {
        description: "Check your Downloads folder for the PNG",
      });
      schemaState.showExportToast = false;
    }
  });
</script>

<!-- Empty State Overlay -->
{#if schemaState.machine.current === "EMPTY" && !schemaState.isSandboxMode}
  <div
    class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-base-100/65 backdrop-blur-md animate-in fade-in duration-700 p-4"
  >
    <div
      class="p-8 bg-base-100 border border-base-300/80 rounded-3xl shadow-2xl flex flex-col items-center w-full max-w-md text-center"
    >
      <div
        class="w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center mb-5 ring-1 ring-primary/10"
      >
        <FileCode class="w-8 h-8 text-primary/50" />
      </div>
      <h2 class="text-2xl font-bold mb-2 tracking-tight">Ready to Design?</h2>
      <p class="text-xs text-base-content/60 mb-6 leading-relaxed font-medium">
        Drag & drop your Drizzle <code
          class="bg-base-200/60 px-1.5 py-0.5 rounded text-primary font-mono text-[11px]"
          >schema.ts</code
        > here or start with an interactive playground demo.
      </p>

      <div class="flex flex-col w-full gap-3">
        <button
          class="btn btn-primary rounded-xl w-full px-8 shadow-sm font-semibold text-xs h-10 min-h-0"
          onclick={() => schemaState.openNewFile()}
        >
          <FolderOpen class="w-4 h-4 mr-1.5" />
          Select Schema File
        </button>

        <div
          class="divider text-[10px] uppercase font-bold text-base-content/30 my-0"
        >
          OR PLAYGROUND DEMO
        </div>

        <div
          class="flex flex-col gap-2 bg-base-200/40 p-3 rounded-2xl border border-base-300/60 text-left"
        >
          <span
            class="text-[10px] font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5 px-1"
          >
            <Sparkles class="w-3.5 h-3.5 text-secondary" />
            Interactive Starter Templates
          </span>

          <div class="grid grid-cols-1 gap-1.5">
            {#each Object.values(SAMPLE_TEMPLATES) as tpl}
              <button
                class="btn btn-ghost justify-start h-auto py-2 px-3 rounded-xl border border-base-300/40 hover:border-secondary/60 hover:bg-secondary/10 flex items-center group transition-all text-left"
                onclick={() => schemaState.loadSandboxDemo(tpl.key)}
              >
                <div class="flex flex-col min-w-0 pr-2">
                  <span
                    class="font-bold text-xs text-base-content/90 group-hover:text-secondary transition-colors"
                  >
                    {tpl.name}
                  </span>
                  <span
                    class="text-[9.5px] opacity-60 font-sans leading-tight mt-0.5"
                    >{tpl.description}</span
                  >
                </div>
                <span
                  class="badge badge-xs text-[9px] badge-outline opacity-60 font-mono group-hover:opacity-100 shrink-0"
                  >{tpl.badge}</span
                >
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if schemaState.recentFiles.length > 0}
        <div class="w-full border-t border-base-300/60 pt-4 mt-5 text-left">
          <h3
            class="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-2"
          >
            Recent Schemas
          </h3>
          <div class="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {#each schemaState.recentFiles as path}
              <button
                class="w-full text-left p-2.5 rounded-xl hover:bg-base-200/50 border border-base-200/40 hover:border-base-300/60 flex items-center justify-between group transition-all"
                onclick={() => schemaState.openFileDirectly(path)}
              >
                <div class="flex flex-col min-w-0 flex-1 pr-2">
                  <span
                    class="font-bold text-xs truncate text-base-content/80 group-hover:text-primary transition-colors"
                  >
                    {path.split("/").pop()}
                  </span>
                  <span class="text-[9px] opacity-40 font-mono truncate"
                    >{path}</span
                  >
                </div>
                <FolderOpen
                  class="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all"
                />
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
      class="p-4 bg-base-100 border border-base-300/80 rounded-2xl shadow-xl flex items-center gap-3"
    >
      <span class="loading loading-spinner loading-sm text-primary"></span>
      <span class="text-[10px] font-bold uppercase tracking-wider opacity-40"
        >Syncing Schema...</span
      >
    </div>
  </div>
{/if}

{#if schemaState.showProjectSettingsModal}
  <ProjectSettingsModal />
{/if}

<RenameEntityModal />
<ConfirmModal />
