<!--
  DiagramCanvas.svelte

  Summary: Main Svelte Flow diagram editor canvas rendering tables, columns, relations, minimap, and controls.
  Expects: None (shares global schemaState).
  Output: Interactivity triggers for dragging, connection forging, and context menus.
-->
<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    ConnectionMode,
    useSvelteFlow,
  } from "@xyflow/svelte";
  import { schemaState } from "#lib/state";
  import TableNode from "#lib/components/diagram/TableNode.svelte";
  import IdentityNode from "#lib/components/diagram/IdentityNode.svelte";
  import DurableObjectNode from "#lib/components/diagram/DurableObjectNode.svelte";
  import KVNamespaceNode from "#lib/components/diagram/KVNamespaceNode.svelte";
  import R2BucketNode from "#lib/components/diagram/R2BucketNode.svelte";
  import RelationEdge from "#lib/components/diagram/RelationEdge.svelte";
  import ContextMenu from "#lib/components/diagram/ContextMenu.svelte";
  import { PlatformService } from "#lib/services/platform";
  import { toast } from "svelte-sonner";

  const { onconnect, onnodedragstop } = $props<{
    onconnect: (connection: any) => void;
    onnodedragstop: (event: any) => void;
  }>();

  const nodeTypes = {
    table: TableNode,
    identity: IdentityNode,
    do: DurableObjectNode,
    kv: KVNamespaceNode,
    r2: R2BucketNode,
  };

  const edgeTypes = {
    relation: RelationEdge,
  };

  const { fitView } = useSvelteFlow();

  let hasFitted = $state(false);
  let lastSessionKey = $state<string | null>(null);

  // Automatically fit all nodes into view whenever a schema or demo loads
  $effect(() => {
    const sessionKey =
      schemaState.filePath ||
      (schemaState.isSandboxMode
        ? schemaState.sandboxTemplateKey || "sandbox"
        : null);

    if (sessionKey !== lastSessionKey) {
      lastSessionKey = sessionKey;
      hasFitted = false;
    }

    if (schemaState.nodes.length === 0) {
      hasFitted = false;
    } else if (!hasFitted) {
      hasFitted = true;
      // Allow node components to mount and SvelteFlow to measure node dimensions
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300, maxZoom: 1 });
      }, 100);
    }
  });

  // Explicit fitView trigger (e.g. from Auto-Layout)
  $effect(() => {
    if (schemaState.fitViewTrigger > 0) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300, maxZoom: 1 });
      }, 60);
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable ||
      schemaState.showNewTableModal ||
      schemaState.showHelpModal ||
      schemaState.showProjectSettingsModal ||
      schemaState.showConfirmModal
    ) {
      return;
    }

    if (e.key === "f" || e.key === "F") {
      schemaState.toggleFocusLock();
      if (schemaState.isFocusLocked) {
        toast.info("Subgraph Focus Locked", {
          description: `Press [Esc] or click canvas background to release.`,
          duration: 2500,
        });
      }
    } else if (e.key === "Escape") {
      if (schemaState.isFocusLocked) {
        schemaState.clearFocusLock();
      }
    }
  }

  function isValidConnection(connection: any): boolean {
    if (!connection.source || !connection.target) return false;
    if (connection.source === connection.target) return false;

    const sourceNode = schemaState.nodes.find(
      (n) => n.id === connection.source,
    );
    const targetNode = schemaState.nodes.find(
      (n) => n.id === connection.target,
    );
    if (!sourceNode || !targetNode) return false;

    const sourceType =
      (sourceNode.data as any)?.target || sourceNode.type || "d1";
    const targetType =
      (targetNode.data as any)?.target || targetNode.type || "d1";

    // Disallow linking two external resources directly to each other (e.g. DO to R2, or KV to DO)
    if (sourceType !== "d1" && targetType !== "d1") {
      return false;
    }

    return true;
  }


  let contextMenu = $state<{
    x: number;
    y: number;
    type: "canvas" | "node";
    targetId?: string;
    nodeType?: string;
    nodeData?: any;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    type: "canvas",
    visible: false,
  });

  function handleNodeContextMenu(event: MouseEvent, node: any) {
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      type: "node",
      targetId: node.id,
      nodeType: node.type,
      nodeData: node.data,
      visible: true,
    };
  }

  function handlePaneContextMenu(event: MouseEvent) {
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      type: "canvas",
      visible: true,
    };
  }

  function handleContextMenuAction(action: string, targetId?: string) {
    if (action === "new_table") {
      schemaState.showNewTableModal = true;
    } else if (action === "fit_view") {
      fitView();
    } else if (action === "inspect_node" && targetId) {
      schemaState.activeInspectorNodeId = targetId;
      schemaState.nodes = schemaState.nodes.map((n) => ({
        ...n,
        selected: n.id === targetId,
      }));
    } else if (action === "copy_mirror_snippet" && targetId) {
      const node = schemaState.nodes.find((n) => n.id === targetId);
      const provider = (node?.data as any)?.provider;
      const isClerk = provider === "clerk";
      const mirrorName = isClerk ? "clerkUsers" : "workosUsers";
      const snippet = schemaState.getTableDefinitionSnippet(targetId);
      if (snippet) {
        PlatformService.writeClipboard(snippet).then((ok) => {
          if (ok) {
            toast.success(`Copied ${mirrorName} Schema Snippet`, {
              description: "Paste into your schema file in VS Code or Cursor.",
            });
          } else {
            toast.error("Failed to copy schema snippet to clipboard");
          }
        });
      }
    } else if (action === "open_blueprint_guide") {
      schemaState.openHelpTopic("identity-auth");
    } else if (action === "open_docs") {
      const provider = contextMenu.nodeData?.provider;
      const url =
        provider === "clerk"
          ? "https://clerk.com/docs/integrations/webhooks/sync-data"
          : "https://workos.com/docs/events";
      PlatformService.openExternal(url);
    } else if (
      (action === "inspect_node" || action === "add_field") &&
      targetId
    ) {
      schemaState.activeInspectorNodeId = targetId;
      schemaState.nodes = schemaState.nodes.map((n) => ({
        ...n,
        selected: n.id === targetId,
      }));
    } else if (action === "open_in_editor" && targetId) {
      const node = schemaState.nodes.find((n) => n.id === targetId);
      const targetFile =
        (node?.data as any)?.moduleInfo?.sourceFilePath ||
        schemaState.getTargetFilePath(targetId) ||
        schemaState.filePath;
      const line = (node?.data as any)?.line;
      if (targetFile) {
        PlatformService.openInEditor(targetFile, line);
      }
    } else if (action === "copy_drizzle_code" && targetId) {
      const snippet = schemaState.getTableDefinitionSnippet(targetId);
      if (snippet) {
        PlatformService.writeClipboard(snippet).then((ok) => {
          if (ok) {
            toast.success(`Copied "${targetId}" Drizzle Schema`, {
              description: "Paste directly into your schema file.",
            });
          } else {
            toast.error("Failed to copy schema to clipboard");
          }
        });
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
  class="w-full h-full bg-base-200/30 relative overflow-hidden {schemaState.isArrangingLayout
    ? 'is-arranging'
    : ''}"
>
  <SvelteFlow
    bind:nodes={schemaState.nodes}
    bind:edges={schemaState.edges}
    {nodeTypes}
    {edgeTypes}
    {isValidConnection}
    onreconnect={() => {}}
    {onnodedragstop}
    {onconnect}
    ondelete={({ nodes, edges }) => {
      if (schemaState.isSandboxMode) {
        for (const node of nodes) {
          schemaState.deleteTable(node.id);
        }
        for (const edge of edges) {
          schemaState.deleteRelation(edge.source, edge.target, edge.label);
        }
        return;
      }

      // In real disk mode, inform the user that domain code must be deleted intentionally in their editor
      if (nodes.length > 0) {
        toast.info("Delete Code in Your Editor", {
          description:
            "To prevent accidental code loss, delete the table declaration in your editor. Strata will update instantly.",
        });
      }
    }}
    onnodecontextmenu={(e) => {
      e.event.preventDefault();
      handleNodeContextMenu(e.event, e.node);
    }}
    onpanecontextmenu={(e) => {
      e.event.preventDefault();
      handlePaneContextMenu(e.event);
    }}
    onpaneclick={() => {
      schemaState.activeInspectorNodeId = null;
      if (schemaState.isFocusLocked) {
        schemaState.clearFocusLock();
      }
    }}
    connectionMode={ConnectionMode.Loose}
    fitView
    fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
    snapGrid={[15, 15]}
    colorMode="dark"
    minZoom={0.1}
    maxZoom={2}
    panOnScroll={true}
    zoomOnScroll={false}
    zoomOnPinch={true}
    panOnDrag={[1, 2]}
    zoomActivationKey="Control"
    onnodedrag={({ targetNode }) => {
      if (targetNode) {
        schemaState.activeCoordinates = {
          x: Math.round(targetNode.position.x),
          y: Math.round(targetNode.position.y),
        };
      }
    }}
    onselectionchange={({ nodes }: { nodes: any[] }) => {
      const selected = nodes.find((n) => n.selected);
      if (selected) {
        schemaState.activeCoordinates = {
          x: Math.round(selected.position.x),
          y: Math.round(selected.position.y),
        };
      } else {
        schemaState.activeCoordinates = null;
      }
    }}
  >


    <Controls
      position="bottom-left"
      class="bg-base-100! border-base-300! shadow-lg! rounded-xl! overflow-hidden"
    />
    <Background
      bgColor="#282c34"
      patternColor="oklch(var(--bc) / 0.08)"
      gap={20}
    />
    <MiniMap
      position="bottom-right"
      class="bg-base-100! border-base-300! shadow-lg! rounded-xl!"
    />
  </SvelteFlow>

  {#if schemaState.isFocusLocked}
    <div
      class="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-base-100/90 backdrop-blur-md border border-primary/40 px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs select-none animate-in fade-in zoom-in-95 duration-200"
    >
      <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
      <span class="font-semibold text-base-content/90">
        Focus Mode: <span class="font-bold text-primary">{schemaState.focusLockedNodeId}</span>
        <span class="opacity-60 text-[11px]">({schemaState.highlightGraph.connectedCount} connected)</span>
      </span>

      <div class="h-3 w-px bg-base-300"></div>

      <!-- 1-hop vs 2-hop toggle -->
      <button
        type="button"
        class="badge badge-sm font-mono text-[9px] transition-all cursor-pointer {schemaState.highlightMode === 'transitive' ? 'badge-primary font-bold' : 'badge-ghost border-base-300'}"
        onclick={() => {
          schemaState.highlightMode = schemaState.highlightMode === 'direct' ? 'transitive' : 'direct';
        }}
        title="Toggle 2-hop transitive graph expansion"
      >
        {schemaState.highlightMode === 'transitive' ? '2-Hop Subgraph' : 'Direct Only'}
      </button>

      <button
        type="button"
        class="badge badge-sm badge-ghost border-base-300 hover:border-error hover:bg-error/10 hover:text-error text-[10px] font-mono transition-colors cursor-pointer"
        onclick={() => schemaState.clearFocusLock()}
      >
        Esc to exit
      </button>
    </div>
  {/if}

  {#if contextMenu.visible}
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      type={contextMenu.type}
      targetId={contextMenu.targetId}
      nodeType={contextMenu.nodeType}
      nodeData={contextMenu.nodeData}
      onClose={() => (contextMenu.visible = false)}
      onAction={handleContextMenuAction}
    />
  {/if}
</div>

<style>
  :global(.svelte-flow) {
    --bg-color: transparent;
    --text-color: var(--color-base-content, #fff);
    --node-border-radius: 12px;
    --node-box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  :global(.is-arranging .svelte-flow__node) {
    transition: transform 350ms cubic-bezier(0.2, 0, 0, 1) !important;
  }

  :global(.svelte-flow__controls button) {
    border-color: var(--color-base-300);
    fill: currentColor;
    transition-property: color, background-color, border-color;
    transition-duration: 150ms;
  }

  :global(.svelte-flow__controls button:hover) {
    background-color: var(--color-base-200);
  }

  :global(.svelte-flow__minimap) {
    border-color: var(--color-base-300);
    background-color: color-mix(
      in oklab,
      var(--color-base-100) 80%,
      transparent
    );
    backdrop-filter: blur(12px);
  }
</style>
