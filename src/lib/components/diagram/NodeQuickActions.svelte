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
    Plus,
    SlidersHorizontal,
    Trash2,
    Check,
    Focus,
    ExternalLink,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import { toast } from "svelte-sonner";

  const {
    nodeId,
    nodeType,
    selected = false,
    targetFile,
    line,
    onAddField,
  } = $props<{
    nodeId: string;
    nodeType: "table" | "do" | "kv" | "r2" | "identity";
    selected?: boolean;
    targetFile?: string;
    line?: number;
    onAddField?: () => void;
  }>();

  let copied = $state(false);

  function handleOpenEditor() {
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

  function handleDelete() {
    if (schemaState.isSandboxMode) {
      schemaState.deleteTable(nodeId);
      toast.success(`Deleted ${nodeId}`);
      return;
    }
    toast.info("Delete Code in Your Editor", {
      description: "To prevent accidental code loss, delete the declaration in your editor. Strata will update instantly.",
    });
  }
</script>

<NodeToolbar
  isVisible={selected}
  position={Position.Top}
  offset={10}
  align="center"
  class="z-50!"
>
  <div
    class="flex items-center gap-0.5 bg-base-100/95 backdrop-blur-md border border-base-300 shadow-xl px-1 py-0.5 rounded-xl text-base-content select-none animate-in fade-in zoom-in-95 duration-100"
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
        title="Provider Docs"
      >
        <ExternalLink class="w-3.5 h-3.5" />
      </button>
    {:else}
      <!-- Jump to Code in VS Code / Cursor -->
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-base-content hover:bg-base-200/80 transition-colors tooltip tooltip-bottom"
        data-tip="Open in Editor"
        onclick={handleOpenEditor}
        title="Open in Editor"
      >
        <FileCode class="w-3.5 h-3.5" />
      </button>
    {/if}

    <!-- Copy Code / Snippet -->
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-base-content hover:bg-base-200/80 transition-colors tooltip tooltip-bottom"
      data-tip={copied ? "Copied!" : "Copy Snippet"}
      onclick={handleCopySnippet}
      title="Copy Snippet"
    >
      {#if copied}
        <Check class="w-3.5 h-3.5 text-success" />
      {:else}
        <Copy class="w-3.5 h-3.5" />
      {/if}
    </button>

    <!-- Add Field (D1 Tables Only) -->
    {#if nodeType === "table" && onAddField}
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-primary hover:bg-primary/10 transition-colors tooltip tooltip-bottom"
        data-tip="Add Field"
        onclick={onAddField}
        title="Add Field"
      >
        <Plus class="w-3.5 h-3.5" />
      </button>
    {/if}

    <div class="w-px h-3 bg-base-300 mx-0.5"></div>

    <!-- Isolate / Focus Subgraph -->
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-square rounded-lg transition-colors tooltip tooltip-bottom {schemaState.isFocusLocked && schemaState.focusLockedNodeId === nodeId ? 'text-primary bg-primary/15' : 'text-base-content/75 hover:text-primary hover:bg-primary/10'}"
      data-tip={schemaState.isFocusLocked && schemaState.focusLockedNodeId === nodeId ? "Unlock Subgraph (F)" : "Isolate Subgraph (F)"}
      onclick={() => schemaState.toggleFocusLock(nodeId)}
      title="Isolate Subgraph (F)"
    >
      <Focus class="w-3.5 h-3.5" />
    </button>

    <!-- Focus Inspector Sidebar -->
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/75 hover:text-secondary hover:bg-secondary/10 transition-colors tooltip tooltip-bottom"
      data-tip="Inspect Node"
      onclick={handleInspect}
      title="Inspect Node"
    >
      <SlidersHorizontal class="w-3.5 h-3.5" />
    </button>

    <!-- Delete Entity (physical tables & storage only) -->
    {#if nodeType !== "identity"}
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/60 hover:text-error hover:bg-error/10 transition-colors tooltip tooltip-bottom"
        data-tip="Delete"
        onclick={handleDelete}
        title="Delete"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    {/if}
  </div>
</NodeToolbar>
