<script lang="ts">
  /**
   * Inspector Component
   * Displays details for the selected node (Table, KV, DO) and 
   * provides forms for structural modifications (Adding fields/relations).
   */
  import { Database, Cpu, Zap, X, Key } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";
  import AddFieldForm from "$lib/components/AddFieldForm.svelte";
  import AddRelationForm from "$lib/components/AddRelationForm.svelte";

  // --- Local UI State ---
  /** Whether the user is currently filling out the 'Add Field' form */
  let isAddingField = $state(false);
  /** Whether the user is currently filling out the 'Forge Relation' form */
  let isForgingRelation = $state(false);

  /** Configuration for different storage targets */
  const targetConfig = {
    d1: {
      icon: Database,
      label: "D1 Table",
      bg: "bg-primary/10",
      text: "text-primary",
    },
    do: {
      icon: Cpu,
      label: "Durable Object",
      bg: "bg-secondary/10",
      text: "text-secondary",
    },
    kv: {
      icon: Zap,
      label: "Key-Value",
      bg: "bg-accent/10",
      text: "text-accent",
    },
  };

  /**
   * Deselects the current node and resets form states.
   */
  function dismiss() {
    isAddingField = false;
    isForgingRelation = false;
    schemaState.nodes = schemaState.nodes.map((n) => ({
      ...n,
      selected: false,
    }));
  }

  /**
   * Auto-reset forms when a different node is selected.
   */
  $effect(() => {
    if (schemaState.nodes.some(n => n.selected)) {
      isAddingField = false;
      isForgingRelation = false;
    }
  });
</script>

{#if schemaState.nodes.some((n) => n.selected)}
  {@const selectedNode = schemaState.nodes.find((n) => n.selected)!}
  {@const data = selectedNode.data as any}
  {@const config =
    targetConfig[(data.target as keyof typeof targetConfig) || "d1"]}

  <div
    class="absolute top-6 right-6 bottom-6 w-80 bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl rounded-[2.5rem] z-40 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300"
  >
    <!-- Header -->
    <div
      class="p-6 border-b border-base-300 flex items-center justify-between bg-base-200/30"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 {config.bg} rounded-xl">
          <config.icon class="w-4 h-4 {config.text}" />
        </div>
        <div class="flex flex-col">
          <h3 class="font-bold text-sm tracking-tight leading-none mb-1">
            {selectedNode.id}
          </h3>
          <span
            class="text-[9px] uppercase tracking-widest font-black opacity-30"
            >{config.label}</span
          >
        </div>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error transition-all"
        onclick={dismiss}
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Content -->
    <div class="grow overflow-auto p-5 flex flex-col gap-6">
      {#if isAddingField}
        <AddFieldForm 
          tableName={selectedNode.id} 
          onComplete={() => isAddingField = false} 
        />
      {:else if isForgingRelation}
        <AddRelationForm 
          sourceTableName={selectedNode.id} 
          onComplete={() => isForgingRelation = false} 
        />
      {:else}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <span
              class="text-[10px] font-black uppercase opacity-30 tracking-widest"
              >Structure</span
            >
            <span class="badge badge-outline badge-xs opacity-40"
              >{data.columns.length} Fields</span
            >
          </div>

          <div class="flex flex-col gap-2">
            {#each data.columns as col}
              <div
                class="bg-base-200/40 p-3 rounded-2xl flex flex-col gap-1.5 border border-transparent hover:border-base-300 transition-all group"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    {#if col.isPk}
                      <Key class="w-3 h-3 text-amber-500" />
                    {/if}
                    <span
                      class="font-bold text-xs group-hover:text-primary transition-colors"
                      >{col.name}</span
                    >
                  </div>
                  <span
                    class="text-[9px] font-mono opacity-40 uppercase bg-base-300/50 px-1.5 py-0.5 rounded"
                    >{col.definition.split("(")[0]}</span
                  >
                </div>

                {#if col.isReferences}
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <div class="w-1 h-1 rounded-full bg-secondary"></div>
                    <span
                      class="text-[9px] text-secondary font-medium uppercase tracking-tighter"
                      >Foreign Key Reference</span
                    >
                  </div>
                {/if}
              </div>
            {/each}

            <div class="grid grid-cols-2 gap-2 mt-2">
              <button 
                class="btn btn-ghost btn-sm border-dashed border-base-300 rounded-2xl h-auto py-4 flex flex-col gap-1 opacity-60 hover:opacity-100 hover:border-primary/50 transition-all"
                onclick={() => isAddingField = true}
              >
                <span class="text-xs font-bold uppercase">+ Field</span>
              </button>
              <button 
                class="btn btn-ghost btn-sm border-dashed border-base-300 rounded-2xl h-auto py-4 flex flex-col gap-1 opacity-60 hover:opacity-100 hover:border-secondary/50 transition-all"
                onclick={() => isForgingRelation = true}
              >
                <span class="text-xs font-bold uppercase">+ Relation</span>
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer Stats/Hint -->
    <div class="p-6 bg-base-200/50 border-t border-base-300">
      <div class="flex flex-col items-center gap-4">
        <div
          class="flex items-center gap-2 px-3 py-1.5 bg-base-100 rounded-full border border-base-300 shadow-sm"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
          <span class="text-[9px] font-bold uppercase tracking-wider opacity-60"
            >Live Sync Active</span
          >
        </div>
        <p class="text-[10px] opacity-40 text-center leading-relaxed">
          Changes to <code>schema.ts</code> will reflect here instantly.
        </p>
      </div>
    </div>
  </div>
{/if}
