<!--
  ConnectionPickerModal.svelte

  Summary: Modal component prompting the user to select their connection intent (Physical Foreign Key, Logical Drizzle Relation, or Synthetic JSDoc link) when dragging an edge.
  Expects: pendingConnection object and onConfirm / onCancel callbacks.
  Output: Triggers schema relationship creation with field-level handle accuracy.
-->
<script lang="ts">
  import { X, Check, Link, GitCommitVertical, Sparkles } from "lucide-svelte";
  import { schemaState } from "$lib/state";

  interface ConnectionData {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }

  const { connection, onConfirm, onCancel } = $props<{
    connection: ConnectionData;
    onConfirm: (
      type: "foreign_key" | "drizzle_relation" | "synthetic",
      details: { sourceCol?: string; targetCol?: string },
    ) => void;
    onCancel: () => void;
  }>();

  const sourceNode = $derived(
    schemaState.nodes.find((n) => n.id === connection.source),
  );
  const targetNode = $derived(
    schemaState.nodes.find((n) => n.id === connection.target),
  );

  const sourceType = $derived((sourceNode?.data as any)?.target || "d1");
  const targetType = $derived((targetNode?.data as any)?.target || "d1");

  const sourceColumns = $derived((sourceNode?.data as any)?.columns || []);
  const targetColumns = $derived((targetNode?.data as any)?.columns || []);

  const isBothD1 = $derived(sourceType === "d1" && targetType === "d1");

  let selectedSourceCol = $state("");
  let selectedTargetCol = $state("");
  let selectedRelationType = $state<"foreign_key" | "drizzle_relation" | "synthetic">("foreign_key");

  $effect(() => {
    if (!selectedSourceCol) {
      if (connection.sourceHandle && connection.sourceHandle !== "source") {
        selectedSourceCol = connection.sourceHandle;
      } else {
        const found = sourceColumns.find((c: any) => c.isReferences || c.name.toLowerCase().includes("id"))?.name;
        selectedSourceCol = found || (connection.source === connection.target ? "parent_id" : `${connection.target.toLowerCase()}_id`);
      }
    }
  });

  $effect(() => {
    if (!selectedTargetCol) {
      if (connection.targetHandle && connection.targetHandle !== "target") {
        selectedTargetCol = connection.targetHandle;
      } else {
        selectedTargetCol = targetColumns.find((c: any) => c.isPk)?.name || targetColumns[0]?.name || "id";
      }
    }
  });

  $effect(() => {
    selectedRelationType = isBothD1 ? "foreign_key" : "synthetic";
  });


  function handleConfirm() {
    onConfirm(selectedRelationType, {
      sourceCol: selectedSourceCol,
      targetCol: selectedTargetCol,
    });
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
  role="dialog"
  aria-modal="true"
>
  <div
    class="bg-base-100 rounded-3xl w-full max-w-lg shadow-2xl border border-base-300 overflow-hidden flex flex-col"
  >
    <!-- Header -->
    <div
      class="px-6 py-4 bg-base-200/80 border-b border-base-300 flex items-center justify-between"
    >
      <div class="flex items-center gap-2.5">
        <div class="p-2 bg-primary/10 rounded-xl text-primary">
          <Link class="w-4 h-4" />
        </div>
        <div>
          <h3 class="font-bold text-sm text-base-content leading-none">
            Create Relationship
          </h3>
          <span class="text-[10px] text-base-content/50 font-medium"
            >Select connection intent & field targets</span
          >
        </div>
      </div>
      <button
        class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
        onclick={onCancel}
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Connection Summary Banner -->
    <div
      class="p-4 bg-base-200/30 border-b border-base-300/60 flex items-center justify-between gap-3 text-xs"
    >
      <div class="flex items-center gap-2 font-mono font-bold">
        <span class="badge badge-primary badge-sm">{connection.source}</span>
        {#if isBothD1 && selectedSourceCol}
          <span class="text-[10px] opacity-60">.{selectedSourceCol}</span>
        {/if}
      </div>

      <span class="text-primary font-bold text-sm">➔</span>

      <div class="flex items-center gap-2 font-mono font-bold">
        <span class="badge badge-secondary badge-sm">{connection.target}</span>
        {#if isBothD1 && selectedTargetCol}
          <span class="text-[10px] opacity-60">.{selectedTargetCol}</span>
        {/if}
      </div>
    </div>

    <!-- Main Content -->
    <div class="p-6 flex flex-col gap-5">
      <!-- Column Handle Selection (For D1 -> D1) -->
      {#if isBothD1 && sourceColumns.length > 0 && targetColumns.length > 0}
        <div
          class="grid grid-cols-2 gap-3 bg-base-200/40 p-3.5 rounded-2xl border border-base-300/60"
        >
          <div class="flex flex-col gap-1">
            <label
              for="source-field-select"
              class="text-[10px] font-bold uppercase tracking-wider text-base-content/60 block"
              >Source Field</label
            >
            <select
              id="source-field-select"
              bind:value={selectedSourceCol}
              class="select select-xs select-bordered w-full rounded-xl bg-base-100 text-xs font-mono"
            >
              {#each sourceColumns as col}
                <option value={col.name}>{col.name} ({col.definition})</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="target-field-select"
              class="text-[10px] font-bold uppercase tracking-wider text-base-content/60 block"
              >Target Field</label
            >
            <select
              id="target-field-select"
              bind:value={selectedTargetCol}
              class="select select-xs select-bordered w-full rounded-xl bg-base-100 text-xs font-mono"
            >
              {#each targetColumns as col}
                <option value={col.name}>{col.name} ({col.definition})</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      <!-- Relationship Intent Selection Cards -->
      <div class="flex flex-col gap-2.5">
        <span
          class="text-[10px] font-bold uppercase tracking-wider text-base-content/50 px-1"
          >Relationship Type</span
        >

        {#if isBothD1}
          <!-- Physical Foreign Key Option -->
          <label
            class="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 group {selectedRelationType ===
            'foreign_key'
              ? 'bg-primary/5 border-primary shadow-sm'
              : 'bg-base-100 border-base-300/70 hover:bg-base-200/40'}"
          >
            <input
              type="radio"
              name="relationType"
              value="foreign_key"
              bind:group={selectedRelationType}
              class="radio radio-primary radio-xs mt-0.5"
            />
            <div class="flex flex-col gap-0.5 grow">
              <div class="flex items-center justify-between">
                <span
                  class="font-bold text-xs text-base-content group-hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <GitCommitVertical class="w-3.5 h-3.5 text-primary" />
                  Physical Foreign Key (.references())
                </span>
                <span class="badge badge-xs badge-primary font-mono text-[9px]"
                  >Solid Line</span
                >
              </div>
              <p
                class="text-[10.5px] text-base-content/65 leading-relaxed font-sans mt-0.5"
              >
                Generates a native SQL engine constraint in <code
                  >schema.ts</code
                >:<br />
                <code
                  class="bg-base-200 px-1.5 py-0.5 rounded text-[9.5px] font-mono text-primary"
                  >{selectedSourceCol || "fk"}: integer(...).references(() => {connection.target}.{selectedTargetCol ||
                    "id"})</code
                >
              </p>
            </div>
          </label>

          <!-- Logical Drizzle Relation Option -->
          <label
            class="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 group {selectedRelationType ===
            'drizzle_relation'
              ? 'bg-secondary/5 border-secondary shadow-sm'
              : 'bg-base-100 border-base-300/70 hover:bg-base-200/40'}"
          >
            <input
              type="radio"
              name="relationType"
              value="drizzle_relation"
              bind:group={selectedRelationType}
              class="radio radio-secondary radio-xs mt-0.5"
            />
            <div class="flex flex-col gap-0.5 grow">
              <div class="flex items-center justify-between">
                <span
                  class="font-bold text-xs text-base-content group-hover:text-secondary transition-colors flex items-center gap-1.5"
                >
                  <Link class="w-3.5 h-3.5 text-secondary" />
                  Logical Drizzle Relation (relations())
                </span>
                <span
                  class="badge badge-xs badge-secondary font-mono text-[9px]"
                  >Animated Line</span
                >
              </div>
              <p
                class="text-[10.5px] text-base-content/65 leading-relaxed font-sans mt-0.5"
              >
                Generates a Drizzle query-builder relation block without forcing
                a hard database engine foreign key.
              </p>
            </div>
          </label>
        {/if}

        <!-- Synthetic JSDoc Option -->
        <label
          class="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 group {selectedRelationType ===
          'synthetic'
            ? 'bg-accent/5 border-accent shadow-sm'
            : 'bg-base-100 border-base-300/70 hover:bg-base-200/40'}"
        >
          <input
            type="radio"
            name="relationType"
            value="synthetic"
            bind:group={selectedRelationType}
            class="radio radio-accent radio-xs mt-0.5"
          />
          <div class="flex flex-col gap-0.5 grow">
            <div class="flex items-center justify-between">
              <span
                class="font-bold text-xs text-base-content group-hover:text-accent transition-colors flex items-center gap-1.5"
              >
                <Sparkles class="w-3.5 h-3.5 text-accent" />
                Synthetic JSDoc Target Link (@strata)
              </span>
              <span class="badge badge-xs badge-accent font-mono text-[9px]"
                >Dashed Line</span
              >
            </div>
            <p
              class="text-[10.5px] text-base-content/65 leading-relaxed font-sans mt-0.5"
            >
              Stores logical cross-storage metadata inside entity JSDoc comments
              (ideal for D1 ➔ KV / DO / R2 links).
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- Actions -->
    <div
      class="px-6 py-4 bg-base-200/50 border-t border-base-300 flex items-center justify-end gap-2"
    >
      <button
        class="btn btn-ghost btn-sm rounded-xl text-xs font-semibold"
        onclick={onCancel}
      >
        Cancel
      </button>
      <button
        class="btn btn-primary btn-sm rounded-xl gap-1.5 text-xs font-semibold px-5 shadow-sm"
        onclick={handleConfirm}
      >
        <Check class="w-3.5 h-3.5" />
        Create Relationship
      </button>
    </div>
  </div>
</div>
