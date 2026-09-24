<!--
  DurableObjectNode.svelte

  Summary: Svelte Flow custom node rendering a Cloudflare Durable Object compute actor card.
  Expects: Svelte Flow node props (id, data, selected, dragging).
  Output: Visual Actor card with RPC method signatures, capability indicators, and boundary handles.
-->
<script lang="ts">
  import { Handle, Position, useUpdateNodeInternals } from "@xyflow/svelte";
  import { tick } from "svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import NodeQuickActions from "./NodeQuickActions.svelte";
  import {
    Cpu,
    Database,
    Zap,
    Code,
    Clock,
    Network,
    Moon,
    FileCode,
    Folder,
    CircleX,
    TriangleAlert,
  } from "lucide-svelte";

  const { id, data, selected, dragging } = $props<{
    data: {
      label: string;
      columns?: Array<{
        name: string;
        definition: string;
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      methods?: Array<{
        name: string;
        definition: string;
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      target?: "d1" | "do" | "kv" | "r2";
      isExternal?: boolean;
      strata?: {
        storage?: "sqlite" | "kv";
        alarms?: boolean;
        websockets?: boolean;
        hibernation?: boolean;
        class?: string;
        path?: string;
        methods?: string[];
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
    id?: string;
  }>();

  const nodeId = $derived(id || data.label);

  const isMatch = $derived(
    !schemaState.activeFilter || schemaState.activeFilter === "do",
  );

  const highlightStatus = $derived(
    schemaState.highlightGraph.getNodeHighlight(nodeId),
  );

  const opacityClass = $derived(
    !isMatch
      ? "opacity-30 pointer-events-none"
      : highlightStatus === "normal"
        ? "opacity-100 scale-100"
        : highlightStatus === "self"
          ? "opacity-100 scale-100 z-30 ring-2 ring-secondary/60 shadow-2xl"
          : highlightStatus === "upstream"
            ? "opacity-100 scale-100 z-20 ring-2 ring-primary/50 shadow-xl"
            : highlightStatus === "downstream"
              ? "opacity-100 scale-100 z-20 ring-2 ring-secondary/50 shadow-xl"
              : highlightStatus === "transitive"
                ? "opacity-65 scale-[0.99] z-10 border-dashed"
                : "opacity-20 scale-98 pointer-events-auto",
  );

  const methodsToDisplay = $derived(
    data.methods || data.columns || [],
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
    schemaState.activeInspectorNodeId = nodeId;
    const targetFile =
      data.strata?.path ||
      data.moduleInfo?.sourceFilePath ||
      schemaState.getTargetFilePath(nodeId) ||
      schemaState.filePath;
    const line = data.line;
    if (targetFile) {
      PlatformService.openInEditor(targetFile, line);
    }
  }

  const updateNodeInternals = useUpdateNodeInternals();
  $effect(() => {
    const _m = methodsToDisplay.length;
    tick().then(() => {
      updateNodeInternals(nodeId);
    });
  });
</script>

<NodeQuickActions
  {nodeId}
  nodeType="do"
  {selected}
  targetFile={data.strata?.path || data.moduleInfo?.sourceFilePath || schemaState.getTargetFilePath(nodeId) || schemaState.filePath}
  line={data.line}
/>

<div
  class="relative group/node min-w-64 max-w-84 transition-all duration-300 {opacityClass}"
  data-testid="do-node"
  data-node-name={data.label}
  role="button"
  tabindex="0"
  onmouseenter={() => {
    if (!dragging) schemaState.hoveredNodeId = nodeId;
  }}
  onmouseleave={() => {
    if (schemaState.hoveredNodeId === nodeId)
      schemaState.hoveredNodeId = null;
  }}
  ondblclick={handleOpenEditor}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      schemaState.activeInspectorNodeId = nodeId;
    }
  }}
>
  <div
    class="bg-base-100 border rounded-box overflow-hidden transition-all duration-200 border-t-4 border-t-secondary {selected
      ? 'border-secondary ring-2 ring-secondary/30'
      : 'border-base-300 hover:border-secondary/50'} {dragging
      ? 'shadow-2xl scale-[1.02]'
      : 'shadow-md'}"
  >
    <!-- Header -->
    <div
      class="bg-base-200/90 px-4 py-3 border-b border-base-300 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <div
          class="p-1.5 bg-secondary/10 rounded-field group-hover/node:bg-secondary/20 transition-colors"
        >
          <Cpu class="w-4 h-4 text-secondary" />
        </div>
        <span class="font-bold text-xs tracking-wide uppercase">{data.label}</span>
        {#if highlightStatus === "upstream"}
          <span class="badge badge-xs badge-primary font-mono text-[8px] px-1 py-0 shadow-xs" title="Upstream dependency: referenced by active table">↑ upstream</span>
        {:else if highlightStatus === "downstream"}
          <span class="badge badge-xs badge-secondary font-mono text-[8px] px-1 py-0 shadow-xs" title="Downstream dependent: references active table">↓ dependent</span>
        {:else if highlightStatus === "transitive"}
          <span class="badge badge-xs badge-ghost border-base-300 font-mono text-[8px] px-1 py-0 opacity-80" title="2-hop transitive connection">2-hop</span>
        {/if}
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
          class="badge badge-xs bg-secondary/10 text-secondary border border-secondary/30 font-mono text-[9px] font-bold"
          title="Cloudflare Durable Object Actor"
        >
          DO Actor
        </div>
      </div>
    </div>

    <!-- Class Name Sub-bar if different from binding name -->
    {#if data.strata?.class && data.strata.class !== data.label}
      <div
        class="px-3 py-1 bg-base-200/40 border-b border-base-300/60 flex items-center justify-between text-[10px] font-mono text-base-content/70"
      >
        <span class="opacity-50 text-[9px] uppercase font-bold tracking-wider">Class</span>
        <span class="truncate max-w-42 text-[9.5px] font-bold text-secondary">{data.strata.class}</span>
      </div>
    {/if}

    <!-- Capabilities Bar -->
    <div
      class="px-3 py-1.5 bg-base-200/50 border-b border-base-300/60 flex items-center gap-1.5 flex-wrap"
    >
      <span
        class="badge badge-xs bg-base-100 border border-base-300/80 text-[9px] font-mono gap-1 text-base-content/80"
        title="Storage Backend Engine"
      >
        <Database class="w-2.5 h-2.5 text-secondary" />
        {data.strata?.storage || "sqlite"}
      </span>

      {#if data.strata?.alarms !== false}
        <span
          class="badge badge-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-mono gap-1"
          title="Scheduled Alarm Wakeups Supported"
        >
          <Clock class="w-2.5 h-2.5" />
          alarms
        </span>
      {/if}

      {#if data.strata?.websockets}
        <span
          class="badge badge-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-mono gap-1"
          title="Stateful WebSocket Hibernation Enabled"
        >
          <Network class="w-2.5 h-2.5" />
          ws
        </span>
      {/if}

      {#if data.strata?.hibernation}
        <span
          class="badge badge-xs bg-info/10 text-info border border-info/20 text-[9px] font-mono gap-1"
          title="Actor Memory Hibernation Enabled"
        >
          <Moon class="w-2.5 h-2.5" />
          hibernate
        </span>
      {/if}
    </div>

    <!-- RPC Interface Section -->
    <div class="p-1.5 flex flex-col gap-0.5 bg-base-100">
      <div
        class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-base-content/50 flex items-center gap-1"
      >
        <Code class="w-3 h-3 opacity-60" />
        <span>RPC Interface</span>
      </div>

      {#if methodsToDisplay.length === 0}
        <div
          class="px-3 py-2 text-[11px] font-mono text-base-content/40 italic text-center bg-base-200/20 rounded-field"
        >
          No public RPC methods declared
        </div>
      {:else}
        {#each methodsToDisplay as method (method.name)}
          <div
            class="relative px-3 py-1.5 rounded-field flex items-center justify-between hover:bg-base-200/50 transition-all group/row"
          >
            <!-- Row Handles for Method-Level Connection -->
            <Handle
              id={method.name}
              type="target"
              position={Position.Left}
              isConnectable={true}
              class="absolute! -left-3! top-1/2! -translate-y-1/2 w-2! h-2! transition-transform! hover:scale-135! duration-150 cursor-crosshair z-20 opacity-30 group-hover/row:opacity-100"
              style="background: var(--color-secondary); border: 1.5px solid var(--color-base-100);"
            />
            <Handle
              id={method.name}
              type="source"
              position={Position.Right}
              isConnectable={true}
              class="absolute! -right-3! top-1/2! -translate-y-1/2 w-2! h-2! transition-transform! hover:scale-135! duration-150 cursor-crosshair z-20 opacity-30 group-hover/row:opacity-100"
              style="background: var(--color-secondary); border: 1.5px solid var(--color-base-100);"
            />

            <div class="flex items-center gap-2 overflow-hidden">
              <Zap class="w-3 h-3 text-secondary/70 shrink-0" />
              <span
                class="text-[12px] font-mono font-medium tracking-tight text-base-content/90 truncate"
                title={method.name}
              >
                {method.name}
              </span>
            </div>

            <span
              class="text-[10px] font-mono bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded leading-none shrink-0"
            >
              {method.definition || "void"}
            </span>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Source Class Path Footer -->
    {#if data.strata?.path}
      <div
        class="px-3 py-1.5 bg-base-200/40 border-t border-base-300/60 flex items-center justify-between text-[10px] font-mono"
      >
        <button
          type="button"
          class="flex items-center gap-1.5 text-base-content/70 hover:text-secondary transition-colors truncate text-left max-w-full"
          onclick={(e) => {
            e.stopPropagation();
            handleOpenEditor();
          }}
          title={`Click to open ${data.strata?.path} in editor`}
        >
          <FileCode class="w-3 h-3 text-secondary shrink-0" />
          <span class="truncate">{data.strata.path}</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Universal Boundary Handles for Graph Routing -->
  <Handle
    id="target"
    type="target"
    position={Position.Left}
    isConnectable={true}
    class="transition-transform! hover:scale-130! duration-150 cursor-crosshair"
    style="width: 12px; height: 12px; background: var(--color-secondary); border: 2px solid var(--color-base-100);"
  />
  <Handle
    id="source"
    type="source"
    position={Position.Right}
    isConnectable={true}
    class="transition-transform! hover:scale-130! duration-150 cursor-crosshair"
    style="width: 12px; height: 12px; background: var(--color-secondary); border: 2px solid var(--color-base-100);"
  />
</div>
