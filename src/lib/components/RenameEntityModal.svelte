<!--
  RenameEntityModal.svelte

  Summary: Sleek DaisyUI modal for renaming schema entities with validation.
  Expects: None (shares global schemaState).
  Output: Triggers schemaState.renameTable().
-->
<script lang="ts">
  import { FilePen, X } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import { schemaState } from "$lib/state";

  let newName = $state(schemaState.renameEntityTargetId || "");
  let errorMsg = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    newName = schemaState.renameEntityTargetId || "";
    errorMsg = "";
    if (inputEl) {
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  function validate(val: string): boolean {
    const trimmed = val.trim();
    if (!trimmed) {
      errorMsg = "Entity name cannot be empty.";
      return false;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      errorMsg = "Name must be a valid alphanumeric identifier.";
      return false;
    }
    if (
      trimmed !== schemaState.renameEntityTargetId &&
      schemaState.nodes.some((n) => n.id === trimmed)
    ) {
      errorMsg = `Entity name "${trimmed}" already exists.`;
      return false;
    }
    errorMsg = "";
    return true;
  }

  function handleSave() {
    const targetId = schemaState.renameEntityTargetId;
    const trimmed = newName.trim();
    if (!targetId) return;

    if (!validate(trimmed)) return;

    if (trimmed !== targetId) {
      schemaState.renameTable(targetId, trimmed);
    }
    close();
  }

  function close() {
    schemaState.showRenameModal = false;
    schemaState.renameEntityTargetId = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter") {
      handleSave();
    }
  }
</script>

{#if schemaState.showRenameModal}
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
          <div class="p-2 bg-secondary/10 rounded-xl text-secondary">
            <FilePen class="w-4 h-4" />
          </div>
          <div>
            <h3
              class="font-bold text-sm text-base-content uppercase tracking-wider"
            >
              Rename Entity
            </h3>
            <span class="text-[10px] text-base-content/60 font-mono"
              >Target: {schemaState.renameEntityTargetId}</span
            >
          </div>
        </div>

        <button
          class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
          onclick={close}
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 flex flex-col gap-4">
        <div>
          <label
            for="rename-input"
            class="block text-xs font-semibold text-base-content/80 mb-1.5"
            >New Entity Identifier</label
          >
          <input
            id="rename-input"
            bind:this={inputEl}
            type="text"
            class="input input-sm input-bordered w-full rounded-xl text-xs bg-base-100 focus:input-secondary font-mono"
            bind:value={newName}
            oninput={() => validate(newName)}
            placeholder="e.g. users_v2"
          />
          {#if errorMsg}
            <span class="text-[10px] text-error font-medium mt-1 block"
              >{errorMsg}</span
            >
          {/if}
        </div>
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
          class="btn btn-secondary btn-xs rounded-xl font-bold px-4 shadow-sm"
          onclick={handleSave}
          disabled={Boolean(errorMsg)}
        >
          Rename Entity
        </button>
      </div>
    </div>
  </div>
{/if}
