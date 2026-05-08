<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { schemaState } from "$lib/state.svelte";
  import { FileCode, ShieldCheck } from "lucide-svelte";
</script>

<div class="w-full h-full bg-[#282c34] flex flex-col overflow-hidden">
  <!-- Viewer Toolbar -->
  <div
    class="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#21252b] shrink-0"
  >
    <div class="flex items-center gap-3">
      <div class="p-2 bg-primary/10 rounded-lg">
        <FileCode class="w-4 h-4 text-primary" />
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

    <div
      class="flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-full border border-success/20"
    >
      <ShieldCheck class="w-3.5 h-3.5 text-success" />
      <span class="text-[9px] font-bold text-success uppercase tracking-wider"
        >Read Only Mode</span
      >
    </div>
  </div>

  <!-- Editor Container (Read Only) -->
  <div class="grow relative overflow-hidden bg-[#282c34]">
    <div class="absolute inset-0 overflow-auto scrollbar-hide">
      <CodeMirror
        value={schemaState.rawCode}
        readonly={true}
        lang={javascript({ typescript: true })}
        theme={oneDark}
        styles={{
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            fontFamily: "'Space Grotesk Variable', monospace",
            overflow: "auto !important",
          },
          ".cm-content": {
            padding: "20px 0",
          },
        }}
      />
    </div>
  </div>

  <!-- Footer Info -->
  <div
    class="p-3 bg-base-200/50 border-t border-white/5 flex items-center justify-between px-6 shrink-0"
  >
    <p class="text-[10px] text-white font-medium italic">
      To edit this code, use your external IDE or modify the diagram.
    </p>
    {#if !schemaState.isValid}
      <span class="text-[10px] font-bold text-error uppercase tracking-widest"
        >Parsing Error Detected</span
      >
    {/if}
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
