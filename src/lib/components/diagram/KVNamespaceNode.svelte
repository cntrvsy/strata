<!--
  KVNamespaceNode.svelte

  Summary: Svelte Flow custom node rendering a Cloudflare Workers KV Cache Dictionary card.
  Expects: Svelte Flow node props (id, data, selected, dragging).
  Output: Visual Cache card with key prefixes/patterns, value types, TTL badges, and boundary handles.
-->
<script lang="ts">
  import { Handle, Position, useUpdateNodeInternals } from "@xyflow/svelte";
  import { tick } from "svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import NodeQuickActions from "./NodeQuickActions.svelte";
  import {
    Zap,
    KeyRound,
    Clock,
    Layers,
    Terminal,
    Folder,
    CircleX,
    TriangleAlert,
  } from "lucide-svelte";

  const { data, selected, dragging } = $props<{
    data: {
      label: string;
      columns?: Array<{
        name: string;
        definition: string;
        ttl?: number;
        metadata?: string;
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      patterns?: Array<{
        name: string;
        definition: string;
        ttl?: number;
        metadata?: string;
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      target?: "d1" | "do" | "kv" | "r2";
      isExternal?: boolean;
      strata?: {
        schema?: Record<string, any>;
        x?: number;
        y?: number;
        [key: string]: any;
      };
      moduleInfo?: {
        sourceFilePath: string;
        moduleName: string;
        isRootFile: boolean;
      };
      line?: number;
    };
    selected?: boolean;
    dragging?: boolean;
  }>();

  const isMatch = $derived(
    !schemaState.activeFilter || schemaState.activeFilter === "kv",
  );

  const activeNodeId = $derived(
    schemaState.hoveredNodeId ||
      schemaState.nodes.find((n) => n.selected)?.id ||
      null,
  );

  const isRelated = $derived(
    !activeNodeId ||
      data.label === activeNodeId ||
      schemaState.edges.some(
        (e) =>
          (e.source === data.label && e.target === activeNodeId) ||
          (e.source === activeNodeId && e.target === data.label),
      ),
  );

  const opacityClass = $derived(
    !isMatch
      ? "opacity-30 pointer-events-none"
      : isRelated
        ? "opacity-100 scale-100"
        : "opacity-20 scale-98",
  );

  const patternsToDisplay = $derived(
    data.patterns || data.columns || [],
  );

  const nodeAuditIssues = $derived(
    schemaState.auditIssues.filter((i) => i.symbolName === data.label),
  );
  const hasAuditError = $derived(
    nodeAuditIssues.some(
      (i) => i.severity === "error" || i.severity === "critical",
    ),
  );
  const hasAuditWarning = $derived(
    nodeAuditIssues.some((i) => i.severity === "warning"),
  );

  function handleOpenEditor() {
    schemaState.activeInspectorNodeId = data.label;
    const targetFile =
      data.moduleInfo?.sourceFilePath ||
      schemaState.getTargetFilePath(data.label) ||
      schemaState.filePath;
    const line = data.line;
    if (targetFile) {
      PlatformService.openInEditor(targetFile, line);
    }
  }

  const updateNodeInternals = useUpdateNodeInternals();
  $effect(() => {
    const _p = patternsToDisplay.length;
    tick().then(() => {
      updateNodeInternals(data.label);
    });
  });
</script>

<NodeQuickActions
  nodeId={data.label}
  nodeType="kv"
  {selected}
  targetFile={data.moduleInfo?.sourceFilePath || schemaState.getTargetFilePath(data.label) || schemaState.filePath}
  line={data.line}
/>

<div
  class="relative group/node min-w-60 max-w-80 transition-all duration-300 {opacityClass}"
  data-testid="kv-node"
  data-node-name={data.label}
  role="button"
  tabindex="0"
  onmouseenter={() => (schemaState.hoveredNodeId = data.label)}
  onmouseleave={() => {
    if (schemaState.hoveredNodeId === data.label)
      schemaState.hoveredNodeId = null;
  }}
  ondblclick={handleOpenEditor}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      schemaState.activeInspectorNodeId = data.label;
    }
  }}
