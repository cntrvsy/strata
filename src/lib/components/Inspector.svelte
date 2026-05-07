<script lang="ts">
  /**
   * Inspector Component
   * Displays details for the selected node (Table, KV, DO) and
   * provides forms for structural modifications (Adding fields/relations).
   */
  import {
    Database,
    Cpu,
    Zap,
    X,
    Key,
    Trash2,
    Edit2,
    Check,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";
  import AddFieldForm from "$lib/components/AddFieldForm.svelte";
  import AddRelationForm from "$lib/components/AddRelationForm.svelte";
  import {
    removeTableFromSchema,
    removeColumnFromSchema,
    renameTableInSchema,
    renameColumnInSchema,
    stripHtml,
  } from "$lib/parser";
  import { writeTextFile } from "@tauri-apps/plugin-fs";

  // --- Local UI State ---
  /** Whether the user is currently filling out the 'Add Field' form */
  let isAddingField = $state(false);
  /** Whether the user is currently filling out the 'Forge Relation' form */
  let isForgingRelation = $state(false);
  /** Whether the user is confirming a destructive deletion */
  let isConfirmingDelete = $state(false);

  let editingTableName = $state<string | null>(null);
  let newTableName = $state("");

  let editingColumnName = $state<string | null>(null);
  let newColumnName = $state("");

  /**
   * Renames a table/entity and syncs.
   */
  async function submitRenameTable() {
    if (!editingTableName || !newTableName || !schemaState.filePath) return;
    schemaState.machine.send("SAVE");
    try {
      const { renameTableInSchema } = await import("$lib/parser");
      const newCode = renameTableInSchema(
        schemaState.rawCode,
        editingTableName,
        newTableName,
      );
      await writeTextFile(schemaState.filePath, newCode);
      await schemaState.syncWithFile();
      schemaState.machine.send("SAVE_SUCCESS");
      editingTableName = null;
    } catch (e) {
      schemaState.machine.send("SAVE_ERROR");
      console.error(e);
    }
  }

  /**
   * Renames a column and syncs.
   */
  async function submitRenameColumn(tableName: string) {
    if (!editingColumnName || !newColumnName || !schemaState.filePath) return;
    schemaState.machine.send("SAVE");
    try {
      const { renameColumnInSchema } = await import("$lib/parser");
      const newCode = renameColumnInSchema(
        schemaState.rawCode,
        tableName,
        editingColumnName,
        newColumnName,
      );
      await writeTextFile(schemaState.filePath, newCode);
      await schemaState.syncWithFile();
      schemaState.machine.send("SAVE_SUCCESS");
      editingColumnName = null;
    } catch (e) {
      schemaState.machine.send("SAVE_ERROR");
      console.error(e);
    }
  }

  /**
   * Deletes a column from the schema and syncs.
   */
  async function deleteColumn(tableName: string, colName: string) {
    await schemaState.deleteColumn(tableName, colName);
  }

  /**
   * Deletes the entire table/entity and syncs.
   */
  async function deleteTable(tableName: string) {
    await schemaState.deleteTable(tableName);
    isConfirmingDelete = false;
  }

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
    isConfirmingDelete = false;
    editingTableName = null;
    editingColumnName = null;
    schemaState.nodes = schemaState.nodes.map((n) => ({
      ...n,
      selected: false,
    }));
  }

  /**
   * Auto-reset forms when a different node is selected.
   */
  $effect(() => {
    if (schemaState.nodes.some((n) => n.selected)) {
      isAddingField = false;
      isForgingRelation = false;
      isConfirmingDelete = false;
      editingTableName = null;
      editingColumnName = null;
    }
  });
</script>

