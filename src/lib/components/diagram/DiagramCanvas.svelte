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
  import RelationEdge from "#lib/components/diagram/RelationEdge.svelte";
  import ContextMenu from "#lib/components/diagram/ContextMenu.svelte";
  import { PlatformService } from "#lib/services/platform";

  const { onconnect, onnodedragstop } = $props<{
    onconnect: (connection: any) => void;
    onnodedragstop: (event: any) => void;
  }>();

  const nodeTypes = {
    table: TableNode,
    identity: IdentityNode,
  };

  const edgeTypes = {
    relation: RelationEdge,
  };

  const { fitView } = useSvelteFlow();

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
      schemaState.nodes = schemaState.nodes.map(n => ({
        ...n,
        selected: n.id === targetId
      }));
    } else if (action === "scaffold_mirror" && targetId) {
      const node = schemaState.nodes.find(n => n.id === targetId);
      const provider = (node?.data as any)?.provider;
      if (provider) {
        schemaState.scaffoldWebhookMirror(provider);
      }
    } else if (action === "open_docs") {
      const provider = contextMenu.nodeData?.provider;
      const url = provider === 'clerk'
        ? "https://clerk.com/docs/integrations/webhooks/sync-data"
        : "https://workos.com/docs/events";
      PlatformService.openExternal(url);
    } else if (action === "add_field" && targetId) {
      schemaState.activeInspectorNodeId = targetId;
      schemaState.nodes = schemaState.nodes.map(n => ({
        ...n,
        selected: n.id === targetId
      }));
    } else if (action === "rename_table" && targetId) {
      schemaState.promptRenameEntity(targetId);
    } else if (action === "delete_table" && targetId) {
      schemaState.promptConfirm({
        title: "Delete Entity",
        message: `Are you sure you want to delete entity "${targetId}" from your schema? This will remove its column definitions and relationship declarations.`,
        confirmLabel: "Delete Entity",
        isDanger: true,
        onConfirm: () => schemaState.deleteTable(targetId),
      });
    }
  }
</script>

<div class="w-full h-full bg-base-200/30 relative overflow-hidden">
  <SvelteFlow
    bind:nodes={schemaState.nodes}
    bind:edges={schemaState.edges}
    {nodeTypes}
    {edgeTypes}
    onreconnect={() => {}}
    {onnodedragstop}
    {onconnect}
    ondelete={({ nodes, edges }) => {
      for (const node of nodes) {
        schemaState.deleteTable(node.id);
      }
      for (const edge of edges) {
        schemaState.deleteRelation(edge.source, edge.target, edge.label);
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
    }}
    connectionMode={ConnectionMode.Loose}
    fitView
    fitViewOptions={{ padding: 0.5 }}
    initialViewport={{ x: 0, y: 0, zoom: 0.5 }}
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
        schemaState.activeCoordinates = { x: Math.round(targetNode.position.x), y: Math.round(targetNode.position.y) };
      }
    }}
    onselectionchange={({ nodes }: { nodes: any[] }) => {
      const selected = nodes.find(n => n.selected);
      if (selected) {
        schemaState.activeCoordinates = { x: Math.round(selected.position.x), y: Math.round(selected.position.y) };
      } else {
        schemaState.activeCoordinates = null;
      }
    }}
  >
    <Controls
      position="bottom-left"
      class="bg-base-100! border-base-300! shadow-lg! rounded-xl! overflow-hidden"
    />
    <Background bgColor="#282c34" patternColor="oklch(var(--bc) / 0.08)" gap={20} />
    <MiniMap
      position="bottom-right"
      class="bg-base-100! border-base-300! shadow-lg! rounded-xl!"
    />
  </SvelteFlow>

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
    background-color: color-mix(in oklab, var(--color-base-100) 80%, transparent);
    backdrop-filter: blur(12px);
  }
</style>
