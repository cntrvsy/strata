<!--
  LoadingOverlay.svelte

  Summary: Full-screen or canvas loading spinner for busy FSM states.
  Expects: None (shares global schemaState).
  Output: Visual feedback during async operations.
-->
<script lang="ts">
  import { schemaState } from "#lib/state";
</script>

{#if schemaState.machine.current === "BUSY" && !schemaState.filePath}
  <div
    class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-base-100/20 backdrop-blur-[1px] animate-in fade-in duration-200"
    data-testid="loading-overlay"
  >
    <div
      class="p-4 bg-base-100 border border-base-300/80 rounded-box shadow-xl flex items-center gap-3"
    >
      <span class="loading loading-spinner loading-sm text-primary"></span>
      <span class="text-[11px] font-bold uppercase tracking-wider opacity-60">
        Loading Schema...
      </span>
    </div>
  </div>
{/if}
