<!--
  UpdateModal.svelte

  Summary: Software Update modal for checking, downloading, installing, and applying updates.
  Expects: None (uses updateState global store).
  Output: Displays update status, release notes, progress bar, and trigger buttons.
-->
<script lang="ts">
  import {
    X,
    RefreshCw,
    CircleCheck,
    Download,
    Sparkles,
    TriangleAlert,
    RotateCcw,
    ShieldCheck,
    CircleArrowUp,
  } from "lucide-svelte";
  import { updateState } from "$lib/state/updateState.svelte";
  import { fade, scale } from "svelte/transition";

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
</script>

{#if updateState.showModal}
  <div
    class="fixed inset-0 bg-base-300/80 backdrop-blur-md z-100 flex items-center justify-center p-4 select-none"
    transition:fade={{ duration: 150 }}
  >
    <!-- Modal Container -->
    <div
      class="bg-base-100 border border-base-300/90 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 relative"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <!-- Modal Header -->
      <div
        class="px-5 py-4 border-b border-base-300/70 flex items-center justify-between bg-base-200/40"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner"
          >
            <CircleArrowUp class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-base-content leading-tight">
              Software Update
            </h3>
          </div>
        </div>

        <button
          class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/60 hover:text-base-content hover:bg-base-200"
          onclick={() => updateState.closeModal()}
          aria-label="Close modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div
        class="p-6 flex flex-col items-center justify-center gap-4 text-center min-h-55"
      >
        <!-- 1. CHECKING STATE -->
        {#if updateState.status === "checking"}
          <div class="flex flex-col items-center gap-3 py-4">
            <div class="relative">
              <div
                class="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin flex items-center justify-center"
              ></div>
              <RefreshCw
                class="w-5 h-5 text-primary absolute top-3.5 left-3.5"
              />
            </div>
            <div class="space-y-1">
              <p class="text-sm font-semibold text-base-content">
                Checking for updates...
              </p>
              <p class="text-xs text-base-content/60">
                Connecting to CrabNebula release server
              </p>
            </div>
          </div>

          <!-- 2. UP TO DATE STATE -->
        {:else if updateState.status === "up-to-date"}
          <div class="flex flex-col items-center gap-3 py-2">
            <div
              class="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success"
            >
              <ShieldCheck class="w-6 h-6" />
            </div>
            <div class="space-y-1">
              <h4 class="text-base font-bold text-base-content">
                You're on the latest version!
              </h4>
              <p class="text-xs text-base-content/60 max-w-xs leading-relaxed">
                Strata is up to date. No new updates available at this time.
              </p>
            </div>
          </div>

          <!-- 3. UPDATE AVAILABLE STATE -->
        {:else if updateState.status === "available" && updateState.updateInfo}
          <div class="flex flex-col items-stretch w-full gap-3 text-left">
            <div
              class="flex items-center justify-between bg-primary/10 border border-primary/25 rounded-xl p-3"
            >
              <div class="flex items-center gap-2">
                <Sparkles class="w-4 h-4 text-primary" />
                <span class="text-xs font-bold text-base-content">
                  Version {updateState.updateInfo.version} is available!
                </span>
              </div>
              <span
                class="badge badge-primary badge-sm font-semibold text-[10px]"
                >New Release</span
              >
            </div>

            {#if updateState.updateInfo.body}
              <div
                class="bg-base-200/60 border border-base-300/60 rounded-xl p-3 max-h-36 overflow-y-auto text-xs space-y-1"
              >
                <p
                  class="font-bold text-[11px] text-base-content/75 uppercase tracking-wider"
                >
                  Release Notes
                </p>
                <p
                  class="text-base-content/80 whitespace-pre-wrap leading-relaxed font-sans"
                >
                  {updateState.updateInfo.body}
                </p>
              </div>
            {/if}
          </div>

          <!-- 4. DOWNLOADING STATE -->
        {:else if updateState.status === "downloading"}
          <div class="flex flex-col items-center w-full gap-3 py-2">
            <div
              class="w-12 h-12 rounded-full bg-info/15 border border-info/30 flex items-center justify-center text-info animate-bounce"
            >
              <Download class="w-6 h-6" />
            </div>
            <div class="space-y-1 w-full">
              <h4 class="text-sm font-bold text-base-content">
                Downloading Update...
              </h4>
              <progress
                class="progress progress-primary w-full h-2 rounded-full"
                value={updateState.progress.percent}
                max="100"
              ></progress>
              <div
                class="flex items-center justify-between text-[11px] text-base-content/60 font-mono px-1"
              >
                <span>{updateState.progress.percent}%</span>
                <span>
                  {formatBytes(updateState.progress.downloaded)}
                  {#if updateState.progress.total > 1}
                    / {formatBytes(updateState.progress.total)}
                  {/if}
                </span>
              </div>
            </div>
          </div>

          <!-- 5. READY / INSTALLED STATE -->
        {:else if updateState.status === "ready"}
          <div class="flex flex-col items-center gap-3 py-2">
            <div
              class="w-12 h-12 rounded-full bg-success/20 border border-success/40 flex items-center justify-center text-success"
            >
              <CircleCheck class="w-6 h-6" />
            </div>
            <div class="space-y-1">
              <h4 class="text-base font-bold text-base-content">
                Update Installed Successfully!
              </h4>
              <p class="text-xs text-base-content/75 max-w-xs">
                Restart Strata now to switch to the new version.
              </p>
            </div>
          </div>

          <!-- 6. ERROR STATE -->
        {:else if updateState.status === "error"}
          <div class="flex flex-col items-center gap-3 py-2">
            <div
              class="w-12 h-12 rounded-full bg-error/15 border border-error/30 flex items-center justify-center text-error"
            >
              <TriangleAlert class="w-6 h-6" />
            </div>
            <div class="space-y-1">
              <h4 class="text-sm font-bold text-error">Update Failed</h4>
              <p class="text-xs text-base-content/70 max-w-xs leading-relaxed">
                {updateState.errorMessage ||
                  "Unable to complete update process."}
              </p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Modal Footer / Actions -->
      <div
        class="px-5 py-3 border-t border-base-300/70 bg-base-200/40 flex items-center justify-end gap-2"
      >
        {#if updateState.status === "up-to-date"}
          <button
            class="btn btn-ghost btn-sm rounded-lg text-xs font-semibold"
            onclick={() => updateState.closeModal()}
          >
            Close
          </button>
          <button
            class="btn btn-outline btn-sm rounded-lg text-xs font-semibold gap-1.5"
            onclick={() => updateState.check()}
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>Check Again</span>
          </button>
        {:else if updateState.status === "available"}
          <button
            class="btn btn-ghost btn-sm rounded-lg text-xs font-semibold"
            onclick={() => updateState.closeModal()}
          >
            Later
          </button>
          <button
            class="btn btn-primary btn-sm rounded-lg text-xs font-bold gap-1.5 shadow-md"
            onclick={() => updateState.downloadAndInstall()}
          >
            <Download class="w-3.5 h-3.5" />
            <span>Download & Install</span>
          </button>
        {:else if updateState.status === "ready"}
          <button
            class="btn btn-success btn-sm rounded-lg text-xs font-bold text-success-content gap-1.5 shadow-md"
            onclick={() => updateState.relaunch()}
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Relaunch Now</span>
          </button>
        {:else if updateState.status === "error"}
          <button
            class="btn btn-ghost btn-sm rounded-lg text-xs font-semibold"
            onclick={() => updateState.closeModal()}
          >
            Close
          </button>
          <button
            class="btn btn-primary btn-sm rounded-lg text-xs font-semibold gap-1.5"
            onclick={() => updateState.check()}
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        {:else}
          <button
            class="btn btn-ghost btn-sm rounded-lg text-xs font-semibold"
            onclick={() => updateState.closeModal()}
            disabled={updateState.status === "downloading"}
          >
            Cancel
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