>
  <div
    class="bg-base-100 border rounded-box overflow-hidden transition-all duration-200 border-t-4 border-t-warning {selected
      ? 'border-warning ring-2 ring-warning/30'
      : 'border-base-300 hover:border-warning/50'} {dragging
      ? 'shadow-2xl scale-[1.02]'
      : 'shadow-md'}"
  >
    <!-- Header -->
    <div
      class="bg-base-200/90 px-4 py-3 border-b border-base-300 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <div
          class="p-1.5 bg-warning/10 rounded-field group-hover/node:bg-warning/20 transition-colors"
        >
          <Zap class="w-4 h-4 text-warning" />
        </div>
        <span class="font-bold text-xs tracking-wide uppercase">{data.label}</span>
        {#if data.moduleInfo && !data.moduleInfo.isRootFile}
          <span
            class="badge badge-sm badge-ghost border-base-300/80 font-mono text-[9px] text-base-content/70 px-1.5 py-0.5 rounded flex items-center gap-1"
            title={`Defined in ${data.moduleInfo.sourceFilePath}`}
          >
            <Folder class="w-3 h-3" />
            {data.moduleInfo.moduleName}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-1.5">
        {#if hasAuditError}
          <div
            class="badge badge-error badge-xs font-bold gap-0.5 text-[8px] cursor-help"
            title={nodeAuditIssues[0]?.message || "JSDoc Audit Error"}
          >
            <CircleX class="w-3.5 h-3.5" />
            Issue
          </div>
        {:else if hasAuditWarning}
          <div
            class="badge badge-warning badge-xs font-bold gap-0.5 text-[8px] cursor-help"
            title={nodeAuditIssues[0]?.message || "JSDoc Audit Warning"}
          >
            <TriangleAlert class="w-3.5 h-3.5" />
            Issue
          </div>
        {/if}
        <div
          class="badge badge-xs bg-warning/10 text-warning border border-warning/30 font-mono text-[9px] font-bold"
          title="Cloudflare Workers KV Namespace"
        >
          KV Namespace
        </div>
      </div>
    </div>

    <!-- Real Cloudflare Namespace ID Badge if present from Wrangler -->
    {#if data.strata?.id}
      <div
        class="px-3 py-1 bg-base-200/40 border-b border-base-300/60 flex items-center justify-between text-[10px] font-mono text-base-content/70"
      >
        <span class="opacity-50 text-[9px] uppercase font-bold tracking-wider">ID</span>
        <span class="truncate max-w-42 text-[9.5px]" title={data.strata.id}>{data.strata.id}</span>
      </div>
    {/if}

    <!-- Key Patterns Section -->
    <div class="p-1.5 flex flex-col gap-0.5 bg-base-100">
      <div
        class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-base-content/50 flex items-center gap-1"
      >
        <Layers class="w-3 h-3 opacity-60" />
        <span>Key-Value Schema</span>
      </div>

      {#if patternsToDisplay.length === 0}
        <div
          class="px-3 py-2.5 text-center bg-base-200/20 rounded-field flex flex-col gap-0.5"
        >
          <span class="text-[11px] font-mono text-base-content/65 font-medium">env.{data.label}.get(key)</span>
          <span class="text-[9.5px] text-base-content/40">Dynamic Key-Value Storage</span>
        </div>
      {:else}
        {#each patternsToDisplay as pattern (pattern.name)}
          <div
            class="relative px-3 py-1.5 rounded-field flex items-center justify-between hover:bg-base-200/50 transition-all group/row"
          >
            <!-- Row Handles for Pattern-Level Targeting -->
            <Handle
              id={pattern.name}
              type="target"
              position={Position.Left}
              isConnectable={true}
              class="absolute! -left-3! top-1/2! -translate-y-1/2 w-2! h-2! transition-transform! hover:scale-135! duration-150 cursor-crosshair z-20 opacity-30 group-hover/row:opacity-100"
              style="background: var(--color-warning); border: 1.5px solid var(--color-base-100);"
            />
            <Handle
              id={pattern.name}
              type="source"
              position={Position.Right}
              isConnectable={true}
              class="absolute! -right-3! top-1/2! -translate-y-1/2 w-2! h-2! transition-transform! hover:scale-135! duration-150 cursor-crosshair z-20 opacity-30 group-hover/row:opacity-100"
              style="background: var(--color-warning); border: 1.5px solid var(--color-base-100);"
            />

            <div class="flex items-center gap-2 overflow-hidden">
              <KeyRound class="w-3 h-3 text-warning/70 shrink-0" />
              <span
                class="text-[12px] font-mono font-medium tracking-tight text-base-content/90 truncate"
                title={pattern.name}
              >
                {pattern.name}
              </span>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              {#if pattern.ttl}
                <span
                  class="badge badge-xs bg-base-200/80 font-mono text-[9px] text-base-content/70 flex items-center gap-0.5 px-1 py-0"
                  title={`Time to Live: ${pattern.ttl}s`}
                >
                  <Clock class="w-2.5 h-2.5 opacity-60" />
                  {pattern.ttl >= 3600
                    ? `${Math.round(pattern.ttl / 3600)}h`
                    : `${pattern.ttl}s`}
                </span>
              {/if}
              <span
                class="text-[10px] font-mono bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded leading-none"
              >
                {pattern.definition || "string"}
              </span>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Binding Footer -->
    <div
      class="px-3 py-1.5 bg-base-200/40 border-t border-base-300/60 flex items-center justify-between text-[10px] font-mono text-base-content/60"
    >
      <div class="flex items-center gap-1.5">
        <Terminal class="w-3 h-3 opacity-60" />
        <span>env.{data.label}</span>
      </div>
      <span class="opacity-50">KV Global Edge</span>
    </div>
  </div>

  <!-- Universal Boundary Handles for Graph Routing -->
  <Handle
    id="target"
    type="target"
    position={Position.Left}
    isConnectable={true}
    class="transition-transform! hover:scale-130! duration-150 cursor-crosshair"
    style="width: 12px; height: 12px; background: var(--color-warning); border: 2px solid var(--color-base-100);"
  />
  <Handle
    id="source"
    type="source"
    position={Position.Right}
    isConnectable={true}
    class="transition-transform! hover:scale-130! duration-150 cursor-crosshair"
    style="width: 12px; height: 12px; background: var(--color-warning); border: 2px solid var(--color-base-100);"
  />
</div>
