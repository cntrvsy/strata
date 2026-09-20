<!--
  RelationEdge.svelte

  Summary: Custom Svelte Flow edge renderer showing physical or logical relationship connection lines.
  Expects: Svelte Flow edge layout properties (id, sourceX, sourceY, targetX, targetY, style, markerEnd, etc.).
  Output: SVG path rendering relationship lines.
-->
<script lang="ts">
  import {
    BaseEdge,
    EdgeLabel,
    getBezierPath,
    getSmoothStepPath,
    type EdgeProps,
  } from "@xyflow/svelte";
  import { schemaState } from "#lib/state";

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

  const activeNodeId = $derived(
    schemaState.hoveredNodeId ||
      schemaState.nodes.find((n) => n.selected)?.id ||
      null,
  );
  const isEdgeRelated = $derived(
    !activeNodeId || source === activeNodeId || target === activeNodeId,
  );

  // Choose path algorithm based on connection primitive:
  // Cloudflare Service Topology Links use curved Bezier pipelines;
  // Table-to-Table ERD connections use orthogonal SmoothStep paths.
  const [edgePath, labelX, labelY] = $derived.by(() => {
    const params = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    };

    const isTopology = data?.isSynthetic || data?.isIdentityBoundary;
    return isTopology ? getBezierPath(params) : getSmoothStepPath(params);
  });

  // Nudge the label 40% closer to the source node
  const finalX = $derived(labelX + (sourceX - labelX) * 0.4);
  const finalY = $derived(labelY + (sourceY - labelY) * 0.4);
</script>

<BaseEdge
  {id}
  path={edgePath}
  style={isEdgeRelated
    ? style
    : style
      ? style + "; opacity: 0.05;"
      : "opacity: 0.05;"}
  {markerStart}
  markerEnd={isEdgeRelated ? markerEnd : undefined}
/>

{#if label && isEdgeRelated}
  {@const isTopology = data?.isSynthetic || data?.isIdentityBoundary}
  {@const isPhysical = data?.isPhysical || (!data?.isVirtual && !isTopology)}
  {@const card = isTopology
    ? "TOPOLOGY"
    : data?.cardinality && data.cardinality !== "unknown"
      ? data.isVirtual
        ? `${data.cardinality} (Virtual)`
        : data.cardinality
      : isPhysical
        ? "FK"
        : "VIRTUAL"}
  {@const labelText = typeof label === "string" ? label : ""}
  {@const tooltip =
    typeof data?.description === "string" && data.description
      ? data.description
      : isPhysical
        ? `Physical FK: ${labelText}`
        : `Relation: ${labelText}`}
  <EdgeLabel x={finalX} y={finalY}>
    <div
      class="flex items-center gap-1.5 bg-base-100/95 backdrop-blur-xs border border-base-300 px-2 py-0.5 rounded-lg select-none text-[10px] font-bold tracking-tight text-base-content/85 whitespace-nowrap shadow-xs hover:border-primary/50 transition-all cursor-default group/edge"
      style={typeof labelStyle === "string" ? labelStyle : undefined}
      title={tooltip}
    >
      <span
        class="text-[8px] font-black font-mono px-1 py-0.2 rounded leading-none {isTopology
          ? 'bg-accent/15 text-accent border border-accent/20'
          : isPhysical
            ? 'bg-primary/15 text-primary border border-primary/20'
            : 'bg-secondary/15 text-secondary border border-secondary/20'}"
        >{card}</span
      >
      <span class="truncate max-w-35">{labelText}</span>
    </div>
  </EdgeLabel>
{/if}
