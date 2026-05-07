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

  let {
    id,
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
  }: EdgeProps = $props();

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

<BaseEdge {id} path={edgePath} {style} />

{#if label}
  <EdgeLabel x={finalX} y={finalY}>
    <div
      class="bg-base-100/95 border border-base-500 px-2 py-1 rounded-lg backdrop-blur-md select-none text-[10px] font-bold tracking-tight text-base-content/80 whitespace-nowrap"
      style={labelStyle}
    >
      {label}
    </div>
  </EdgeLabel>
{/if}
