<!--
  CodeViewerModal.svelte

  Summary: Dedicated CodeMirror viewer modal allowing developers to inspect and copy
  the real-time generated Drizzle TypeScript schema, wrangler.jsonc bindings, and configs.
  Expects: None (reads from schemaState).
  Output: Clipboard copy actions and shortcut to project export.
-->
<script lang="ts">
  import { X, Copy, Check, FileCode } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { schemaState } from "#lib/state";
  import {
    generateWranglerConfig,
    generateDrizzleConfig,
    generatePackageJson,
    generateWorkerEntrypoint,
    generateTsConfig
  } from "#lib/services/projectBootstrap";
  import { EditorView, basicSetup } from "codemirror";
  import { javascript } from "@codemirror/lang-javascript";
  import { oneDark } from "@codemirror/theme-one-dark";

  type TabKey = "schema" | "index" | "wrangler" | "drizzle" | "package" | "tsconfig";
  let activeTab = $state<TabKey>("schema");
  let hasCopied = $state(false);
  let editorContainer: HTMLElement | null = $state(null);
  let editorView: EditorView | null = null;

  const projectName = $derived(schemaState.suggestedProjectName);
  const schemaCode = $derived(schemaState.rawCode);
  const indexCode = $derived(generateWorkerEntrypoint(projectName, schemaState.nodes, schemaState.rawCode));
  const wranglerCode = $derived(generateWranglerConfig(schemaState.nodes, projectName));
  const drizzleCode = $derived(generateDrizzleConfig(projectName, "./src/schema.ts"));
  const packageCode = $derived(generatePackageJson(projectName, schemaState.nodes, schemaState.rawCode));
  const tsconfigCode = $derived(generateTsConfig());

  const currentCode = $derived.by(() => {
    switch (activeTab) {
      case "schema": return schemaCode;
      case "index": return indexCode;
      case "wrangler": return wranglerCode;
      case "drizzle": return drizzleCode;
      case "package": return packageCode;
      case "tsconfig": return tsconfigCode;
    }
  });

  function close() {
    schemaState.showCodeViewerModal = false;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentCode);
      hasCopied = true;
      setTimeout(() => {
        hasCopied = false;
      }, 2000);
    } catch (e) {
      console.error("Failed to copy code:", e);
    }
  }

  // Effect to update or initialize CodeMirror
  $effect(() => {
    if (!schemaState.showCodeViewerModal) {
      if (editorView) {
        editorView.destroy();
        editorView = null;
      }
      return;
    }

    if (editorContainer && !editorView) {
      editorView = new EditorView({
        doc: currentCode,
        extensions: [
          basicSetup,
          javascript({ typescript: true }),
          oneDark,
          EditorView.editable.of(false),
          EditorView.theme({
            "&": { height: "100%", fontSize: "12px", fontFamily: "var(--font-mono, monospace)" },
            ".cm-scroller": { overflow: "auto" }
          })
        ],
        parent: editorContainer
      });
    } else if (editorView) {
      const currentDoc = editorView.state.doc.toString();
      if (currentDoc !== currentCode) {
        editorView.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: currentCode }
        });
      }
    }
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && schemaState.showCodeViewerModal) {
      close();
    }
  }}
/>

