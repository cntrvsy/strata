<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    ConnectionMode,
  } from "@xyflow/svelte";
  import { schemaState } from "$lib/state.svelte";
  import TableNode from "$lib/components/TableNode.svelte";
  import RelationEdge from "$lib/components/RelationEdge.svelte";

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
</script>

<div class="w-full h-full bg-base-200/30">
  <SvelteFlow
    bind:nodes={schemaState.nodes}
    bind:edges={schemaState.edges}
    {nodeTypes}
    {edgeTypes}
    onreconnect={() => {}}
    {onnodedragstop}
    {onconnect}
    connectionMode={ConnectionMode.Loose}
    fitView
    fitViewOptions={{ padding: 0.5 }}
    initialViewport={{ x: 0, y: 0, zoom: 0.5 }}
    snapGrid={[15, 15]}
    colorMode="light"
    minZoom={0.1}
    maxZoom={2}
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
</div>

<style>
  @reference "../../routes/layout.css";

  :global(.svelte-flow) {
    --bg-color: transparent;
    --text-color: oklch(var(--bc));
    --node-border-radius: 12px;
    --node-box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  :global(.svelte-flow__controls button) {
    @apply border-base-300 hover:bg-base-200 transition-colors;
    fill: currentColor;
  }

  :global(.svelte-flow__minimap) {
    @apply border-base-300 bg-base-100/80 backdrop-blur-md;
  }
</style>