{#if schemaState.nodes.some((n) => n.selected)}
  {@const selectedNode = schemaState.nodes.find((n) => n.selected)!}
  {@const data = selectedNode.data as any}
  {@const config =
    targetConfig[(data.target as keyof typeof targetConfig) || "d1"]}

  <div
    class="absolute top-20 right-6 max-h-[calc(100vh-25rem)] w-80 bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl rounded-[2.5rem] z-40 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300"
  >
    <!-- Header -->
    <div
      class="p-6 border-b border-base-300 flex items-center justify-between bg-base-200/30"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 {config.bg} rounded-xl">
          <config.icon class="w-4 h-4 {config.text}" />
        </div>
        <div class="flex flex-col grow">
          {#if editingTableName === selectedNode.id}
            <div class="flex items-center gap-1">
              <input
                bind:value={newTableName}
                class="input input-xs input-bordered w-full rounded-lg font-bold text-sm h-7 bg-base-100 focus:border-primary transition-all"
                onkeydown={(e) => e.key === "Enter" && submitRenameTable()}
              />
              <button
                class="btn btn-primary btn-xs btn-circle"
                onclick={submitRenameTable}><Check class="w-3 h-3" /></button
              >
            </div>
          {:else}
            <div class="flex items-center gap-2 group/header">
              <h3 class="font-bold text-sm tracking-tight leading-none">
                {selectedNode.id}
              </h3>
              <button
                class="opacity-0 group-hover/header:opacity-30 hover:opacity-100! transition-all btn btn-ghost btn-xs btn-circle h-5 w-5"
                onclick={() => {
                  editingTableName = selectedNode.id;
                  newTableName = selectedNode.id;
                }}
              >
                <Edit2 class="w-3 h-3" />
              </button>
            </div>
          {/if}
          <span
            class="text-[9px] uppercase tracking-widest font-black opacity-30"
            >{config.label}</span
          >
        </div>
      </div>
      <div class="flex items-center gap-1">
        {#if !isConfirmingDelete}
          <button
            class="btn btn-ghost btn-xs btn-circle hover:text-error opacity-40 hover:opacity-100 transition-all"
            onclick={() => (isConfirmingDelete = true)}
            title="Delete Entity"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        {:else}
          <div
            class="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200"
          >
            <button
              class="btn btn-error btn-xs rounded-lg px-2 text-[10px]"
              onclick={() => deleteTable(selectedNode.id)}>Confirm</button
            >
            <button
              class="btn btn-ghost btn-xs btn-circle"
              onclick={() => (isConfirmingDelete = false)}
              ><X class="w-3.5 h-3.5" /></button
            >
          </div>
        {/if}
        <button
          class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error transition-all"
          onclick={dismiss}
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="grow overflow-auto p-5 flex flex-col gap-6">
      {#if isAddingField}
        <AddFieldForm
          tableName={selectedNode.id}
          onComplete={() => (isAddingField = false)}
        />
      {:else if isForgingRelation}
        <AddRelationForm
          sourceTableName={selectedNode.id}
          onComplete={() => (isForgingRelation = false)}
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
                  <div class="flex items-center gap-2 grow">
                    {#if col.isPk}
                      <Key class="w-3 h-3 text-amber-500" />
                    {/if}
                    {#if editingColumnName === col.name}
                      <div class="flex items-center gap-1 grow">
                        <input
                          bind:value={newColumnName}
                          class="input input-xs input-bordered w-full rounded-lg font-bold text-[13px] h-7 bg-base-100 focus:border-primary transition-all"
                          onkeydown={(e) =>
                            e.key === "Enter" &&
                            submitRenameColumn(selectedNode.id)}
                        />
                        <button
                          class="btn btn-primary btn-xs btn-circle"
                          onclick={() => submitRenameColumn(selectedNode.id)}
                          ><Check class="w-3 h-3" /></button
                        >
                      </div>
                    {:else}
                      <div class="flex items-center gap-2 group/col-title">
                        <span
                          class="font-bold text-xs group-hover/field:text-primary transition-colors"
                        >
                          {col.name}
                        </span>
                        <button
                          class="opacity-0 group-hover/col-title:opacity-30 hover:opacity-100! transition-all btn btn-ghost btn-xs btn-circle h-4 w-4"
                          onclick={() => {
                            editingColumnName = col.name;
                            newColumnName = col.name;
                          }}
                        >
                          <Edit2 class="w-2.5 h-2.5" />
                        </button>
                      </div>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      class="text-[9px] font-mono opacity-40 uppercase bg-base-300/50 px-1.5 py-0.5 rounded"
                      >{col.definition.split("(")[0]}</span
                    >
                    <button
                      class="opacity-0 group-hover/field:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error transition-all"
                      onclick={() => deleteColumn(selectedNode.id, col.name)}
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
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
                onclick={() => (isAddingField = true)}
              >
                <span class="text-xs font-bold uppercase">+ Field</span>
              </button>
              <button
                class="btn btn-ghost btn-sm border-dashed border-base-300 rounded-2xl h-auto py-4 flex flex-col gap-1 opacity-60 hover:opacity-100 hover:border-secondary/50 transition-all"
                onclick={() => (isForgingRelation = true)}
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
