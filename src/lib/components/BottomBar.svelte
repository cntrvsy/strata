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
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";

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
          class="w-1.5 h-1.5 rounded-full transition-all {!schemaState.filePath
            ? 'bg-warning'
            : !schemaState.isValid
              ? 'bg-error animate-ping'
              : schemaState.hasUnsavedChanges
                ? 'bg-warning animate-pulse'
                : 'bg-success'} shadow-[0_0_8px_currentColor] {!schemaState.filePath
            ? 'text-warning'
            : !schemaState.isValid
              ? 'text-error'
              : schemaState.hasUnsavedChanges
                ? 'text-warning'
                : 'text-success'}"
        ></div>
        <span class="font-bold text-base-content/75 uppercase tracking-wider">
          {!schemaState.filePath
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
              >Bi-Directional Engine</span
            >
            <span class="font-bold text-xs text-base-content"
              >Code ⇄ UI Synchronization</span
            >
          </div>
        </div>
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
            >• <strong>UI ➔ Disk:</strong> Canvas drags or visual modifications surgically
            patch the AST and write back in real-time.</span
          >
        </div>
        <div class="h-px bg-base-200/80 my-1"></div>
        <div
          class="flex items-center justify-between text-[9px] font-mono text-base-content/40"
        >
          <span>Drizzle ORM: v0.45.2</span>
        </div>
      </div>
    </div>

    <!-- Active File Path -->
    {#if schemaState.filePath}
      <div class="h-3 w-px bg-base-300/80"></div>
      <div
        class="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
      >
        <FileText class="w-3.5 h-3.5" />
        <span
          class="truncate max-w-[280px] sm:max-w-[450px]"
          title={schemaState.filePath}
        >
          {schemaState.filePath}
        </span>
      </div>
    {/if}
  </div>

  <!-- Right Side: Stats & Coordinates -->
  <div class="flex items-center gap-3">
    {#if schemaState.filePath && stats.total > 0}
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
                  class="font-bold text-secondary truncate max-w-[100px] text-right"
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
            💡 Click database tags to isolate node types in the canvas.
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
  </div>
</div>
