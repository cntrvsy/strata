<!--
  NewD1TableForm.svelte

  Summary: Dedicated form for creating new Cloudflare D1 / Drizzle tables with schema presets, live slugification, and syntax preview.
  Expects: onClose callback.
  Output: Calls schemaState.addTable with configured presets and modular destination.
-->
<script lang="ts">
  import { Database, FileCode, Sparkles, TriangleAlert, Check, Code, ArrowRight } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { slugifyIdentifier, isJsReservedKeyword } from "#lib/schemas";
  import { generateD1TableColumns } from "#lib/parser/mutators";

  let { onClose }: { onClose: () => void } = $props();

  let rawName = $state("");
  let autoSlug = $state(true);

  // Table presets
  let primaryKeyStyle = $state<"autoIncrement" | "uuid">("autoIncrement");
  let enableTimestamps = $state(true);
  let enableSoftDelete = $state(false);

  // Modular file destination
  let destMode = $state<"new" | "existing" | "root">("new");
  let customFileName = $state("");
  let selectedExistingModule = $state("");

  // Derived sanitized table name
  const tableName = $derived.by(() => {
    const trimmed = rawName.trim();
    if (!trimmed) return "";
    return autoSlug ? slugifyIdentifier(trimmed) : trimmed;
  });

  const isReserved = $derived(isJsReservedKeyword(tableName));

  const isDuplicateName = $derived(
    Boolean(tableName && schemaState.nodes.some(
      (n) => n.id.toLowerCase() === tableName.toLowerCase()
    ))
  );

  const isValid = $derived(
    tableName.length > 0 && !isDuplicateName && !isReserved
  );

  // Target modular file name
  const targetFileName = $derived(
    customFileName.trim() ||
      (tableName ? `${tableName}.ts` : "new_module.ts")
  );

  // Auto-select first existing module if available
  $effect(() => {
    if (!selectedExistingModule && schemaState.availableModules.length > 0) {
      selectedExistingModule = schemaState.availableModules[0].filePath;
    }
  });

  // Generated code preview
  const generatedPreview = $derived.by(() => {
    const name = tableName || "my_table";
    const { code } = generateD1TableColumns(name, {
      primaryKey: primaryKeyStyle,
      timestamps: enableTimestamps,
      softDelete: enableSoftDelete
    });
    return `export const ${name} = sqliteTable("${name}", {\n${code}\n});`;
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!isValid) return;

    const presets = {
      primaryKey: primaryKeyStyle,
      timestamps: enableTimestamps,
      softDelete: enableSoftDelete
    };

    const moduleDest = schemaState.isModular
      ? {
          mode: destMode,
          targetModule:
            destMode === "new"
              ? targetFileName
              : destMode === "existing"
                ? selectedExistingModule
                : undefined,
        }
      : undefined;

    await schemaState.addTable(
      tableName,
      "d1",
      { presets },
      moduleDest
    );

    onClose();
  }
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-4">
  <!-- Table Name Field with Live Slugify -->
  <fieldset class="fieldset gap-1.5 p-0">
    <div class="flex items-center justify-between">
      <legend class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60">
        Table Name
      </legend>
      <label class="flex items-center gap-1.5 cursor-pointer text-[10px] opacity-70 hover:opacity-100 transition-opacity">
        <input
          type="checkbox"
          bind:checked={autoSlug}
          class="checkbox checkbox-xs checkbox-primary rounded-sm"
        />
        <span>Auto-slugify</span>
      </label>
    </div>

    <div class="relative">
      <input
        type="text"
        bind:value={rawName}
        placeholder="e.g. user_profiles or User Profiles"
        class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-primary transition-all font-mono text-sm {isDuplicateName || isReserved ? 'input-error' : ''}"
      />
    </div>

    {#if rawName.trim() && autoSlug && rawName.trim() !== tableName}
      <div class="flex items-center gap-1 text-[11px] text-primary/90 font-mono mt-0.5">
        <Sparkles class="w-3 h-3 shrink-0" />
        <span>Identifier: <strong>{tableName}</strong></span>
      </div>
    {/if}

    {#if isDuplicateName}
      <div class="flex items-center gap-1.5 text-[11px] text-error mt-1 font-semibold">
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
        <span>A table or entity named "{tableName}" already exists.</span>
      </div>
    {:else if isReserved}
      <div class="flex items-center gap-1.5 text-[11px] text-error mt-1 font-semibold">
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
        <span>"{tableName}" is a reserved JavaScript keyword.</span>
      </div>
    {/if}
  </fieldset>

  <!-- Architectural Presets -->
  <div class="p-3.5 bg-base-200/50 border border-base-300/80 rounded-box flex flex-col gap-3">
    <span class="text-[10px] font-bold opacity-65 uppercase tracking-wider flex items-center gap-1.5">
      <Sparkles class="w-3.5 h-3.5 text-primary" />
      Schema Presets & Defaults
    </span>

    <!-- Primary Key Style -->
    <div class="flex flex-col gap-1.5">
      <span class="text-[10px] font-semibold opacity-70">Primary Key</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="btn btn-xs h-8 justify-start px-2.5 rounded-lg border transition-all {primaryKeyStyle === 'autoIncrement' ? 'btn-primary font-bold shadow-xs' : 'btn-ghost border-base-300/80 opacity-70'}"
          onclick={() => (primaryKeyStyle = "autoIncrement")}
        >
          <div class="flex flex-col items-start leading-tight">
            <span class="text-[11px]">Auto-Increment ID</span>
            <span class="text-[8.5px] opacity-70 font-mono">integer("id")</span>
          </div>
        </button>

        <button
          type="button"
          class="btn btn-xs h-8 justify-start px-2.5 rounded-lg border transition-all {primaryKeyStyle === 'uuid' ? 'btn-primary font-bold shadow-xs' : 'btn-ghost border-base-300/80 opacity-70'}"
          onclick={() => (primaryKeyStyle = "uuid")}
        >
          <div class="flex flex-col items-start leading-tight">
            <span class="text-[11px]">UUID Text ID</span>
            <span class="text-[8.5px] opacity-70 font-mono">crypto.randomUUID()</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Toggles: Timestamps & Soft Delete -->
    <div class="grid grid-cols-2 gap-2 pt-1 border-t border-base-300/40">
      <label class="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-base-300/30 transition-colors">
        <input
          type="checkbox"
          bind:checked={enableTimestamps}
          class="checkbox checkbox-xs checkbox-primary rounded-sm"
        />
        <div class="flex flex-col">
          <span class="text-[11px] font-semibold">Timestamps</span>
          <span class="text-[9px] opacity-60">createdAt & updatedAt</span>
        </div>
      </label>

      <label class="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-base-300/30 transition-colors">
        <input
          type="checkbox"
          bind:checked={enableSoftDelete}
          class="checkbox checkbox-xs checkbox-primary rounded-sm"
        />
        <div class="flex flex-col">
          <span class="text-[11px] font-semibold">Soft Delete</span>
          <span class="text-[9px] opacity-60">nullable deletedAt</span>
        </div>
      </label>
    </div>
  </div>

  <!-- Modular Target Destination Selection (If modular project) -->
  {#if schemaState.isModular}
    <div class="p-3.5 bg-base-200/50 border border-base-300/80 rounded-box flex flex-col gap-2.5">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold opacity-65 uppercase tracking-wider flex items-center gap-1.5">
          <FileCode class="w-3.5 h-3.5 text-primary" />
          Module Destination
        </span>
        <span class="badge badge-xs badge-primary badge-outline font-mono">Modular Setup</span>
      </div>

      <div class="grid grid-cols-3 gap-1.5 p-1 bg-base-300/40 rounded-lg">
        <button
          type="button"
          class="btn btn-xs {destMode === 'new' ? 'btn-primary font-bold shadow-xs' : 'btn-ghost opacity-70'}"
          onclick={() => (destMode = "new")}
        >
          New File
        </button>
        <button
          type="button"
          class="btn btn-xs {destMode === 'existing' ? 'btn-primary font-bold shadow-xs' : 'btn-ghost opacity-70'} {!schemaState.availableModules.length ? 'opacity-30 cursor-not-allowed' : ''}"
          disabled={!schemaState.availableModules.length}
          onclick={() => (destMode = "existing")}
        >
          Existing File
        </button>
        <button
          type="button"
          class="btn btn-xs {destMode === 'root' ? 'btn-primary font-bold shadow-xs' : 'btn-ghost opacity-70'}"
          onclick={() => (destMode = "root")}
        >
          Root Barrel
        </button>
      </div>

      {#if destMode === "new"}
        <fieldset class="fieldset gap-1 p-0">
          <legend class="fieldset-legend text-[9.5px] font-bold opacity-60 uppercase">
            Module File Name
          </legend>
          <input
            type="text"
            bind:value={customFileName}
            placeholder={targetFileName}
            class="input input-xs input-bordered w-full rounded-field bg-base-100/60 border-base-300/60 font-mono text-xs focus:input-primary"
          />
          <p class="text-[9.5px] opacity-60 mt-0.5 leading-tight">
            Creates <span class="font-mono text-primary font-bold">{targetFileName}</span> and re-exports in root barrel.
          </p>
        </fieldset>
      {:else if destMode === "existing" && schemaState.availableModules.length > 0}
        <fieldset class="fieldset gap-1 p-0">
          <legend class="fieldset-legend text-[9.5px] font-bold opacity-60 uppercase">
            Select Domain Module
          </legend>
          <select
            bind:value={selectedExistingModule}
            class="select select-xs select-bordered w-full rounded-field bg-base-100/60 border-base-300/60 font-mono text-xs focus:select-primary"
          >
            {#each schemaState.availableModules as mod}
              <option value={mod.filePath}>{mod.name}</option>
            {/each}
          </select>
        </fieldset>
      {:else}
        <p class="text-[10px] opacity-60 leading-relaxed">
          Appends table directly into root schema.
        </p>
      {/if}
    </div>
  {/if}

  <!-- Live Syntax Preview -->
  <div class="p-3 bg-neutral/90 text-neutral-content rounded-box flex flex-col gap-1.5 shadow-inner">
    <div class="flex items-center justify-between text-[10px] opacity-60 font-mono">
      <span class="flex items-center gap-1">
        <Code class="w-3 h-3 text-primary" />
        Drizzle Schema Preview
      </span>
      <span>SQLite / D1</span>
    </div>
    <pre class="font-mono text-[11px] leading-relaxed text-base-100 overflow-x-auto whitespace-pre p-1"><code>{generatedPreview}</code></pre>
  </div>

  <!-- Action Buttons -->
  <div class="mt-2 flex items-center justify-end gap-2">
    <button
      type="button"
      class="btn btn-sm btn-ghost rounded-field text-xs"
      onclick={onClose}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="btn btn-sm btn-primary rounded-field text-xs font-bold shadow-sm"
      disabled={!isValid}
    >
      <span>Create Table</span>
      <ArrowRight class="w-3.5 h-3.5" />
    </button>
  </div>
</form>
