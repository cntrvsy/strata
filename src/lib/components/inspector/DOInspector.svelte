<!--
  DOInspector.svelte

  Summary: Sub-inspector displaying Durable Object class methods and public signatures.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
-->
<script lang="ts">
  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();
</script>

<div class="flex flex-col gap-2">
  <div class="p-3 bg-secondary/5 border border-secondary/15 rounded-2xl text-[11px] leading-relaxed mb-1 text-secondary-content/85">
    <span class="font-bold block mb-0.5">Durable Object Class Interface</span>
    Methods are parsed dynamically from the target Durable Object class file.
  </div>

  {#each data.columns as col}
    <div
      class="bg-base-200/40 p-3 rounded-2xl flex flex-col gap-1 border border-transparent hover:border-base-300 transition-all group"
    >
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs font-bold text-secondary truncate grow pr-2" title={col.name}>
          {col.name}
        </span>
        <span class="text-[9px] font-mono opacity-60 uppercase bg-secondary/10 text-secondary px-1.5 py-0.5 rounded leading-none shrink-0">
          {col.definition}
        </span>
      </div>
    </div>
  {/each}
</div>
