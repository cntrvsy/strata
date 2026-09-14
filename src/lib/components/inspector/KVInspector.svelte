<!--
  KVInspector.svelte

  Summary: Clean read-only telemetry viewer for Cloudflare KV namespaces and key patterns.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
  Output: Key patterns, types, TTL, and metadata breakdown.
-->
<script lang="ts">
  import { Zap, Clock, Tag } from "lucide-svelte";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  const columns = $derived(data?.columns || []);
</script>

<div class="flex flex-col gap-2">
  <div class="p-2.5 rounded-box bg-accent/10 border border-accent/20 text-accent flex items-center justify-between text-[10px] mb-1">
    <div class="flex flex-col gap-0.5">
      <span class="font-bold uppercase tracking-wider text-[9.5px]">Cloudflare KV Namespace</span>
      <span class="text-base-content/75 font-mono text-[9px]">Worker Access: env.{tableName}.get(key)</span>
    </div>
    <span class="text-[10px] opacity-70 font-mono">wrangler.jsonc</span>
  </div>

  {#if columns.length === 0}
    <div class="p-4 text-center text-xs text-base-content/60 font-mono">
      No key patterns mapped for {tableName}
    </div>
  {:else}
    {#each columns as col}
      <div
        class="bg-base-200/30 p-3 rounded-box flex flex-col gap-1.5 border border-base-300/30 hover:border-base-300/60 transition-all group/field"
        data-testid="field-row-{col.name}"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="font-mono font-bold text-xs text-base-content group-hover/field:text-accent transition-colors truncate"
              data-testid="field-name-{col.name}"
            >
              {col.name}
            </span>
          </div>

          <span
            class="text-[9px] font-mono opacity-80 uppercase bg-base-300/50 px-2 py-0.5 rounded border border-base-300/30 font-bold shrink-0 text-base-content/80"
          >
            {col.definition || "string"}
          </span>
        </div>

        {#if (col.ttl !== undefined && col.ttl !== null) || col.metadata}
          <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
            {#if col.ttl !== undefined && col.ttl !== null}
              <span
                class="badge badge-xs bg-info/10 text-info border-info/20 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono gap-1"
              >
                <Clock class="w-2.5 h-2.5" />
                TTL: {col.ttl}s
              </span>
            {/if}
            {#if col.metadata}
              <span
                class="badge badge-xs bg-success/10 text-success border-success/20 px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono gap-1 truncate max-w-40"
                title={col.metadata}
              >
                <Tag class="w-2.5 h-2.5" />
                {col.metadata}
              </span>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

