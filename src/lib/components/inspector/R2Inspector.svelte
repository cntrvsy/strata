<!--
  R2Inspector.svelte

  Summary: Clean read-only telemetry viewer for Cloudflare R2 bucket configurations and prefixes.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
  Output: Bucket settings, public access, custom domain, and folder prefixes breakdown.
-->
<script lang="ts">
  import { HardDrive, Globe, ShieldCheck, Folder } from "lucide-svelte";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  const isPublic = $derived(data.strata?.public || false);
  const customDomain = $derived(data.strata?.customDomain || "");
  const cors = $derived(data.strata?.cors || false);
  const columns = $derived(data?.columns || []);
</script>

<!-- Cloudflare Worker Binding Read-Only Overlay Banner -->
<div class="px-3 py-2 bg-info/10 border border-info/20 rounded-box flex items-center justify-between text-[11px] mb-4">
  <span class="font-bold text-info">Cloudflare R2 Bucket</span>
  <span class="text-[10px] opacity-70 font-mono">wrangler.jsonc</span>
</div>

<!-- R2 Bucket Configurations Card -->
<div
  class="bg-base-200/50 p-4 rounded-box border border-base-300 flex flex-col gap-3 mb-4"
>
  <div class="flex items-center justify-between">
    <span class="text-[9px] font-black uppercase tracking-widest opacity-40"
      >Bucket Settings</span
    >
    <div class="flex gap-1">
      {#if isPublic}
        <span
          class="badge badge-xs bg-info/10 text-info border-info/20 px-1 py-0.5 rounded text-[8px] font-bold"
          >PUBLIC</span
        >
      {/if}
      {#if cors}
        <span
          class="badge badge-xs bg-success/10 text-success border-success/20 px-1 py-0.5 rounded text-[8px] font-bold"
          >CORS</span
        >
      {/if}
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <div class="p-2.5 rounded-box bg-info/10 border border-info/20 text-info flex flex-col gap-0.5 text-[10px]">
      <span class="font-bold uppercase tracking-wider text-[9.5px]">Cloudflare R2 Object Storage Bucket</span>
      <span class="text-base-content/75 font-mono text-[9px]">Worker Access: env.{tableName}.get(key)</span>
    </div>

    {#if data.strata?.bucket_name}
      <div class="flex items-center justify-between p-2 rounded-field bg-base-100/50 border border-base-300/60 text-xs">
        <span class="text-xs font-semibold text-base-content/85">Bucket Name</span>
        <span class="font-mono text-[11px] text-info font-bold">{data.strata.bucket_name}</span>
      </div>
    {/if}

    <div class="flex items-center justify-between p-2 rounded-field bg-base-100/50 border border-base-300/60 text-xs">
      <span class="text-xs font-semibold text-base-content/85">Access Mode</span>
      <span class="badge badge-sm {isPublic ? 'badge-info' : 'badge-ghost'} font-mono text-[10px] font-bold">
        {isPublic ? "Public Bucket" : "Private (Worker Only)"}
      </span>
    </div>

    {#if isPublic && customDomain}
      <div class="flex items-center justify-between p-2 rounded-field bg-base-100/50 border border-base-300/60 text-xs">
        <span class="text-xs font-semibold text-base-content/85">Custom Domain</span>
        <span class="font-mono text-[11px] text-info font-bold">{customDomain}</span>
      </div>
    {/if}

    <div class="flex items-center justify-between p-2 rounded-field bg-base-100/50 border border-base-300/60 text-xs">
      <span class="text-xs font-semibold text-base-content/85">CORS Rules</span>
      <span class="badge badge-xs {cors ? 'badge-success' : 'badge-ghost'} font-mono text-[9px]">
        {cors ? "Enabled" : "Disabled"}
      </span>
    </div>
  </div>
</div>

<!-- Folders / Directory list -->
<div class="flex flex-col gap-2">
  <span class="text-[9px] font-black uppercase tracking-widest opacity-40 px-1"
    >Configured Folder Prefixes ({columns.length})</span
  >
  {#if columns.length === 0}
    <div class="p-4 text-center text-xs text-base-content/60 font-mono">
      No folder prefixes configured for {tableName}
    </div>
  {:else}
    {#each columns as col}
      <div
        class="bg-base-200/30 p-3 rounded-box flex items-center justify-between border border-base-300/30 hover:border-base-300/60 transition-all group/field"
        data-testid="field-row-{col.name}"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Folder class="w-3.5 h-3.5 text-info opacity-70 shrink-0" />
          <span
            class="font-mono text-xs font-bold group-hover/field:text-primary transition-colors text-base-content/85 truncate"
            data-testid="field-name-{col.name}"
          >
            {col.name}
          </span>
        </div>

        <span
          class="text-[9px] font-mono opacity-90 uppercase bg-info/10 text-info px-1.5 py-0.5 rounded leading-none shrink-0 border border-info/20 font-bold"
        >
          {col.definition || "prefix"}
        </span>
      </div>
    {/each}
  {/if}
</div>

