<!--
  D1Inspector.svelte

  Summary: High-clarity read-only architectural telemetry viewer for D1 SQLite table columns.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
  Output: Clean visual column breakdown with types, keys, and constraint badges.
-->
<script lang="ts">
  import { Key, Link } from "lucide-svelte";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  const columns = $derived(data?.columns || []);
</script>

<div class="flex flex-col gap-2">
  {#if columns.length === 0}
    <div class="p-4 text-center text-xs text-base-content/60 font-mono">
      No columns defined for {tableName}
    </div>
  {:else}
    {#each columns as col}
      {@const typeName = col.definition ? col.definition.split("(")[0] : "text"}
      <div
        class="bg-base-200/40 p-3 rounded-box flex flex-col gap-2 border border-base-300/40 hover:border-base-300/80 transition-all group/field"
        data-testid="field-row-{col.name}"
      >
        <!-- Top Row: Column Name & Data Type -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            {#if col.isPk}
              <div class="p-1 rounded bg-warning/15 text-warning shrink-0" title="Primary Key">
                <Key class="w-3 h-3" />
              </div>
            {/if}
            <span
              class="font-mono font-bold text-xs text-base-content group-hover/field:text-primary transition-colors truncate"
              data-testid="field-name-{col.name}"
            >
              {col.name}
            </span>
          </div>

          <span
            class="badge badge-sm badge-ghost font-mono text-[9px] uppercase px-2 py-0.5 rounded border border-base-300/60 font-bold shrink-0 text-base-content/80"
          >
            {typeName}
          </span>
        </div>

        <!-- Badges / Metadata Row -->
        <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
          {#if col.isPk}
            <span class="badge badge-warning badge-xs font-mono font-bold text-[9px] gap-1 px-1.5 py-0.5">
              PK
            </span>
          {/if}

          {#if col.notNull}
            <span class="badge badge-neutral badge-xs font-mono text-[9px] opacity-75 px-1.5 py-0.5" title="NOT NULL constraint">
              Not Null
            </span>
          {:else}
            <span class="badge badge-ghost badge-xs font-mono text-[9px] opacity-50 px-1.5 py-0.5" title="Nullable column">
              Nullable
            </span>
          {/if}

          {#if col.isReferences}
            <span class="badge badge-secondary badge-xs font-mono text-[9px] font-semibold gap-1 px-1.5 py-0.5" title="Foreign Key Reference">
              <Link class="w-2.5 h-2.5" />
              FK
            </span>
          {/if}

          {#if col.defaultVal !== undefined && col.defaultVal !== null && col.defaultVal !== ""}
            <span class="px-1.5 py-0.5 rounded bg-base-300/40 text-[9px] font-mono text-base-content/70 border border-base-300/50 truncate max-w-full">
              default: <span class="text-primary font-semibold">{col.defaultVal}</span>
            </span>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>