{#if schemaState.showCodeViewerModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-neutral/60 backdrop-blur-md animate-in fade-in duration-150"
    onclick={(e) => e.target === e.currentTarget && close()}
    role="dialog"
    aria-modal="true"
    data-testid="code-viewer-modal"
  >
    <div
      class="bg-base-100 border border-base-300/90 rounded-box shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden"
      in:scale={{ duration: 140, start: 0.98, easing: cubicOut }}
      out:scale={{ duration: 100, start: 0.98 }}
    >
      <!-- Modal Header -->
      <div class="px-5 py-3.5 bg-base-200/60 border-b border-base-300/80 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-primary/10 rounded-field text-primary">
            <FileCode class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-base-content leading-tight">
              Schema & Architecture Code
            </h3>
            <span class="text-[10px] text-base-content/60 font-medium">
              Live generated Drizzle ORM and Cloudflare configuration for <code class="text-primary font-mono font-semibold">{projectName}</code>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Copy Button -->
          <button
            class="btn btn-sm btn-ghost gap-1.5 rounded-field font-semibold text-xs h-8 min-h-0 px-3 hover:bg-base-200"
            onclick={handleCopy}
            title="Copy current file code to clipboard"
          >
            {#if hasCopied}
              <Check class="w-3.5 h-3.5 text-success" />
              <span class="text-success">Copied!</span>
            {:else}
              <Copy class="w-3.5 h-3.5 opacity-70" />
              <span>Copy Code</span>
            {/if}
          </button>

          <div class="h-4 w-px bg-base-300/80 mx-1"></div>

          <!-- Close Button -->
          <button
            class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200"
            onclick={close}
            title="Close dialog"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Segmented Tab Navigation -->
      <div class="px-5 py-2 bg-[#21252b] border-b border-white/5 flex items-center justify-between shrink-0 overflow-x-auto">
        <div role="tablist" class="flex items-center gap-1 shrink-0">
          <button
            role="tab"
            class="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors flex items-center gap-1.5 {activeTab === 'schema' ? 'bg-[#282c34] text-white shadow-xs' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}"
            onclick={() => (activeTab = "schema")}
          >
            <span>schema.ts</span>
            <span class="badge badge-xs badge-primary badge-outline text-[9px] scale-90">Drizzle D1</span>
          </button>

          <button
            role="tab"
            class="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors flex items-center gap-1.5 {activeTab === 'index' ? 'bg-[#282c34] text-white shadow-xs' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}"
            onclick={() => (activeTab = "index")}
          >
            <span>src/index.ts</span>
            <span class="badge badge-xs badge-info badge-outline text-[9px] scale-90">Worker</span>
          </button>

          <button
            role="tab"
            class="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors flex items-center gap-1.5 {activeTab === 'wrangler' ? 'bg-[#282c34] text-white shadow-xs' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}"
            onclick={() => (activeTab = "wrangler")}
          >
            <span>wrangler.jsonc</span>
            <span class="badge badge-xs badge-warning badge-outline text-[9px] scale-90">Cloudflare</span>
          </button>

          <button
            role="tab"
            class="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors flex items-center gap-1.5 {activeTab === 'drizzle' ? 'bg-[#282c34] text-white shadow-xs' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}"
            onclick={() => (activeTab = "drizzle")}
          >
            <span>drizzle.config.ts</span>
          </button>

          <button
            role="tab"
            class="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors flex items-center gap-1.5 {activeTab === 'package' ? 'bg-[#282c34] text-white shadow-xs' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}"
            onclick={() => (activeTab = "package")}
          >
            <span>package.json</span>
          </button>

          <button
            role="tab"
            class="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors flex items-center gap-1.5 {activeTab === 'tsconfig' ? 'bg-[#282c34] text-white shadow-xs' : 'text-white/60 hover:text-white/90 hover:bg-white/5'}"
            onclick={() => (activeTab = "tsconfig")}
          >
            <span>tsconfig.json</span>
          </button>
        </div>

        <div class="text-[11px] font-mono text-white/40 ml-4 shrink-0">
          {schemaState.nodes.length} canvas {schemaState.nodes.length === 1 ? 'entity' : 'entities'}
        </div>
      </div>

      <!-- Main Code Editor Container -->
      <div class="flex-1 relative overflow-hidden bg-[#282c34]">
        <div bind:this={editorContainer} class="w-full h-full overflow-hidden"></div>
      </div>

      <!-- Footer Info -->
      <div class="px-5 py-2.5 bg-base-200/50 border-t border-base-300/80 flex items-center justify-between text-xs text-base-content/65 shrink-0">
        <div class="flex items-center gap-2 font-medium">
          <span class="status status-xs status-success"></span>
          <span>Zero lock-in: Standard, production Drizzle ORM TypeScript</span>
        </div>
        <div class="flex items-center gap-3 text-[11px]">
          <span>Read-only preview</span>
          <span>•</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  </div>
{/if}
