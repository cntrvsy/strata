<!--
  PackageWrapperEmptyState.svelte

  Summary: Clean, guided canvas card displayed when an opened file is a package entrypoint re-exporting schema barrels rather than declaring Drizzle tables directly.
  Expects: None (reads schemaState.packageWrapperInfo).
  Output: 1-click action buttons to switch to the underlying schema barrel or ingest drizzle.config.ts.
-->
<script lang="ts">
  import { schemaState } from "#lib/state";
  import { Package, ArrowRight, FileCode, SlidersHorizontal, FolderOpen } from "lucide-svelte";

  const info = $derived(schemaState.packageWrapperInfo);
  const currentFileName = $derived(
    schemaState.filePath ? schemaState.filePath.split(/[/\\]/).pop() : "index.ts"
  );
</script>

{#if info}
  <div
    class="absolute inset-0 z-40 flex items-center justify-center p-6 bg-base-100/40 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200"
    data-testid="package-wrapper-empty-state"
  >
    <div
      class="max-w-md w-full p-6 bg-base-100 border border-base-300 rounded-2xl shadow-2xl flex flex-col gap-4 text-center items-center"
    >
      <div
        class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner"
      >
        <Package class="w-6 h-6" />
      </div>

      <div class="flex flex-col gap-1.5">
        <h3 class="text-base font-bold text-base-content tracking-tight">
          Package Entrypoint Detected
        </h3>
        <p class="text-xs text-base-content/70 leading-relaxed max-w-sm">
          <span class="font-mono text-primary font-semibold">{currentFileName}</span>
          serves as a library export wrapper and contains 0 direct table definitions.
        </p>
      </div>

      {#if info.candidateSchemaPath}
        <div
          class="w-full p-3.5 bg-base-200/60 border border-base-300/80 rounded-xl text-left flex flex-col gap-2 text-xs"
        >
          <div class="flex items-center justify-between text-base-content/60 text-[11px] font-semibold uppercase tracking-wider">
            <span class="flex items-center gap-1.5">
              <FileCode class="w-3.5 h-3.5 text-primary" />
              <span>Target Schema Barrel</span>
            </span>
            <span class="badge badge-xs badge-primary badge-outline font-mono">
              Barrel Root
            </span>
          </div>
          <div class="font-mono text-[11.5px] text-base-content font-medium truncate" title={info.candidateSchemaPath}>
            {info.candidateSchemaPath.split(/[/\\]/).slice(-3).join('/')}
          </div>
          {#if info.reExports.length > 0}
            <div class="text-[10.5px] text-base-content/60 truncate">
              Exports: <span class="font-mono text-base-content/80">{info.reExports.slice(0, 3).join(', ')}{info.reExports.length > 3 ? '...' : ''}</span>
            </div>
          {/if}
        </div>
      {/if}

      <div class="w-full flex flex-col gap-2 mt-1">
        {#if info.candidateSchemaPath}
          <button
            class="btn btn-primary btn-sm w-full gap-2 font-bold shadow-md rounded-xl h-9 min-h-9"
            onclick={() => schemaState.openFileDirectly(info.candidateSchemaPath!)}
          >
            <span>Switch to Schema Barrel</span>
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        {/if}

        {#if info.drizzleConfigPath}
          <button
            class="btn btn-neutral btn-outline btn-sm w-full gap-2 font-semibold rounded-xl h-9 min-h-9 text-xs"
            onclick={() => schemaState.openFileDirectly(info.drizzleConfigPath!)}
          >
            <SlidersHorizontal class="w-3.5 h-3.5" />
            <span>Ingest Drizzle Config</span>
          </button>
        {/if}

        <button
          class="btn btn-ghost btn-xs text-[11px] text-base-content/60 hover:text-base-content mt-1 gap-1.5"
          onclick={() => schemaState.openNewFile()}
        >
          <FolderOpen class="w-3 h-3" />
          <span>Open Different Schema...</span>
        </button>
      </div>
    </div>
  </div>
{/if}
