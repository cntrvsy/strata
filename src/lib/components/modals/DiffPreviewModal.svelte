<!--
  DiffPreviewModal.svelte

  Summary: Modal component rendering a CodeMirror merge diff view comparing disk code vs pending in-memory AST modifications.
  Expects: show bindable prop.
  Output: Lets developers inspect line diffs before saving or reverting.
-->
<script lang="ts">
  import { X, Save, Undo, GitCompare, Lightbulb } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { schemaState } from "$lib/state";
  import { PlatformService } from "$lib/services/platform";
  import { EditorView, basicSetup } from "codemirror";
  import { javascript } from "@codemirror/lang-javascript";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { MergeView } from "@codemirror/merge";

  let { show = $bindable(false) } = $props();

  let originalCode = $state("");
  let modifiedCode = $derived(schemaState.rawCode);
  let isLoading = $state(true);

  async function loadOriginalCode() {
    isLoading = true;
    try {
      if (schemaState.filePath) {
        originalCode = await PlatformService.readText(schemaState.filePath);
      } else {
        originalCode = schemaState.rawCode;
      }
    } catch (e) {
      originalCode = schemaState.rawCode;
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (show) {
      loadOriginalCode();
    }
  });

  function attachMergeView(
    node: HTMLElement,
    config: { original: string; modified: string },
  ) {
    node.innerHTML = "";
    const instance = new MergeView({
      parent: node,
      orientation: "a-b",
      revertControls: "b-to-a",
      gutter: true,
      a: {
        doc: config.original,
        extensions: [
          basicSetup,
          javascript({ typescript: true }),
          oneDark,
          EditorView.editable.of(false),
        ],
      },
      b: {
        doc: config.modified,
        extensions: [
          basicSetup,
          javascript({ typescript: true }),
          oneDark,
          EditorView.editable.of(false),
        ],
      },
    });

    return {
      destroy() {
        instance.destroy();
      },
    };
  }

  async function handleSave() {
    await schemaState.saveToFile();
    show = false;
  }

  async function handleDiscard() {
    await schemaState.syncWithFile();
    show = false;
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-md p-6"
    transition:fade={{ duration: 120 }}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="bg-base-100 rounded-box w-full max-w-5xl h-[85vh] shadow-2xl border border-base-300 overflow-hidden flex flex-col"
      in:scale={{ duration: 140, start: 0.98, easing: cubicOut }}
      out:scale={{ duration: 100, start: 0.98 }}
    >
      <!-- Header -->
      <div
        class="px-6 py-4 bg-base-200/90 border-b border-base-300 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 bg-warning/10 rounded-field text-warning">
            <GitCompare class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-base-content leading-none">
              AST Code Diff Preview
            </h3>
            <span class="text-[10px] text-base-content/50 font-medium"
              >Compare disk file vs pending in-memory AST modifications</span
            >
          </div>
        </div>

        <button
          class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
          onclick={() => (show = false)}
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Column Labels -->
      <div
        class="grid grid-cols-2 bg-[#21252b] border-b border-white/5 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-white/50 shrink-0"
      >
        <div class="flex items-center gap-2">
          <span class="status status-xs status-error"></span>
          <span>Disk Source (Original schema.ts)</span>
        </div>
        <div class="flex items-center gap-2 pl-4 border-l border-white/5">
          <span class="status status-xs status-success"></span>
          <span>Pending AST Layout (Modified)</span>
        </div>
      </div>

      <!-- Main Diff Container -->
      <div class="flex-1 relative overflow-hidden bg-[#282c34]">
        {#if isLoading}
          <div
            class="absolute inset-0 flex items-center justify-center bg-base-100/50 backdrop-blur-xs"
          >
            <span class="loading loading-spinner loading-md text-primary"
            ></span>
          </div>
        {:else}
          <div
            use:attachMergeView={{ original: originalCode, modified: modifiedCode }}
            class="w-full h-full overflow-auto cm-merge-wrapper"
          ></div>
        {/if}
      </div>

      <!-- Footer Actions -->
      <div
        class="px-6 py-4 bg-base-200/80 border-t border-base-300 flex items-center justify-between"
      >
        <span class="text-[10px] text-base-content/50 font-mono">
          <Lightbulb class="w-8 h-8 text-info/85 mt-0.5" /> Review AST statement
          changes before committing to disk.
        </span>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-ghost btn-sm rounded-field text-xs font-semibold text-error hover:bg-error/10"
            onclick={handleDiscard}
          >
            <Undo class="w-3.5 h-3.5 mr-1" />
            Discard Changes
          </button>

          <button
            class="btn btn-warning btn-sm rounded-field text-xs font-semibold px-6 text-warning-content shadow-sm"
            onclick={handleSave}
          >
            <Save class="w-3.5 h-3.5 mr-1" />
            Save Layout to Disk
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.cm-merge-wrapper) {
    height: 100% !important;
  }
  :global(.cm-merge-wrapper .cm-mergeView) {
    height: 100% !important;
  }
  :global(.cm-merge-wrapper .cm-editor) {
    height: 100% !important;
  }
  :global(.cm-merge-wrapper .cm-scroller) {
    font-family: "'JetBrains Mono', monospace" !important;
    font-size: 13px !important;
  }
</style>
