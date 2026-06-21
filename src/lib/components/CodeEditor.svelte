<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { schemaState } from "$lib/state.svelte";
  import { FileCode } from "lucide-svelte";
  import { parseSchema } from "$lib/parser";

  let debounceTimer: any;
  let localValue = $state(schemaState.rawCode);

  // Sync editor when rawCode is updated from external/diagram operations
  $effect(() => {
    if (schemaState.rawCode !== localValue) {
      localValue = schemaState.rawCode;
    }
  });

  // Parse and sync whenever localValue changes from user input
  $effect(() => {
    if (localValue !== schemaState.rawCode) {
      handleCodeChange(localValue);
    }
  });

  // Debounce parser execution to ensure smooth typing performance
  function handleCodeChange(newCode: string) {
    schemaState.rawCode = newCode;

    if (schemaState.machine.current === "IDLE") {
      schemaState.machine.send("EDIT");
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (schemaState.isSyncing) return;

      const result = parseSchema(newCode);
      if (result.success) {
        const selectedNodeIds = new Set(
          schemaState.nodes.filter((n) => n.selected).map((n) => n.id),
        );

        schemaState.nodes = result.nodes.map((n) => ({
          ...n,
          selected: selectedNodeIds.has(n.id),
        }));
        schemaState.edges = result.edges;
        schemaState.isValid = true;
        schemaState.error = null;
        schemaState.errorLoc = null;
      } else {
        schemaState.isValid = false;
        schemaState.error = result.error || "Parse Error";
        schemaState.errorLoc = result.errorLoc || null;
      }
    }, 450);
  }
</script>

<div class="w-full h-full bg-[#282c34] flex flex-col min-h-0 overflow-hidden">
  <!-- Viewer Toolbar -->
  <div
    class="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#21252b] shrink-0"
  >
    <div class="flex items-center gap-3">
      <div class="p-2 bg-primary/10 rounded-lg">
        <FileCode class="w-4 h-4 text-white" />
      </div>
      <div class="flex flex-col">
        <span
          class="text-[10px] font-black text-white/20 uppercase tracking-widest leading-none mb-0.5"
          >Schema Mirror</span
        >
        <span class="text-xs font-bold text-white/60"
          >{schemaState.filePath?.split("/").pop()}</span
        >
      </div>
    </div>
  </div>

  <!-- Editor Container -->
  <div class="grow relative overflow-hidden bg-[#282c34]">
    <div class="absolute inset-0 overflow-auto scrollbar-hide">
      <CodeMirror
        bind:value={localValue}
        readonly={false}
        lang={javascript({ typescript: true })}
        theme={oneDark}
        styles={{
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            fontFamily: "'JetBrains Mono', monospace",
            overflow: "auto !important",
          },
          ".cm-content": {
            padding: "20px 0",
          },
        }}
      />
    </div>
  </div>
</div>

<style>
  :global(.cm-editor) {
    height: 100% !important;
  }
  :global(.cm-gutters) {
    background-color: #21252b !important;
    border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
    color: rgba(255, 255, 255, 0.1) !important;
    padding-left: 10px !important;
  }

  /* Custom Scrollbar */
  :global(.cm-scroller::-webkit-scrollbar) {
    width: 8px;
  }
  :global(.cm-scroller::-webkit-scrollbar-track) {
    background: #21252b;
  }
  :global(.cm-scroller::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
</style>
