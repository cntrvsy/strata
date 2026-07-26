<!--
  ConfirmModal.svelte

  Summary: Generic confirmation modal for destructive entity or relationship deletions.
  Expects: None (shares global schemaState).
  Output: Triggers schemaState.confirmModalData.onConfirm().
-->
<script lang="ts">
  import { TriangleAlert, X, Trash2 } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import { schemaState } from "$lib/state";

  function handleConfirm() {
    const data = schemaState.confirmModalData;
    if (data?.onConfirm) {
      data.onConfirm();
    }
    close();
  }

  function close() {
    schemaState.showConfirmModal = false;
    schemaState.confirmModalData = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter") {
      handleConfirm();
    }
  }
</script>

{#if schemaState.showConfirmModal && schemaState.confirmModalData}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="fixed inset-0 z-150 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    transition:fade={{ duration: 150 }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={handleKeyDown}
  >
    <div
      class="bg-base-100 rounded-3xl w-full max-w-md shadow-2xl border border-base-300 overflow-hidden flex flex-col font-sans"
    >
      <!-- Header -->
      <div
        class="px-6 py-4 bg-base-200/90 border-b border-base-300 flex items-center justify-between"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-2 bg-error/10 rounded-xl text-error">
            {#if schemaState.confirmModalData.isDanger !== false}
              <Trash2 class="w-4 h-4" />
            {:else}
              <TriangleAlert class="w-4 h-4 text-warning" />
            {/if}
          </div>
          <h3
            class="font-bold text-sm text-base-content uppercase tracking-wider"
          >
            {schemaState.confirmModalData.title}
          </h3>
        </div>

        <button
          class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
          onclick={close}
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div
        class="p-6 flex flex-col gap-2 text-xs text-base-content/80 leading-relaxed font-sans"
      >
        <p>{schemaState.confirmModalData.message}</p>
      </div>

      <!-- Footer -->
      <div
        class="px-6 py-3.5 bg-base-200/40 border-t border-base-300/80 flex items-center justify-end gap-2"
      >
        <button
          class="btn btn-ghost btn-xs rounded-xl font-semibold px-3"
          onclick={close}
        >
          Cancel
        </button>
        <button
          class="btn btn-error btn-xs rounded-xl font-bold px-4 shadow-sm text-error-content"
          onclick={handleConfirm}
        >
          {schemaState.confirmModalData.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
