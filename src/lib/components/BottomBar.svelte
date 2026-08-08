<!--
  BottomBar.svelte

  Summary: Bottom application status bar rendering schema status, loaded file, active coordinates, and stats.
  Expects: None (shares global schemaState).
  Output: Displays visual status indicator and metadata.
-->
<script lang="ts">
  import {
    RefreshCw,
    FileText,
    Database,
    Layers,
    Cpu,
    Zap,
    TriangleAlert,
    CircleAlert,
    Wrench,
    X,
    Lightbulb,
    CircleX,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";
  import { uiState } from "$lib/state/uiStore.svelte";

  const stats = $derived.by(() => {
    const nodes = schemaState.nodes;
    const edges = schemaState.edges;

    return {
      d1: nodes.filter(
        (n) => (n.data as any).target === "d1" || !(n.data as any).target,
      ).length,
      do: nodes.filter((n) => (n.data as any).target === "do").length,
      kv: nodes.filter((n) => (n.data as any).target === "kv").length,
      columns: nodes.reduce(
        (acc, n) => acc + ((n.data as any).columns?.length || 0),
        0,
      ),
      relations: edges.length,
      total: nodes.length,
    };
  });
</script>

<div
  class="w-full h-6 bg-base-300/60 border-t border-base-300/80 backdrop-blur-sm z-30 flex items-center justify-between px-4 select-none shrink-0 text-[10px] font-mono text-base-content/60"
  data-testid="bottombar"
>
  <!-- Left Side: Sync Indicator & Tooltip -->
  <div class="flex items-center gap-3">
    <div class="relative group flex items-center gap-2 cursor-help py-0.5">
      <div class="flex items-center gap-1.5">
        <div
          class="w-1.5 h-1.5 rounded-full transition-all {schemaState.isSandboxMode
            ? 'bg-secondary animate-pulse text-secondary'
            : !schemaState.filePath
              ? 'bg-warning text-warning'
              : !schemaState.isValid
                ? 'bg-error animate-ping text-error'
                : schemaState.hasUnsavedChanges
                  ? 'bg-warning animate-pulse text-warning'
                  : 'bg-success text-success'} shadow-[0_0_8px_currentColor]"
        ></div>
        <span class="font-bold text-base-content/75 uppercase tracking-wider">
          {schemaState.isSandboxMode
            ? "Playground Sandbox"
            : !schemaState.filePath
              ? "No Schema"
              : !schemaState.isValid
                ? "Sync Error"
                : schemaState.hasUnsavedChanges
                  ? "Unsaved Layout"
                  : "Live Mirror"}
        </span>
      </div>

      <!-- Detail Card (glorious tooltip) -->
      <div
        class="absolute bottom-7 left-0 w-80 p-5 bg-base-100 border border-base-300/80 rounded-2xl shadow-2xl opacity-0 scale-95 translate-y-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 pointer-events-none transition-all duration-200 z-50 origin-bottom-left flex flex-col gap-3 backdrop-blur-md"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-primary/10 rounded-xl">
            <RefreshCw
              class="w-4 h-4 text-primary animate-spin duration-3000 [animation-duration:10s]"
            />
          </div>
          <div>
            <span
              class="text-[9px] font-bold uppercase tracking-wider text-primary/75 block leading-none mb-0.5"
              >{schemaState.isSandboxMode
                ? "In-Memory Engine"
                : "Bi-Directional Engine"}</span
            >
            <span class="font-bold text-xs text-base-content"
              >{schemaState.isSandboxMode
                ? "Playground Sandbox Active"
                : "Code ⇄ UI Synchronization"}</span
            >
          </div>
        </div>
        {#if schemaState.isSandboxMode}
          <p class="text-[11px] leading-relaxed text-base-content/75 font-sans">
            You are in zero-risk <strong>Playground Sandbox Mode</strong>. Edits
            operate strictly in memory and will not modify files on disk.
          </p>
          <div
            class="text-[10px] leading-relaxed text-base-content/70 pl-2 border-l-2 border-secondary/50 font-sans"
          >
            Click <strong>Open Schema</strong> in the navbar to connect to a
            real
            <code
              class="bg-base-200/60 px-1 py-0.5 rounded font-mono text-[9px]"
              >schema.ts</code
            > file on disk.
          </div>
        {:else}
          <p class="text-[11px] leading-relaxed text-base-content/75 font-sans">
            Strata keeps your <code
              class="bg-base-200/60 px-1 py-0.5 rounded font-mono text-[10px] text-primary"
              >schema.ts</code
            > file as the absolute single source of truth.
          </p>
          <div
            class="text-[11px] leading-relaxed text-base-content/70 pl-2 border-l-2 border-primary/30 flex flex-col gap-1 font-sans"
          >
            <span
              >• <strong>Disk ➔ UI:</strong> External saves (e.g. in VS Code) trigger
              the file watcher to instantly parse the AST and refresh the diagram.</span
            >
            <span
              >• <strong>UI ➔ Disk:</strong> Canvas drags or visual modifications
              surgically patch the AST and write back in real-time.</span
            >
          </div>
        {/if}
        <div class="h-px bg-base-200/80 my-1"></div>
        <div
          class="flex flex-col gap-1 text-[9px] font-mono text-base-content/50"
        >
          <div class="flex items-center justify-between">
            <span>Drizzle ORM: v0.45.2</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Active File Path or Sandbox Badge (Compact Basename) -->
    {#if schemaState.isSandboxMode}
      <div class="h-3 w-px bg-base-300/80"></div>
      <div
        class="flex items-center gap-1 opacity-90 text-secondary font-semibold text-[10px]"
        title="Playground Sandbox Mode (In-Memory Engine)"
      >
        <FileText class="w-3.5 h-3.5" />
        <span>Sandbox</span>
      </div>
    {:else if schemaState.filePath}
      <div class="h-3 w-px bg-base-300/80"></div>
      <div
        class="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity cursor-default"
        title={schemaState.filePath}
      >
        <FileText class="w-3.5 h-3.5 text-base-content/60" />
        <span
          class="truncate max-w-28 sm:max-w-44 font-semibold text-base-content/85"
        >
          {schemaState.filePath.split("/").pop()}
        </span>
        <button
          class="btn btn-ghost btn-xs btn-circle h-4 w-4 min-h-0 hover:bg-base-200 text-base-content/50 hover:text-error ml-0.5"
          onclick={() => schemaState.closeFile()}
          title="Close schema & return to welcome overlay"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    {/if}

    <!-- Audit Issues & Configuration Mismatches -->
    {#if (schemaState.filePath || schemaState.isSandboxMode) && schemaState.totalAuditCount > 0}
      <div class="h-3 w-px bg-base-300/80"></div>
      <div
        class="relative group/warn flex items-center gap-1 cursor-pointer py-0.5"
      >
        <div
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border transition-colors {schemaState.auditErrorCount >
          0
            ? 'bg-error/15 border-error/30 text-error'
            : 'bg-warning/15 border-warning/30 text-warning'}"
        >
          {#if schemaState.auditErrorCount > 0}
            <CircleAlert class="w-3 h-3 text-error" />
            <span>{schemaState.auditErrorCount} Errors</span>
          {:else}
            <TriangleAlert class="w-3 h-3 text-warning" />
            <span>{schemaState.auditWarningCount} Warnings</span>
          {/if}
        </div>

        <!-- Detail Card (glorious audit & diagnostic tooltip) -->
        <div
          class="absolute bottom-7 left-0 w-96 max-h-105 p-4 bg-base-100 border border-base-300/80 rounded-2xl shadow-2xl opacity-0 scale-95 translate-y-2 group-hover/warn:opacity-100 group-hover/warn:scale-100 group-hover/warn:translate-y-0 group-hover/warn:pointer-events-auto pointer-events-none transition-all duration-200 z-50 origin-bottom-left flex flex-col gap-3 backdrop-blur-md text-[11px] font-sans overflow-y-auto"
        >
          <div
            class="flex items-center justify-between border-b border-base-200 pb-2"
          >
            <div class="flex items-center gap-2">
              <div
                class="p-1 rounded-lg {schemaState.auditErrorCount > 0
                  ? 'bg-error/10 text-error'
                  : 'bg-warning/10 text-warning'}"
              >
                {#if schemaState.auditErrorCount > 0}
                  <CircleAlert class="w-4 h-4" />
                {:else}
                  <TriangleAlert class="w-4 h-4" />
                {/if}
              </div>
              <div>
                <span
                  class="font-bold text-xs text-base-content uppercase tracking-wider block leading-none"
                  >Schema Diagnostics</span
                >
                <span class="text-[10px] text-base-content/60"
                  >{schemaState.totalAuditCount} total issues detected</span
                >
              </div>
            </div>
          </div>

          <!-- Audit Issues List -->
          {#if schemaState.auditIssues.length > 0}
            <div class="flex flex-col gap-1.5">
              <span
                class="text-[9px] font-bold uppercase tracking-wider text-base-content/50"
                >JSDoc & Parser Issues</span
              >
              {#each schemaState.auditIssues as issue}
                <div
                  class="p-2 rounded-xl bg-base-200/50 border border-base-300/50 flex flex-col gap-1 text-[10px]"
                >
                  <div class="flex items-center justify-between">
                    <span
                      class="font-bold font-mono text-[10px] flex items-center gap-1 {issue.severity ===
                        'error' || issue.severity === 'critical'
                        ? 'text-error'
                        : 'text-warning'}"
                    >
                      <span>
                        {#if issue.severity === "error" || issue.severity === "critical"}
                          <CircleX class="w-4 h-4" />
                        {:else}
                          <TriangleAlert class="w-4 h-4" />
                        {/if}
                      </span>
                      <span>{issue.symbolName || "Schema"}</span>
                    </span>
                    {#if issue.line}
                      <button
                        class="px-1.5 py-0.5 rounded bg-base-300/60 hover:bg-primary/20 hover:text-primary font-mono text-[9px] transition-colors"
                        onclick={() => uiState.jumpToCodeLine(issue.line)}
                        title="Click to jump to line {issue.line} in Code Editor"
                      >
                        Line {issue.line} ↗
                      </button>
                    {/if}
                  </div>
                  <p class="text-base-content/80 font-sans leading-tight">
                    {issue.message}
                  </p>
                  {#if issue.suggestedFix && issue.symbolName}
                    <button
                      class="btn btn-xs btn-ghost text-primary border border-primary/20 rounded-lg text-[9px] h-6 min-h-6 self-start mt-0.5 gap-1 hover:bg-primary/10"
                      onclick={() =>
                        issue.symbolName &&
                        schemaState.repairNodeJsdoc(issue.symbolName)}
                    >
                      <Wrench class="w-3 h-3" />
                      <span>{issue.suggestedFix.label}</span>
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Configuration Mismatches List -->
          {#if schemaState.validationWarnings.length > 0}
            <div class="flex flex-col gap-1.5">
              <span
                class="text-[9px] font-bold uppercase tracking-wider text-base-content/50"
                >Configuration Mismatches</span
              >
              <ul
                class="list-disc pl-4 space-y-1 text-[10px] leading-relaxed text-warning font-mono"
              >
                {#each schemaState.validationWarnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
              {#if !schemaState.isSandboxMode}
                <button
                  class="btn btn-warning btn-xs rounded-xl font-semibold gap-1 text-[10px] shadow-sm w-full mt-1"
                  onclick={() => schemaState.syncMissingWranglerBindings()}
                >
                  ⚡ Fix & Sync to Wrangler Config
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Right Side: Stats & Coordinates -->
  <div class="flex items-center gap-3">
    {#if (schemaState.filePath || schemaState.isSandboxMode) && stats.total > 0}
      <!-- Quick Entity Count + Popover wrapper -->
      <div class="relative group flex items-center gap-2 cursor-help py-0.5">
        <div class="flex items-center gap-1.5">
          <!-- D1 filter button -->
          <button
            onclick={() =>
              (schemaState.activeFilter =
                schemaState.activeFilter === "d1" ? null : "d1")}
            class="flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all hover:bg-base-200/80 cursor-pointer {schemaState.activeFilter ===
            'd1'
              ? 'text-primary font-bold bg-primary/10'
              : 'text-base-content/75'}"
            title="Filter D1 Tables"
          >
            <Database class="w-3 h-3" />
            <span>{stats.d1} D1</span>
          </button>

          {#if stats.do > 0}
            <span class="opacity-30">•</span>
            <!-- DO filter button -->
            <button
              onclick={() =>
                (schemaState.activeFilter =
                  schemaState.activeFilter === "do" ? null : "do")}
              class="flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all hover:bg-base-200/80 cursor-pointer {schemaState.activeFilter ===
              'do'
                ? 'text-secondary font-bold bg-secondary/10'
                : 'text-base-content/75'}"
              title="Filter Durable Objects"
            >
              <Cpu class="w-3 h-3" />
              <span>{stats.do} DO</span>
            </button>
          {/if}

          {#if stats.kv > 0}
            <span class="opacity-30">•</span>
            <!-- KV filter button -->
            <button
              onclick={() =>
                (schemaState.activeFilter =
                  schemaState.activeFilter === "kv" ? null : "kv")}
              class="flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all hover:bg-base-200/80 cursor-pointer {schemaState.activeFilter ===
              'kv'
                ? 'text-accent font-bold bg-accent/10'
                : 'text-base-content/75'}"
              title="Filter KV Namespaces"
            >
              <Zap class="w-3 h-3" />
              <span>{stats.kv} KV</span>
            </button>
          {/if}

          <span class="opacity-30">•</span>
          <div class="flex items-center gap-0.5 text-base-content/65 px-1">
            <Layers class="w-3 h-3 text-base-content/60" />
            <span>{stats.relations} Rel</span>
          </div>
        </div>

        <!-- Detail Stats Popover -->
        <div
          class="absolute bottom-7 right-0 w-52 p-4 bg-base-100 border border-base-300/80 rounded-2xl shadow-2xl opacity-0 scale-95 translate-y-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 pointer-events-none transition-all duration-200 z-50 origin-bottom-right flex flex-col gap-2.5 backdrop-blur-md text-[11px] font-sans"
        >
          <div
            class="flex items-center gap-1.5 border-b border-base-300/60 pb-1.5"
          >
            <Layers class="w-3.5 h-3.5 text-primary" />
            <span
              class="font-bold text-xs text-base-content uppercase tracking-wider"
              >Schema Stats</span
            >
          </div>

          <div class="flex flex-col gap-1.5 font-mono text-[10px]">
            <div class="flex items-center justify-between">
              <span class="opacity-60">Total Entities</span>
              <span class="font-bold text-base-content">{stats.total}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="opacity-60">Total Fields</span>
              <span class="font-bold text-base-content">{stats.columns}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="opacity-60">Active Edges</span>
              <span class="font-bold text-primary">{stats.relations}</span>
            </div>
            {#if schemaState.activeCoordinates}
              <div
                class="flex items-center justify-between border-t border-base-300/40 pt-1.5 mt-0.5"
              >
                <span class="opacity-60 flex-1">Coordinates</span>
                <span
                  class="font-bold text-secondary truncate max-w-25 text-right"
                >
                  {Math.round(schemaState.activeCoordinates.x)}, {Math.round(
                    schemaState.activeCoordinates.y,
                  )}
                </span>
              </div>
            {/if}
          </div>

          <div
            class="text-[9px] text-base-content/40 leading-normal border-t border-base-300/40 pt-1.5"
          >
            <Lightbulb class="w-8 h-8 text-info/85 mt-0.5" /> Click database tags
            to isolate node types in the canvas.
          </div>
        </div>
      </div>
    {/if}

    <!-- Coordinates (shown when dragging/hovering/selecting in diagram) -->
    {#if schemaState.activeCoordinates}
      <div class="h-3 w-px bg-base-300/80"></div>
      <div class="flex items-center gap-1 opacity-80">
        <Layers class="w-3 h-3 text-secondary" />
        <span
          >X: {Math.round(schemaState.activeCoordinates.x)} Y: {Math.round(
            schemaState.activeCoordinates.y,
          )}</span
        >
      </div>
    {/if}

    <!-- Application Version Badge -->
    <div class="h-3 w-px bg-base-300/80"></div>
    <span
      class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold"
      title="Strata App Version">v3.0.6</span
    >
  </div>
</div>
