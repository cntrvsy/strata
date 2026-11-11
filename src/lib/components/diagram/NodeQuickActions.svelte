<!--
  NodeQuickActions.svelte

  Summary: Floating on-canvas micro-actions toolbar rendering directly above the active selected node.
  Expects: Svelte Flow node props (id, selected, type, data).
  Output: Minimalist, icon-only micro-toolbar with zero emojis and clean tooltips.
-->
<script lang="ts">
  import { NodeToolbar, Position } from "@xyflow/svelte";
  import {
    FileCode,
    Copy,
    Check,
    Focus,
    ExternalLink,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import { toast } from "svelte-sonner";

  interface NodeQuickActionsProps {
    nodeId: string;
    nodeType: "table" | "do" | "kv" | "r2" | "identity";
    selected?: boolean;
    targetFile?: string | null;
    line?: number;
  }

  const {
    nodeId,
    nodeType,
    selected = false,
    targetFile,
    line,
  }: NodeQuickActionsProps = $props();

  let copied = $state(false);

  function handleOpenEditor() {
    if (schemaState.isSandboxMode) {
      handleInspect();
      toast.info("Sandbox Mode Active", {
        description: `Inspecting "${nodeId}". Open a schema file on disk to jump straight to source code.`,
      });
      return;
    }
    const file =
      targetFile ||
      schemaState.getTargetFilePath(nodeId) ||
      schemaState.filePath;
    if (file) {
      PlatformService.openInEditor(file, line);
    } else {
      toast.info("No source file associated with this entity.");
    }
  }

  function handleOpenDocs() {
    const url = nodeId.includes("workos")
      ? "https://workos.com/docs/events"
      : "https://clerk.com/docs/integrations/webhooks/sync-data";
    PlatformService.openExternal(url);
  }

  async function handleCopySnippet() {
    try {
      const snippet = schemaState.getTableDefinitionSnippet(nodeId);
      if (!snippet) {
        toast.error(`Snippet unavailable for "${nodeId}"`);
        return;
      }

      const ok = await PlatformService.writeClipboard(snippet);
      if (!ok) {
        toast.error("Failed to copy snippet to clipboard");
        return;
      }

      copied = true;
      toast.success(`Copied "${nodeId}" snippet`, {
        description: "Ready to paste into your codebase.",
      });
      setTimeout(() => (copied = false), 1500);
    } catch (err) {
      console.error("Failed to copy snippet:", err);
      toast.error("Failed to copy snippet to clipboard");
    }
  }

  function handleInspect() {
    schemaState.activeInspectorNodeId = nodeId;
    schemaState.nodes = schemaState.nodes.map((n) => ({
      ...n,
      selected: n.id === nodeId,
    }));
  }
</script>

{#if selected}
  <NodeToolbar
    isVisible={selected}
    position={Position.Top}
    offset={10}
    align="center"
    class="z-50!"
  >
    <div
      class="flex items-center gap-0.5 bg-base-100/95 border border-base-300 shadow-xl px-1 py-0.5 rounded-xl text-base-content select-none animate-in fade-in zoom-in-95 duration-100"
      role="toolbar"
      aria-label="Node quick actions"
    >
      {#if nodeType === "identity"}
        <!-- Provider External Documentation -->
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-info hover:bg-info/10 transition-colors tooltip tooltip-bottom"
          data-tip="Provider Docs"
          onclick={handleOpenDocs}
          aria-label="Provider Docs"
        >
          <ExternalLink class="w-3.5 h-3.5" />
        </button>
      {:else}
        <!-- Jump to Code in VS Code / Cursor or Inspect in Sandbox -->
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-base-content hover:bg-base-200/80 transition-colors tooltip tooltip-bottom"
          data-tip={schemaState.isSandboxMode
            ? "Inspect Code (E)"
            : "Open in Editor (E)"}
          onclick={handleOpenEditor}
          aria-label={schemaState.isSandboxMode
            ? "Inspect Code (E)"
            : "Open in Editor (E)"}
        >
          <FileCode class="w-3.5 h-3.5" />
        </button>
      {/if}

      <!-- Copy Code / Snippet -->
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-base-content hover:bg-base-200/80 transition-colors tooltip tooltip-bottom"
        data-tip={copied ? "Copied!" : "Copy Snippet (C)"}
        onclick={handleCopySnippet}
        aria-label="Copy Snippet (C)"
      >
        {#if copied}
          <Check class="w-3.5 h-3.5 text-success" />
        {:else}
          <Copy class="w-3.5 h-3.5" />
        {/if}
      </button>

      <!-- Isolate / Focus Subgraph -->
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square rounded-lg transition-colors tooltip tooltip-bottom {schemaState.isFocusLocked &&
        schemaState.focusLockedNodeId === nodeId
          ? 'text-primary bg-primary/15'
          : 'text-base-content/75 hover:text-primary hover:bg-primary/10'}"
        data-tip={schemaState.isFocusLocked &&
        schemaState.focusLockedNodeId === nodeId
          ? "Unlock Subgraph (F)"
          : "Isolate Subgraph (F)"}
        onclick={() => schemaState.toggleFocusLock(nodeId)}
        aria-label="Isolate Subgraph (F)"
      >
        <Focus class="w-3.5 h-3.5" />
      </button>
    </div>
  </NodeToolbar>
{/if}
