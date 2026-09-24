<!--
  Inspector.svelte

  Summary: Sidebar architectural HUD displaying selected table/entity details (fields, types, relations) and telemetry.
  Expects: None (shares global schemaState).
  Output: Displays clean structure telemetry, connections, and diagnostic audits.
-->
<script lang="ts">
  import {
    Database,
    Cpu,
    Zap,
    X,
    Heart,
    HardDrive,
    Wrench,
    TriangleAlert,
    Copy,
    Check,
    Code,
    ExternalLink,
    ArrowRight,
    ArrowLeft,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";
  import { toast } from "svelte-sonner";
  import D1Inspector from "./D1Inspector.svelte";
  import KVInspector from "./KVInspector.svelte";
  import DOInspector from "./DOInspector.svelte";
  import R2Inspector from "./R2Inspector.svelte";
  import IdentityInspector from "./IdentityInspector.svelte";

  let activeTab = $state<"fields" | "relations">("fields");

  /** Configuration for different storage targets */
  const targetConfig = {
    d1: {
      icon: Database,
      label: "D1 Table",
      bg: "bg-primary/10",
      text: "text-primary",
    },
    do: {
      icon: Cpu,
      label: "Durable Object",
      bg: "bg-secondary/10",
      text: "text-secondary",
    },
    kv: {
      icon: Zap,
      label: "Key-Value",
      bg: "bg-accent/10",
      text: "text-accent",
    },
    r2: {
      icon: HardDrive,
      label: "R2 Storage",
      bg: "bg-info/10",
      text: "text-info",
    },
  };

  /**
   * Deselects the current node.
   */
  function dismiss() {
    schemaState.activeInspectorNodeId = null;
  }

  $effect(() => {
    if (schemaState.activeInspectorNodeId) {
      activeTab = "fields";
    }
  });

  const selectedNode = $derived(schemaState.activeInspectorNode);
  const isReadOnly = $derived(
    !!selectedNode &&
      ((selectedNode.data as any)?.target === "do" ||
        (selectedNode.data as any)?.target === "kv" ||
        (selectedNode.data as any)?.target === "r2"),
  );

  let copied = $state(false);

  async function copySnippet() {
    if (!drizzleSnippet) return;
    const ok = await PlatformService.writeClipboard(drizzleSnippet);
    if (ok) {
      copied = true;
      toast.success(`Copied "${selectedNode?.id || ''}" snippet`);
      setTimeout(() => {
        copied = false;
      }, 2000);
    } else {
      toast.error("Failed to copy snippet to clipboard");
    }
  }

  const drizzleSnippet = $derived.by(() => {
    if (!selectedNode) return "";
    return schemaState.getTableDefinitionSnippet(selectedNode.id);
  });
</script>

{#if schemaState.activeInspectorNodeId}
  {@const selectedNode = schemaState.activeInspectorNode}
  {#if selectedNode}
    {#if selectedNode.type === "identity"}
      <IdentityInspector node={selectedNode} onDismiss={dismiss} />
    {:else}
      {@const data = selectedNode.data as any}
      {@const config =
        targetConfig[(data.target as keyof typeof targetConfig) || "d1"]}
      {@const moduleInfo = data.moduleInfo}

      <div
        class="w-full h-full max-h-full bg-base-100 border-l border-base-300 flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-right-8 duration-300"
        data-testid="inspector-panel"
      >
        <!-- Header -->
        <div
          class="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2.5 {config.bg} rounded-field shadow-xs shrink-0">
              <config.icon class="w-4 h-4 {config.text}" />
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <h3
                  class="font-bold text-sm tracking-tight leading-none text-base-content font-mono truncate"
                  data-testid="inspector-title"
                >
                  {selectedNode.id}
                </h3>
              </div>
              <div class="flex items-center gap-1.5 mt-1">
                <span
                  class="text-[9px] uppercase tracking-wider font-bold {config.text}"
                >
                  {config.label}
                </span>
                {#if moduleInfo && !moduleInfo.isRootFile}
                  <span class="text-[9px] text-base-content/50 font-mono">
                    • {moduleInfo.moduleName}
                  </span>
                {/if}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              class="btn btn-ghost btn-xs btn-circle hover:bg-base-200 text-primary"
              onclick={() => {
                const targetFile =
                  moduleInfo?.sourceFilePath ||
                  schemaState.getTargetFilePath(selectedNode.id) ||
                  schemaState.filePath;
                const line = (data as any).line;
                if (targetFile) {
                  PlatformService.openInEditor(targetFile, line);
                }
              }}
              title="Open in Code Editor"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </button>
            <button
              class="btn btn-ghost btn-xs btn-circle hover:bg-base-200"
              onclick={dismiss}
              title="Close Inspector"
            >
              <X class="w-4 h-4 opacity-60" />
            </button>
          </div>
        </div>

        <!-- JSDoc Audit Warnings (if any) -->
        {#if schemaState.auditIssues.some((i) => i.symbolName === selectedNode.id)}
          {@const nodeIssues = schemaState.auditIssues.filter(
            (i) => i.symbolName === selectedNode.id,
          )}
          <div
            class="mx-5 mt-4 p-3 rounded-box bg-warning/10 border border-warning/20 flex flex-col gap-2"
          >
            <div class="flex items-center gap-2 text-warning text-xs font-bold">
              <TriangleAlert class="w-4 h-4 shrink-0" />
              <span>Diagnostic Warning{nodeIssues.length > 1 ? "s" : ""}</span>
            </div>
            {#each nodeIssues as issue}
              <div
                class="flex flex-col gap-1 border-b border-warning/10 pb-2 last:border-b-0 last:pb-0"
              >
                <p class="text-[11px] text-base-content/80 leading-relaxed">
                  {issue.message}
                </p>
                {#if issue.suggestedFix}
                  <button
                    class="btn btn-xs btn-warning rounded-field text-[10px] h-6 min-h-6 self-start font-bold gap-1 mt-0.5"
                    onclick={() => schemaState.applyAuditFix(issue)}
                  >
                    <Wrench class="w-3 h-3" />
                    <span>{issue.suggestedFix.label || "Auto-Repair"}</span>
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Tabs Navigation -->
        <div
          class="tabs tabs-boxed rounded-box bg-base-200/80 p-1 mx-5 mt-4 flex select-none shrink-0 border border-base-300"
        >
          <button
            class="tab tab-sm grow rounded-field transition-all text-xs font-semibold py-1.5 {activeTab ===
            'fields'
              ? 'tab-active bg-base-100 shadow-xs font-bold text-primary'
              : 'text-base-content/75 hover:text-base-content'}"
            onclick={() => (activeTab = "fields")}
          >
            Structure ({data.columns.length})
          </button>
          <button
            class="tab tab-sm grow rounded-field transition-all text-xs font-semibold py-1.5 {activeTab ===
            'relations'
              ? 'tab-active bg-base-100 shadow-xs font-bold text-primary'
              : 'text-base-content/75 hover:text-base-content'}"
            onclick={() => (activeTab = "relations")}
          >
            Relationships ({schemaState.edges.filter(
              (e) =>
                e.source === selectedNode.id || e.target === selectedNode.id,
            ).length})
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto min-h-0 p-5 flex flex-col gap-5">
          {#if activeTab === "fields"}
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between px-1">
                <span
                  class="text-[10px] font-bold uppercase opacity-75 text-base-content/75 tracking-wider"
                >
                  Field Definitions
                </span>
              </div>

              {#if data.target === "d1" || !data.target}
                <D1Inspector tableName={selectedNode.id} {data} {isReadOnly} />
              {:else if data.target === "kv"}
                <KVInspector tableName={selectedNode.id} {data} {isReadOnly} />
              {:else if data.target === "do"}
                <DOInspector tableName={selectedNode.id} {data} {isReadOnly} />
              {:else if data.target === "r2"}
                <R2Inspector tableName={selectedNode.id} {data} {isReadOnly} />
              {/if}
            </div>
          {:else if activeTab === "relations"}
            {@const tableEdges = schemaState.edges.filter(
              (e: any) =>
                e.source === selectedNode.id || e.target === selectedNode.id,
            )}
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between px-1">
                <span
                  class="text-[10px] font-bold uppercase opacity-75 text-base-content/75 tracking-wider"
                >
                  Active Connections
                </span>
              </div>

              {#if tableEdges.length === 0}
                <div
                  class="text-center py-8 text-xs text-base-content/60 font-medium"
                >
                  No relationships or edge bindings connected to this entity.
                </div>
              {:else}
                <div class="flex flex-col gap-2.5">
                  {#each tableEdges as edge}
                    {@const isSource = edge.source === selectedNode.id}
                    {@const otherNode = isSource ? edge.target : edge.source}
                    {@const isVirtual = edge.data?.isVirtual}
                    {@const isSynthetic =
                      edge.data?.isSynthetic || edge.data?.isIdentityBoundary}
                    {@const isPhysical =
                      edge.data?.isPhysical || (!isVirtual && !isSynthetic)}
                    {@const card =
                      edge.data?.cardinality &&
                      edge.data.cardinality !== "unknown"
                        ? edge.data.cardinality
                        : isSynthetic
                          ? "Topology"
                          : isPhysical
                            ? "FK"
                            : "Virtual"}
                    {@const relNames: string[] = ((edge.data as any)?.relationNames as string[]) || []}
                    <div
                      class="bg-base-200/40 p-3 rounded-box flex flex-col gap-2 border border-base-300/60 hover:border-base-300 transition-all group animate-in fade-in duration-150 shadow-2xs"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          {#if isSource}
                            <ArrowRight class="w-3.5 h-3.5 text-primary shrink-0" />
                          {:else}
                            <ArrowLeft class="w-3.5 h-3.5 text-secondary shrink-0" />
                          {/if}
                          <span
                            class="font-bold text-xs text-base-content font-mono"
                            >{otherNode}</span
                          >
                        </div>

                        <span
                          class="badge {isSynthetic
                            ? 'badge-accent'
                            : isPhysical
                              ? 'badge-primary'
                              : 'badge-secondary'} badge-outline badge-xs text-[9px] uppercase font-mono px-1.5 py-0.5 rounded leading-none"
                        >
                          {card}
                        </span>
                      </div>

                      <!-- Pedigree Badges & Details -->
                      <div
                        class="flex flex-col gap-1.5 pt-1 border-t border-base-300/30 text-[10px]"
                      >
                        <div class="flex items-center justify-between">
                          <span
                            class="px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold border {isSynthetic
                              ? 'bg-accent/10 text-accent border-accent/20'
                              : isPhysical
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-secondary/10 text-secondary border-secondary/20'}"
                          >
                            {isSynthetic
                              ? "Cloudflare Topology"
                              : isPhysical
                                ? "Physical Constraint"
                                : "Virtual Query-Only"}
                          </span>

                          {#if edge.label}
                            <span
                              class="font-mono text-[10px] opacity-75 font-medium truncate max-w-37.5"
                            >
                              {edge.label}
                            </span>
                          {/if}
                        </div>

                        {#if isPhysical && edge.data?.sourceCol}
                          <div
                            class="text-[10px] text-base-content/75 font-mono flex items-center gap-1 mt-0.5"
                          >
                            <span class="opacity-50 text-[9px]">SQL:</span>
                            <span class="truncate"
                              >{edge.source}.{edge.data.sourceCol} -> {edge.target}.{edge
                                .data?.targetCol || "id"}</span
                            >
                          </div>
                        {/if}

                        {#if relNames.length > 0}
                          <div
                            class="text-[10px] text-base-content/75 font-mono flex items-center gap-1"
                          >
                            <span class="opacity-50 text-[9px]">Drizzle:</span>
                            <span class="text-primary font-semibold truncate"
                              >{relNames.join(", ")}</span
                            >
                          </div>
                        {/if}

                        {#if isVirtual && !isSynthetic}
                          <div
                            class="text-[9px] text-amber-500/90 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded mt-0.5 leading-relaxed"
                          >
                            Virtual Drizzle relation without SQLite foreign key
                            constraint. Consider adding <code
                              class="font-mono text-[9px] font-bold"
                              >.references()</code
                            > for SQL data integrity.
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Definition Snippet Preview -->
          {#if drizzleSnippet}
            <div class="flex flex-col gap-2 pt-3 border-t border-base-300/60">
              <div class="flex items-center justify-between px-1">
                <span
                  class="text-[10px] font-bold uppercase opacity-75 text-base-content/75 tracking-wider flex items-center gap-1.5"
                >
                  <Code class="w-3 h-3 text-primary" />
                  <span>Definition Preview</span>
                </span>
                <button
                  class="btn btn-ghost btn-xs gap-1 font-mono text-[10px] h-5 min-h-0 px-2 rounded hover:bg-base-200 text-base-content/70 hover:text-primary transition-all"
                  onclick={copySnippet}
                  title="Copy definition to clipboard"
                  data-testid="inspector-copy-snippet"
                >
                  {#if copied}
                    <Check class="w-3 h-3 text-success" />
                    <span class="text-success font-semibold">Copied!</span>
                  {:else}
                    <Copy class="w-3 h-3" />
                    <span>Copy</span>
                  {/if}
                </button>
              </div>
              <div
                class="relative rounded-box bg-base-200/50 border border-base-300/80 p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-base-content/90 max-h-48 scrollbar-thin select-text"
              >
                <pre class="whitespace-pre"><code>{drizzleSnippet}</code></pre>
              </div>
            </div>
          {/if}
        </div>

        <!-- Footer Note -->
        <div class="p-4 bg-base-200/30 border-t border-base-300/60">
          <p
            class="text-[9.5px] opacity-60 text-base-content text-center flex items-center justify-center gap-1 font-mono"
          >
            Strata Architecture Telemetry HUD
          </p>
        </div>
      </div>
    {/if}
  {/if}
{/if}
