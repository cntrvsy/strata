<!--
  ConnectionModelerModal.svelte

  Summary: AST-driven dialog to model relationships when dropping edges between D1 tables.
  Expects: None (shares global schemaState).
  Output: Executes Foreign Key or Drizzle relations() mutation.
-->
<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { 
    X, 
    KeyRound, 
    GitCommit, 
    ArrowRight, 
    Database, 
    Check, 
    Plus,
    Code2
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { toast } from "svelte-sonner";

  type ConnectionStrategy = "fk" | "relations";
  let strategy = $state<ConnectionStrategy>("fk");

  const data = $derived(schemaState.connectionModelerData);
  const sourceTable = $derived(data?.source || "");
  const targetTable = $derived(data?.target || "");
  const sourceHandle = $derived(data?.sourceHandle || null);
  const targetHandle = $derived(data?.targetHandle || null);

  const sourceNode = $derived(schemaState.nodes.find((n) => n.id === sourceTable));
  const targetNode = $derived(schemaState.nodes.find((n) => n.id === targetTable));

  const sourceColumns = $derived<any[]>((sourceNode?.data as any)?.columns || []);
  const targetColumns = $derived<any[]>((targetNode?.data as any)?.columns || []);

  // FK Column configuration
  type FkMode = "existing" | "new";
  let fkMode = $state<FkMode>("existing");
  let selectedSourceCol = $state<string>("");
  let newColName = $state<string>("");
  let newColType = $state<string>("integer");
  let selectedTargetCol = $state<string>("id");
  let isSubmitting = $state(false);

  // Initialize fields whenever data changes
  $effect(() => {
    if (data && schemaState.showConnectionModelerModal) {
      strategy = "fk";
      
      // Auto-detect target column
      if (targetHandle && targetColumns.some((c) => c.name === targetHandle)) {
        selectedTargetCol = targetHandle;
      } else if (targetColumns.some((c) => c.name === "id")) {
        selectedTargetCol = "id";
      } else if (targetColumns.length > 0) {
        selectedTargetCol = targetColumns[0].name;
      } else {
        selectedTargetCol = "id";
      }

      // Auto-detect target column type for new column suggestion
      const targetColObj = targetColumns.find((c) => c.name === selectedTargetCol);
      if (targetColObj && targetColObj.definition?.toLowerCase().includes("text")) {
        newColType = "text";
      } else {
        newColType = "integer";
      }

      // Auto-detect source column
      const matchingCol = sourceHandle && sourceColumns.some((c) => c.name === sourceHandle)
        ? sourceHandle
        : sourceColumns.find(
            (c) =>
              c.name.toLowerCase() === `${targetTable.toLowerCase()}_id` ||
              c.name.toLowerCase() === `${targetTable.toLowerCase()}id`
          )?.name;

      if (matchingCol) {
        fkMode = "existing";
        selectedSourceCol = matchingCol;
      } else if (sourceColumns.length > 0) {
        // Check if there are non-PK columns available
        const nonPk = sourceColumns.filter((c) => !c.isPk);
        if (nonPk.length > 0) {
          fkMode = "existing";
          selectedSourceCol = nonPk[0].name;
        } else {
          fkMode = "new";
          selectedSourceCol = sourceColumns[0].name;
        }
      } else {
        fkMode = "new";
      }

      newColName = `${targetTable}Id`;
    }
  });

  function close() {
    schemaState.showConnectionModelerModal = false;
    schemaState.connectionModelerData = null;
    isSubmitting = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }

  async function handleApply() {
    if (!sourceTable || !targetTable || isSubmitting) return;
    isSubmitting = true;

    try {
      if (strategy === "fk") {
        if (fkMode === "existing") {
          if (!selectedSourceCol) {
            toast.error("Please select a source column for the foreign key.");
            isSubmitting = false;
            return;
          }
          await schemaState.addForeignKeyRelation(
            sourceTable,
            selectedSourceCol,
            targetTable,
            selectedTargetCol || "id"
          );
          toast.success("Foreign Key Linked", {
            description: `${sourceTable}.${selectedSourceCol} references ${targetTable}.${selectedTargetCol || "id"}.`
          });
        } else {
          const col = newColName.trim();
          if (!col) {
            toast.error("Please enter a column name.");
            isSubmitting = false;
            return;
          }
          await schemaState.addColumn(
            sourceTable,
            col,
            newColType,
            targetTable,
            selectedTargetCol || "id"
          );
          toast.success("Column & Foreign Key Created", {
            description: `Added "${col}" to ${sourceTable} referencing ${targetTable}.${selectedTargetCol || "id"}.`
          });
        }
      } else if (strategy === "relations") {
        await schemaState.addRelation(sourceTable, targetTable);
        toast.success("Drizzle Relations Created", {
          description: `Generated relations() block between ${sourceTable} and ${targetTable}.`
        });
      }
      close();
    } catch (err: any) {
      console.error("[Strata] Failed to apply connection:", err);
      toast.error("Connection Failed", {
        description: err?.message || String(err)
      });
      isSubmitting = false;
    }
  }
</script>

{#if schemaState.showConnectionModelerModal && data}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="fixed inset-0 z-150 flex items-center justify-center bg-neutral/60 backdrop-blur-md p-4"
    transition:fade={{ duration: 150 }}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={handleKeyDown}
  >
    <div
      class="bg-base-100 rounded-box w-full max-w-xl shadow-2xl border border-base-300 overflow-hidden flex flex-col font-sans"
      transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }}
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-base-200/90 border-b border-base-300 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-field text-primary">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base text-base-content tracking-tight">Model Relationship</h3>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="badge badge-sm badge-primary/15 text-primary border-primary/30 font-mono font-medium">
                {sourceTable}
              </span>
              <ArrowRight class="w-3.5 h-3.5 text-base-content/40" />
              <span class="badge badge-sm badge-secondary/15 text-secondary border-secondary/30 font-mono font-medium">
                {targetTable}
              </span>
            </div>
          </div>
        </div>
        <button
          class="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
          onclick={close}
          aria-label="Close dialog"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Strategy Selector Tabs -->
      <div class="p-6 flex flex-col gap-5">
        <div class="grid grid-cols-2 gap-2 bg-base-200/50 p-1 rounded-field border border-base-300/60">
          <button
            type="button"
            class="flex items-center justify-center gap-2 py-2 px-3 rounded-field text-xs font-semibold transition-all {strategy === 'fk'
              ? 'bg-base-100 text-primary shadow-sm border border-base-300/80'
              : 'text-base-content/70 hover:text-base-content'}"
            onclick={() => (strategy = "fk")}
          >
            <KeyRound class="w-3.5 h-3.5" />
            <span>Foreign Key (.references)</span>
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-2 py-2 px-3 rounded-field text-xs font-semibold transition-all {strategy === 'relations'
              ? 'bg-base-100 text-secondary shadow-sm border border-base-300/80'
              : 'text-base-content/70 hover:text-base-content'}"
            onclick={() => (strategy = "relations")}
          >
            <GitCommit class="w-3.5 h-3.5" />
            <span>Drizzle Relations ()</span>
          </button>
        </div>

        <!-- Strategy 1: Physical Foreign Key -->
        {#if strategy === "fk"}
          <div class="flex flex-col gap-4">
            <div class="text-xs text-base-content/70 leading-relaxed">
              Creates a database-level SQL foreign key constraint on <strong class="text-base-content font-mono">{sourceTable}</strong> referencing <strong class="text-base-content font-mono">{targetTable}.{selectedTargetCol}</strong>.
            </div>

            <div class="flex gap-2 p-1 bg-base-200/50 rounded-field border border-base-300/50 text-xs font-medium">
              <button
                type="button"
                class="flex-1 py-1.5 px-3 rounded-field transition-all text-center {fkMode === 'existing'
                  ? 'bg-base-100 text-base-content font-bold shadow-xs'
                  : 'text-base-content/60 hover:text-base-content'}"
                onclick={() => (fkMode = "existing")}
              >
                Use Existing Column
              </button>
              <button
                type="button"
                class="flex-1 py-1.5 px-3 rounded-field transition-all text-center {fkMode === 'new'
                  ? 'bg-base-100 text-base-content font-bold shadow-xs'
                  : 'text-base-content/60 hover:text-base-content'}"
                onclick={() => (fkMode = "new")}
              >
                Create New Column
              </button>
            </div>

            {#if fkMode === "existing"}
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider" for="source-col-select">
                    {sourceTable} Column
                  </label>
                  <select
                    id="source-col-select"
                    class="select select-bordered select-sm w-full font-mono text-xs"
                    bind:value={selectedSourceCol}
                  >
                    {#each sourceColumns as col}
                      <option value={col.name}>
                        {col.name} ({col.definition?.split("(")[0] || "col"})
                      </option>
                    {/each}
                  </select>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider" for="target-col-select">
                    {targetTable} Reference
                  </label>
                  <select
                    id="target-col-select"
                    class="select select-bordered select-sm w-full font-mono text-xs"
                    bind:value={selectedTargetCol}
                  >
                    {#each targetColumns as col}
                      <option value={col.name}>
                        {col.name} {col.isPk ? "(PK)" : ""}
                      </option>
                    {/each}
                  </select>
                </div>
              </div>
            {:else}
              <div class="flex flex-col gap-3">
                <div class="grid grid-cols-3 gap-3">
                  <div class="col-span-2 flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider" for="new-col-name">
                      New Column Name
                    </label>
                    <input
                      id="new-col-name"
                      type="text"
                      class="input input-bordered input-sm w-full font-mono text-xs"
                      bind:value={newColName}
                      placeholder="e.g. userId"
                    />
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider" for="new-col-type">
                      Data Type
                    </label>
                    <select
                      id="new-col-type"
                      class="select select-bordered select-sm w-full font-mono text-xs"
                      bind:value={newColType}
                    >
                      <option value="integer">integer</option>
                      <option value="text">text</option>
                    </select>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider" for="new-target-col-select">
                    References {targetTable} Column
                  </label>
                  <select
                    id="new-target-col-select"
                    class="select select-bordered select-sm w-full font-mono text-xs"
                    bind:value={selectedTargetCol}
                  >
                    {#each targetColumns as col}
                      <option value={col.name}>
                        {col.name} {col.isPk ? "(PK)" : ""}
                      </option>
                    {/each}
                  </select>
                </div>
              </div>
            {/if}

            <!-- Code Preview -->
            <div class="bg-base-200/80 rounded-field p-3 border border-base-300 flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-[10px] uppercase font-bold text-base-content/50">
                <Code2 class="w-3 h-3" />
                <span>Generated Drizzle Syntax</span>
              </div>
              <code class="text-xs font-mono text-primary break-all">
                {fkMode === 'existing' ? (selectedSourceCol || 'col') : (newColName || 'col')}: {newColType}("{fkMode === 'existing' ? (selectedSourceCol || 'col') : (newColName || 'col')}").references(() =&gt; {targetTable}.{selectedTargetCol || 'id'})
              </code>
            </div>
          </div>

        <!-- Strategy 2: Logical Drizzle Relations -->
        {:else if strategy === "relations"}
          <div class="flex flex-col gap-3">
            <div class="text-xs text-base-content/70 leading-relaxed">
              Generates or extends a typed <strong class="text-base-content font-mono">relations()</strong> block in your schema. This allows relational querying in Drizzle ORM without adding hard foreign key constraints to your SQLite database.
            </div>

            <!-- Code Preview -->
            <div class="bg-base-200/80 rounded-field p-3 border border-base-300 flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5 text-[10px] uppercase font-bold text-base-content/50">
                <Code2 class="w-3 h-3" />
                <span>Generated Relations Block</span>
              </div>
              <pre class="text-xs font-mono text-secondary overflow-x-auto p-1 leading-relaxed">export const {sourceTable}Relations = relations({sourceTable}, (&#123; many &#125;) =&gt; (&#123;
  {targetTable}s: many({targetTable})
&#125;));</pre>
            </div>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-base-200/60 border-t border-base-300 flex items-center justify-end gap-2.5">
        <button
          type="button"
          class="btn btn-ghost btn-sm text-base-content/70 hover:text-base-content"
          onclick={close}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm gap-2"
          onclick={handleApply}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="loading loading-spinner loading-xs"></span>
            <span>Applying...</span>
          {:else}
            <Check class="w-4 h-4" />
            <span>Create Relationship</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
