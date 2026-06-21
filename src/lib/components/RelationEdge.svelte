<script lang="ts">
  /**
   * RelationEdge.svelte
   *
   * A custom edge component for Svelte Flow that renders relationships between tables.
   * Supports two styles:
   * - Solid: Physical Foreign Key relationships.
   * - Dashed (Animated): Logical Drizzle relations() or synthetic relationships.
   */
  import {
    BaseEdge,
    EdgeLabel,
    getBezierPath,
    getSmoothStepPath,
    type EdgeProps,
  } from "@xyflow/svelte";
  import { schemaState } from "$lib/state.svelte";

  let {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    label,
    labelStyle,
    style,
    data,
    markerStart,
    markerEnd,
  }: EdgeProps = $props();

  const activeNodeId = $derived(schemaState.hoveredNodeId || schemaState.nodes.find(n => n.selected)?.id || null);
  const isEdgeRelated = $derived(!activeNodeId || source === activeNodeId || target === activeNodeId);

  // Choose path algorithm based on virtual/physical status
  const [edgePath, labelX, labelY] = $derived.by(() => {
    const params = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    return data?.isVirtual ? getBezierPath(params) : getSmoothStepPath(params);
  });

  // Nudge the label 40% closer to the source node
  const finalX = $derived(labelX + (sourceX - labelX) * 0.4);
  const finalY = $derived(labelY + (sourceY - labelY) * 0.4);
</script>

<BaseEdge 
  {id} 
  path={edgePath} 
  style={isEdgeRelated ? style : (style ? style + '; opacity: 0.05;' : 'opacity: 0.05;')} 
  {markerStart} 
  markerEnd={isEdgeRelated ? markerEnd : undefined} 
/>

{#if label && isEdgeRelated}
  {@const card = data?.cardinality && data.cardinality !== 'unknown' ? data.cardinality : (data?.isVirtual ? 'unknown' : 'FK')}
  <EdgeLabel x={finalX} y={finalY}>
    <div
      class="flex items-center gap-1.5 bg-base-100 border border-base-300 px-2 py-0.5 rounded-lg select-none text-[10px] font-bold tracking-tight text-base-content/85 whitespace-nowrap shadow-sm"
      style={labelStyle}
    >
      <span class="text-[8px] font-black font-mono bg-base-200 text-base-content/60 px-1 py-0.2 rounded leading-none">{card}</span>
      <span>{label}</span>
    </div>
  </EdgeLabel>
{/if}
