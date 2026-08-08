<!--
  DOInspector.svelte

  Summary: Sub-inspector displaying and mutating Durable Object class bindings, TS source paths, wrangler configuration status, and public RPC methods.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
-->
<script lang="ts">
  import {
    Pencil,
    Trash2,
    Check,
    FileCode,
    TriangleAlert,
    Cpu,
    Layers,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  let editingColumnName = $state<string | null>(null);
  let newColumnName = $state("");

  let editingClass = $state(false);
  let newClassName = $state("");

  let editingPath = $state(false);
  let newPathName = $state("");

  const strataData = $derived(data.strata || {});
  const doClassName = $derived(strataData.class || data.doClass || tableName);
  const doPathName = $derived(strataData.path || data.doPath || "");
  const missingWarning = $derived(strataData.missingFileWarning);

  const wranglerBinding = $derived(
    schemaState.wranglerBindings.find(
      (b) =>
        (b.name === tableName || b.name === strataData.binding) &&
        b.type === "do",
    ),
  );

  async function submitRenameColumn() {
    if (!editingColumnName || !newColumnName.trim()) return;
    await schemaState.renameColumn(
      tableName,
      editingColumnName,
      newColumnName.trim(),
    );
    editingColumnName = null;
  }

  async function deleteColumn(colName: string) {
    await schemaState.deleteColumn(tableName, colName);
  }

  async function saveClassMetadata() {
    if (!newClassName.trim() || isReadOnly) return;
    await schemaState.updateTableMetadata(tableName, {
      class: newClassName.trim(),
      path: doPathName,
    });
    editingClass = false;
  }

  async function savePathMetadata() {
    if (isReadOnly) return;
    await schemaState.updateTableMetadata(tableName, {
      class: doClassName,
      path: newPathName.trim(),
    });
    editingPath = false;
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Class & Wrangler Binding Configuration Card -->
  <div
    class="bg-base-200/50 p-4 rounded-2xl border border-base-300/70 flex flex-col gap-3"
  >
    <div class="flex items-center justify-between">
      <span class="text-[9px] font-black uppercase tracking-widest opacity-40">
        Class & Binding Details
      </span>
      <div class="flex items-center gap-1.5">
        {#if wranglerBinding}
          <span
            class="badge badge-xs bg-secondary/10 text-secondary border-secondary/20 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono"
            title="Bound in wrangler configuration file"
          >
            WRANGLER BOUND
          </span>
        {:else if schemaState.wranglerConfigFilePath}
          <button
            class="badge badge-xs bg-warning/10 text-warning border-warning/20 hover:bg-warning/20 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition-all cursor-pointer"
            onclick={() => schemaState.syncMissingWranglerBindings()}
            title="Click to sync missing binding(s) to wrangler config"
          >
            + WRANGLER BINDING
          </button>
        {/if}
      </div>
    </div>

    <!-- Class Name Row -->
    <div class="flex flex-col gap-1">
      <label
        for="do-class-input-{tableName}"
        class="text-[9px] font-bold uppercase opacity-40"
      >
        TypeScript Class Name
      </label>
      {#if editingClass}
        <div class="flex items-center gap-1">
          <input
            id="do-class-input-{tableName}"
            bind:value={newClassName}
            class="input input-xs input-bordered w-full rounded-lg bg-base-100 font-mono text-xs focus:input-secondary transition-all"
            onkeydown={(e) => e.key === "Enter" && saveClassMetadata()}
          />
          <button
            class="btn btn-secondary btn-xs btn-circle shrink-0"
            onclick={saveClassMetadata}
          >
            <Check class="w-3 h-3 text-secondary-content" />
          </button>
        </div>
      {:else}
        <div class="flex items-center justify-between group/class-row">
          <div class="flex items-center gap-2">
            <Cpu class="w-3.5 h-3.5 text-secondary opacity-80" />
            <span class="font-mono text-xs font-bold text-base-content/90">
              {doClassName}
            </span>
          </div>
          {#if !isReadOnly}
            <button
              class="opacity-0 group-hover/class-row:opacity-100 btn btn-ghost btn-xs btn-circle h-4.5 w-4.5 hover:bg-base-200 transition-all"
              onclick={() => {
                newClassName = doClassName;
                editingClass = true;
              }}
              title="Edit DO Class Name"
            >
              <Pencil class="w-2.5 h-2.5 opacity-60" />
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- File Path Row -->
    <div class="flex flex-col gap-1 border-t border-base-300/40 pt-2">
      <label
        for="do-path-input-{tableName}"
        class="text-[9px] font-bold uppercase opacity-40"
      >
        Class Source File Path
      </label>
      {#if editingPath}
        <div class="flex items-center gap-1">
          <input
            id="do-path-input-{tableName}"
            bind:value={newPathName}
            placeholder="e.g. ./src/Counter.ts"
            class="input input-xs input-bordered w-full rounded-lg bg-base-100 font-mono text-xs focus:input-secondary transition-all"
            onkeydown={(e) => e.key === "Enter" && savePathMetadata()}
          />
          <button
            class="btn btn-secondary btn-xs btn-circle shrink-0"
            onclick={savePathMetadata}
          >
            <Check class="w-3 h-3 text-secondary-content" />
          </button>
        </div>
      {:else}
        <div class="flex items-center justify-between group/path-row">
          <div class="flex items-center gap-2 min-w-0">
            <FileCode class="w-3.5 h-3.5 text-base-content/50 shrink-0" />
            <span
              class="font-mono text-[11px] text-base-content/70 truncate"
              title={doPathName || "No file path defined"}
            >
              {doPathName || "(In-memory / JSDoc methods fallback)"}
            </span>
          </div>
          {#if !isReadOnly}
            <button
              class="opacity-0 group-hover/path-row:opacity-100 btn btn-ghost btn-xs btn-circle h-4.5 w-4.5 hover:bg-base-200 transition-all shrink-0"
              onclick={() => {
                newPathName = doPathName;
                editingPath = true;
              }}
              title="Edit TS File Path"
            >
              <Pencil class="w-2.5 h-2.5 opacity-60" />
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Missing File Warning Banner -->
  {#if missingWarning}
    <div
      class="p-3 bg-warning/10 border border-warning/20 rounded-2xl text-[11px] text-base-content/90 flex items-start gap-2.5 leading-relaxed"
    >
      <TriangleAlert class="w-4 h-4 text-warning shrink-0 mt-0.5" />
      <div class="flex flex-col gap-0.5">
        <span class="font-bold text-xs text-warning">Source File Warning</span>
        <span>{missingWarning}</span>
      </div>
    </div>
  {/if}

  <!-- Methods Header -->
  <div class="flex items-center justify-between px-1">
    <span class="text-[9px] font-black uppercase tracking-widest opacity-40">
      Public RPC Methods ({data.columns.length})
    </span>
  </div>

  <!-- Methods List -->
  <div class="flex flex-col gap-2">
    {#if data.columns.length === 0}
      <div
        class="p-6 bg-base-200/30 border border-base-300/40 rounded-2xl flex flex-col items-center justify-center text-center gap-2"
      >
        <Layers class="w-6 h-6 opacity-30 text-secondary" />
        <span class="text-xs font-semibold opacity-70">
          No Public Methods Detected
        </span>
        <p class="text-[10px] text-base-content/50 max-w-60 leading-relaxed">
          Public class methods in <code class="font-mono text-secondary"
            >{doClassName}</code
          > are parsed automatically when a valid source file path is provided.
        </p>
      </div>
    {:else}
      {#each data.columns as col}
        <div
          class="bg-base-200/50 p-3 rounded-xl flex flex-col gap-1.5 border border-base-300 hover:border-secondary/40 transition-all group/field"
          data-testid="field-row-{col.name}"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 grow min-w-0">
              {#if editingColumnName === col.name}
                <div class="flex items-center gap-1 grow">
                  <input
                    bind:value={newColumnName}
                    class="input input-xs input-bordered w-full rounded-lg font-mono text-xs h-7 bg-base-100 border-base-300 text-base-content focus:input-secondary transition-all"
                    onkeydown={(e) => e.key === "Enter" && submitRenameColumn()}
                    data-testid="field-rename-input-{col.name}"
                  />
                  <button
                    class="btn btn-secondary btn-xs btn-circle shrink-0"
                    onclick={submitRenameColumn}
                    data-testid="field-rename-submit-{col.name}"
                  >
                    <Check class="w-3 h-3 text-secondary-content" />
                  </button>
                </div>
              {:else}
                <div
                  class="flex items-center gap-2 group/col-title min-w-0 grow flex-wrap"
                >
                  <span
                    class="font-mono text-xs font-bold text-secondary break-all leading-tight group-hover/field:text-primary transition-colors"
                    title={col.name}
                    data-testid="field-name-{col.name}"
                  >
                    {col.name}
                  </span>
                  {#if !isReadOnly}
                    <button
                      class="opacity-40 group-hover/col-title:opacity-100 transition-all btn btn-ghost btn-xs btn-circle h-4.5 w-4.5 hover:bg-base-200 shrink-0"
                      onclick={() => {
                        editingColumnName = col.name;
                        newColumnName = col.name;
                      }}
                      title="Edit Method Signature"
                      data-testid="field-rename-btn-{col.name}"
                    >
                      <Pencil class="w-2.5 h-2.5 text-base-content" />
                    </button>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <span
                class="text-[9px] font-mono bg-secondary/10 text-secondary border border-secondary/20 px-1.5 py-0.5 rounded leading-none font-bold"
              >
                {col.definition}
              </span>
              {#if !isReadOnly}
                <button
                  class="opacity-40 group-hover/field:opacity-100 btn btn-ghost btn-xs btn-circle text-error/80 hover:text-error hover:bg-error/10 transition-all"
                  onclick={() => deleteColumn(col.name)}
                  title="Delete Method"
                  data-testid="field-delete-btn-{col.name}"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
