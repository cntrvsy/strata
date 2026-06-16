<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    ConnectionMode,
    useSvelteFlow,
  } from "@xyflow/svelte";
  import { schemaState } from "$lib/state.svelte";
  import TableNode from "$lib/components/TableNode.svelte";
  import RelationEdge from "$lib/components/RelationEdge.svelte";
  import ContextMenu from "$lib/components/ContextMenu.svelte";

  const { onconnect, onnodedragstop } = $props<{
    onconnect: (connection: any) => void;
    onnodedragstop: (event: any) => void;
  }>();

  const nodeTypes = {
    table: TableNode,
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
    } else if (action === "add_field" && targetId) {
      schemaState.activeInspectorNodeId = targetId;
      schemaState.nodes = schemaState.nodes.map(n => ({
        ...n,
        selected: n.id === targetId
      }));
    } else if (action === "rename_table" && targetId) {
      const newName = prompt("Enter new name for the entity:", targetId);
      if (newName && newName !== targetId) {
        schemaState.renameTable(targetId, newName);
      }
    } else if (action === "delete_table" && targetId) {
      if (confirm(`Are you sure you want to delete the entity "${targetId}"?`)) {
        schemaState.deleteTable(targetId);
      }
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
    colorMode="light"
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
    <Background patternColor="oklch(var(--p) / 0.1)" gap={24} />
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
      onClose={() => (contextMenu.visible = false)}
      onAction={handleContextMenuAction}
    />
  {/if}
</div>

<style>
  @reference "../../routes/layout.css";

  :global(.svelte-flow) {
    --bg-color: transparent;
    --text-color: oklch(var(--bc));
    --node-border-radius: 12px;
    --node-box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  :global(.svelte-flow__controls button) {
    @apply border-base-300 hover:bg-base-200 transition-colors;
    fill: currentColor;
  }

  :global(.svelte-flow__minimap) {
    @apply border-base-300 bg-base-100/80 backdrop-blur-md;
  }
</style>
