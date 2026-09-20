<!--
  R2BucketNode.svelte

  Summary: Svelte Flow custom node rendering a Cloudflare R2 Object Storage Vault card.
  Expects: Svelte Flow node props (id, data, selected, dragging).
  Output: Visual Object Storage card with folder prefix mappings, access policies, and boundary handles.
-->
<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import {
    HardDrive,
    FolderTree,
    Globe,
    Lock,
    ShieldCheck,
    Server,
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
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      folders?: Array<{
        name: string;
        definition: string;
        isPk?: boolean;
        isReferences?: boolean;
      }>;
      target?: "d1" | "do" | "kv" | "r2";
      isExternal?: boolean;
      strata?: {
        folders?: Record<string, string>;
        public?: boolean;
        customDomain?: string;
        cors?: boolean | any[];
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
    !schemaState.activeFilter || schemaState.activeFilter === "r2",
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

  const foldersToDisplay = $derived(
    data.folders || data.columns || [],
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
</script>

<div
  class="relative group/node min-w-60 max-w-80 transition-all duration-300 {opacityClass}"
  data-testid="r2-node"
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
    class="bg-base-100 border rounded-box overflow-hidden transition-all duration-200 border-t-4 border-t-info {selected
      ? 'border-info ring-2 ring-info/30'
      : 'border-base-300 hover:border-info/50'} {dragging
      ? 'shadow-2xl scale-[1.02]'
      : 'shadow-md'}"
  >
    <!-- Header -->
    <div
      class="bg-base-200/90 px-4 py-3 border-b border-base-300 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <div
          class="p-1.5 bg-info/10 rounded-field group-hover/node:bg-info/20 transition-colors"
        >
          <HardDrive class="w-4 h-4 text-info" />
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
          class="badge badge-xs bg-info/10 text-info border border-info/30 font-mono text-[9px] font-bold"
          title="Cloudflare R2 Object Storage"
        >
          R2 Bucket
        </div>
      </div>
    </div>

    <!-- Access & Policy Bar -->
    <div
      class="px-3 py-1.5 bg-base-200/50 border-b border-base-300/60 flex items-center gap-1.5 flex-wrap"
    >
      {#if data.strata?.public}
        <span
          class="badge badge-xs bg-info/20 text-info border border-info/40 text-[9px] font-mono gap-1"
          title="Publicly Readable Bucket"
        >
          <Globe class="w-2.5 h-2.5" />
          public
        </span>
      {:else}
        <span
          class="badge badge-xs bg-base-100 border border-base-300/80 text-base-content/70 text-[9px] font-mono gap-1"
          title="Private Bucket (Signed Requests Required)"
        >
          <Lock class="w-2.5 h-2.5" />
          private
        </span>
      {/if}

      {#if data.strata?.customDomain}
        <span
          class="badge badge-xs bg-base-100 border border-base-300/80 text-[9px] font-mono text-base-content/80 truncate max-w-32"
          title={`Custom Domain: ${data.strata.customDomain}`}
        >
          {data.strata.customDomain}
        </span>
      {/if}

      {#if data.strata?.cors}
        <span
          class="badge badge-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-mono gap-1"
          title="Cross-Origin Resource Sharing Enabled"
        >
          <ShieldCheck class="w-2.5 h-2.5" />
          cors
        </span>
      {/if}
    </div>

    <!-- Folders / Prefix Mapping Section -->
    <div class="p-1.5 flex flex-col gap-0.5 bg-base-100">
      <div
        class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-base-content/50 flex items-center gap-1"
      >
        <FolderTree class="w-3 h-3 opacity-60" />
        <span>Folder Prefixes</span>
      </div>

      {#if foldersToDisplay.length === 0}
        <div
          class="px-3 py-2 text-[11px] font-mono text-base-content/40 italic text-center bg-base-200/20 rounded-field"
        >
          Root Object Store
        </div>
      {:else}
        {#each foldersToDisplay as folder (folder.name)}
          <div
            class="relative px-3 py-1.5 rounded-field flex items-center justify-between hover:bg-base-200/50 transition-all group/row"
          >
            <!-- Row Handles for Folder-Level Connection -->
            <Handle
              id={folder.name}
              type="target"
              position={Position.Left}
              isConnectable={true}
              class="absolute! -left-3! top-1/2! -translate-y-1/2 w-2! h-2! transition-transform! hover:scale-135! duration-150 cursor-crosshair z-20 opacity-30 group-hover/row:opacity-100"
              style="background: var(--color-info); border: 1.5px solid var(--color-base-100);"
            />
            <Handle
              id={folder.name}
              type="source"
              position={Position.Right}
              isConnectable={true}
              class="absolute! -right-3! top-1/2! -translate-y-1/2 w-2! h-2! transition-transform! hover:scale-135! duration-150 cursor-crosshair z-20 opacity-30 group-hover/row:opacity-100"
              style="background: var(--color-info); border: 1.5px solid var(--color-base-100);"
            />

            <div class="flex items-center gap-2 overflow-hidden">
              <FolderTree class="w-3 h-3 text-info/70 shrink-0" />
              <span
                class="text-[12px] font-mono font-medium tracking-tight text-base-content/90 truncate"
                title={folder.name}
              >
                {folder.name}
              </span>
            </div>

            <span
              class="text-[10px] font-mono bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded leading-none shrink-0"
            >
              {folder.definition || "*/*"}
            </span>
          </div>
        {/each}
      {/if}
    </div>

    <!-- S3 API Footer -->
    <div
      class="px-3 py-1.5 bg-base-200/40 border-t border-base-300/60 flex items-center justify-between text-[10px] font-mono text-base-content/60"
    >
      <div class="flex items-center gap-1.5">
        <Server class="w-3 h-3 opacity-60" />
        <span>S3 API Compatible</span>
      </div>
      <span class="opacity-50">env.{data.label}</span>
    </div>
  </div>

  <!-- Universal Boundary Handles for Graph Routing -->
  <Handle
    id="target"
    type="target"
    position={Position.Left}
    isConnectable={true}
    class="transition-transform! hover:scale-130! duration-150 cursor-crosshair"
    style="width: 12px; height: 12px; background: var(--color-info); border: 2px solid var(--color-base-100);"
  />
  <Handle
    id="source"
    type="source"
    position={Position.Right}
    isConnectable={true}
    class="transition-transform! hover:scale-130! duration-150 cursor-crosshair"
    style="width: 12px; height: 12px; background: var(--color-info); border: 2px solid var(--color-base-100);"
  />
</div>
