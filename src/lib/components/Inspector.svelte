<!--
  Inspector.svelte

  Summary: Sidebar inspector displaying selected table/entity details (fields, types, relations) and modification actions.
  Expects: None (shares global schemaState).
  Output: Triggers field additions, deletions, renames, and constraints updates.
-->
<script lang="ts">
  import {
    Database,
    Cpu,
    Zap,
    X,
    Key,
    Trash2,
    Check,
    Pencil,
    Heart,
    HardDrive,
  } from "lucide-svelte";
  import { schemaState } from "../state";
  import AddFieldForm from "$lib/components/AddFieldForm.svelte";
  import AddRelationForm from "$lib/components/AddRelationForm.svelte";

  // --- Local UI State ---
  /** Whether the user is currently filling out the 'Add Field' form */
  let isAddingField = $state(false);
  /** Whether the user is currently filling out the 'Forge Relation' form */
  let isForgingRelation = $state(false);
  /** Whether the user is confirming a destructive deletion */
  let isConfirmingDelete = $state(false);

  let activeTab = $state<'fields' | 'relations'>('fields');

  let editingTableName = $state<string | null>(null);
  let newTableName = $state("");

  let editingColumnName = $state<string | null>(null);
  let newColumnName = $state("");

  /**
   * Renames a table/entity and syncs.
   */
  async function submitRenameTable() {
    if (!editingTableName || !newTableName) return;
    await schemaState.renameTable(editingTableName, newTableName);
    editingTableName = null;
  }

  /**
   * Renames a column and syncs.
   */
  async function submitRenameColumn(tableName: string) {
    if (!editingColumnName || !newColumnName) return;
    await schemaState.renameColumn(tableName, editingColumnName, newColumnName);
    editingColumnName = null;
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
    r2: {
      icon: HardDrive,
      label: "R2 Storage",
      bg: "bg-info/10",
      text: "text-info",
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
    schemaState.activeInspectorNodeId = null;
  }

  /**
   * Auto-reset forms when a different node is selected.
   */
  $effect(() => {
    if (schemaState.activeInspectorNodeId) {
      isAddingField = false;
      isForgingRelation = false;
      isConfirmingDelete = false;
      editingTableName = null;
      editingColumnName = null;
      activeTab = 'fields';
    }
  });

  const selectedNode = $derived(schemaState.nodes.find((n) => n.id === schemaState.activeInspectorNodeId));
  const isReadOnly = $derived(
    !!selectedNode && (
      (selectedNode.data as any)?.isExternal || 
      ((selectedNode.data as any)?.target === "do" && (selectedNode.data as any)?.strata?.path) || 
      ((selectedNode.data as any)?.target === "kv" && (selectedNode.data as any)?.strata?.binding && !(selectedNode.data as any)?.strata?.schema)
    )
  );
</script>

{#if schemaState.activeInspectorNodeId}
  {@const selectedNode = schemaState.nodes.find((n) => n.id === schemaState.activeInspectorNodeId)}
  {#if selectedNode}
    {@const data = selectedNode.data as any}
    {@const config =
      targetConfig[(data.target as keyof typeof targetConfig) || "d1"]}

  <div
    class="w-full h-full max-h-full bg-base-100/90 border-r border-base-300 flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-left-8 duration-300"
    data-testid="inspector-panel"
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
              {#if !isReadOnly}
                <button
                  class="opacity-0 group-hover/header:opacity-30 hover:opacity-100! transition-all btn btn-ghost btn-xs btn-circle h-5 w-5"
                  onclick={() => {
                    editingTableName = selectedNode.id;
                    newTableName = selectedNode.id;
                  }}
                >
                  <Pencil class="w-3 h-3" />
                </button>
              {/if}
            </div>
          {/if}
          <span
            class="text-[9px] uppercase tracking-widest font-black opacity-30"
            >{config.label}</span
          >
        </div>
      </div>
      <div class="flex items-center gap-1">
        {#if !isReadOnly}
          {#if !isConfirmingDelete}
            <button
              class="btn btn-ghost btn-xs btn-circle hover:text-error opacity-40 hover:opacity-100 transition-all"
              onclick={() => (isConfirmingDelete = true)}
              title="Delete Entity"
              data-testid="delete-entity-button"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          {:else}
            <div
              class="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200 pr-4"
            >
              <button
                class="btn btn-error btn-xs rounded-lg px-2 text-[10px]"
                onclick={() => deleteTable(selectedNode.id)}>Confirm</button
              >
              <button
                class="btn btn-ghost btn-xs rounded-lg px-2 text-[10px]"
                onclick={() => (isConfirmingDelete = false)}>Cancel</button
              >
            </div>
          {/if}
        {/if}
        <button
          class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error transition-all"
          onclick={dismiss}
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tabs tabs-boxed rounded-xl bg-base-200/50 p-1 mx-6 mt-4 flex select-none shrink-0 border border-base-300/30">
      <button 
        class="tab tab-sm grow rounded-lg transition-all text-xs font-semibold py-1.5 {activeTab === 'fields' ? 'tab-active bg-base-100 shadow-sm font-bold text-primary' : 'opacity-65 hover:opacity-100 text-base-content/80'}"
        onclick={() => (activeTab = 'fields')}
      >
        Fields ({data.columns.length})
      </button>
      <button 
        class="tab tab-sm grow rounded-lg transition-all text-xs font-semibold py-1.5 {activeTab === 'relations' ? 'tab-active bg-base-100 shadow-sm font-bold text-primary' : 'opacity-65 hover:opacity-100 text-base-content/80'}"
        onclick={() => (activeTab = 'relations')}
      >
        Relationships ({schemaState.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length})
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-6">
      {#if isReadOnly}
        <div class="alert alert-info/10 bg-info/5 text-info-content text-[11px] rounded-xl flex items-start gap-2 border border-info/10 p-3 leading-relaxed">
          <span>ℹ️</span>
          <span>This entity's structure is read-only (parsed dynamically from external source code or wrangler.toml configuration). Modifying its fields is disabled.</span>
        </div>
      {/if}

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
      {:else if activeTab === 'fields'}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <span
              class="text-[10px] font-black uppercase opacity-30 tracking-widest"
              >Structure</span
            >
          </div>

          <div class="flex flex-col gap-2">
            {#each data.columns as col}
              <div
                class="bg-base-200/40 p-3 rounded-2xl flex flex-col gap-1.5 border border-transparent hover:border-base-300 transition-all group"
                data-testid="field-row-{col.name}"
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
                        {#if !isReadOnly}
                          <button
                            class="opacity-0 group-hover/col-title:opacity-30 hover:opacity-100! transition-all btn btn-ghost btn-xs btn-circle h-4 w-4"
                            onclick={() => {
                              editingColumnName = col.name;
                              newColumnName = col.name;
                            }}
                          >
                            <Pencil class="w-2.5 h-2.5" />
                          </button>
                        {/if}
                      </div>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      class="text-[9px] font-mono opacity-40 uppercase bg-base-300/50 px-1.5 py-0.5 rounded"
                      >{col.definition.split("(")[0]}</span
                    >
                    {#if !isReadOnly}
                      <button
                        class="opacity-0 group-hover/field:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error transition-all"
                        onclick={() => deleteColumn(selectedNode.id, col.name)}
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    {/if}
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

                {#if data.target === "d1" || !data.target}
                  <div
                    class="flex items-center gap-4 mt-2 pt-2 border-t border-base-300/30 text-[10px]"
                  >
                    <label
                      class="flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={col.isPk}
                        disabled={isReadOnly}
                        class="checkbox checkbox-xs checkbox-primary rounded disabled:opacity-50"
                        onchange={(e) =>
                          schemaState.updateColumnModifiers(
                            selectedNode.id,
                            col.name,
                            { isPk: e.currentTarget.checked },
                          )}
                      />
                      <span class="font-medium opacity-70">PK</span>
                    </label>

                    <label
                      class="flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={col.notNull}
                        disabled={isReadOnly}
                        class="checkbox checkbox-xs checkbox-primary rounded disabled:opacity-50"
                        onchange={(e) =>
                          schemaState.updateColumnModifiers(
                            selectedNode.id,
                            col.name,
                            { notNull: e.currentTarget.checked },
                          )}
                      />
                      <span class="font-medium opacity-70">Not Null</span>
                    </label>
                  </div>

                  <div class="flex items-center gap-2 mt-2 pt-1">
                    <span
                      class="text-[9px] font-semibold uppercase tracking-wider opacity-40"
                      >Default</span
                    >
                    <input
                      type="text"
                      placeholder="None"
                      value={col.defaultVal || ""}
                      disabled={isReadOnly}
                      class="input input-xs input-bordered w-full rounded-md font-mono text-[10px] bg-base-100 focus:border-primary transition-all disabled:opacity-50"
                      onchange={(e) => {
                        schemaState.updateColumnModifiers(
                          selectedNode.id,
                          col.name,
                          { defaultVal: e.currentTarget.value },
                        );
                      }}
                    />
                  </div>
                {/if}
              </div>
            {/each}

            {#if !isReadOnly}
              <div class="grid grid-cols-2 gap-2 mt-2">
                <button
                  class="btn btn-ghost btn-sm border-dashed border-base-300 rounded-2xl h-auto py-4 flex flex-col gap-1 opacity-60 hover:opacity-100 hover:border-primary/50 transition-all"
                  onclick={() => (isAddingField = true)}
                  data-testid="add-field-button"
                >
                  <span class="text-xs font-bold uppercase">+ Field</span>
                </button>
                <button
                  class="btn btn-ghost btn-sm border-dashed border-base-300 rounded-2xl h-auto py-4 flex flex-col gap-1 opacity-60 hover:opacity-100 hover:border-secondary/50 transition-all"
                  onclick={() => (isForgingRelation = true)}
                  data-testid="add-relation-button"
                >
                  <span class="text-xs font-bold uppercase">+ Relation</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {:else if activeTab === 'relations'}
        {@const tableEdges = schemaState.edges.filter((e: any) => e.source === selectedNode.id || e.target === selectedNode.id)}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <span
              class="text-[10px] font-black uppercase opacity-30 tracking-widest"
              >Defined Connections</span
            >
          </div>

          {#if tableEdges.length === 0}
            <div class="text-center py-8 opacity-40 text-xs text-base-content/50">
              No relationships defined for this entity.
            </div>
          {:else}
            <div class="flex flex-col gap-2">
              {#each tableEdges as edge}
                {@const isSource = edge.source === selectedNode.id}
                {@const otherNode = isSource ? edge.target : edge.source}
                {@const isVirtual = edge.data?.isVirtual}
                {@const card = edge.data?.cardinality || 'unknown'}
                <div
                  class="bg-base-200/40 p-3.5 rounded-2xl flex flex-col gap-2 border border-transparent hover:border-base-300 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-mono font-bold {isSource ? 'text-primary' : 'text-secondary'}">
                        {isSource ? '→' : '←'}
                      </span>
                      <span class="font-bold text-xs text-base-content/90">{otherNode}</span>
                    </div>
                    
                    <span class="badge badge-outline badge-xs text-[9px] uppercase font-mono opacity-50 px-1 py-0.5 rounded leading-none">
                      {card}
                    </span>
                  </div>

                  <div class="flex items-center justify-between mt-1 text-[10px] text-base-content/60">
                    <div class="flex items-center gap-1.5">
                      <span class="px-1.5 py-0.5 rounded bg-base-300 font-mono text-[9px] font-semibold text-base-content/60">
                        {isVirtual ? 'Logical' : 'Physical'}
                      </span>
                      {#if edge.label}
                        <span class="font-mono text-xs opacity-75">{edge.label}</span>
                      {/if}
                    </div>

                    {#if !isReadOnly}
                      <button
                        class="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error transition-all"
                        onclick={() => {
                          if (confirm(`Delete relationship with ${otherNode}?`)) {
                            schemaState.deleteRelation(edge.source, edge.target, edge.label);
                          }
                        }}
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- footnote banner -->
          <div class="mt-4 p-3.5 bg-base-200/40 border border-base-300/40 rounded-2xl flex flex-col gap-1.5 text-[10px]">
            <span class="font-bold text-base-content/85 flex items-center gap-1">
              💡 Handle Fallbacks
            </span>
            <p class="leading-relaxed opacity-65">
              Physical foreign key references connect directly to the column rows. Logical relations and synthetic references fall back to entity-level handles on the sides of the node cards.
            </p>
          </div>
          
          {#if !isReadOnly}
            <button
              class="btn btn-ghost btn-sm border-dashed border-base-300 rounded-2xl h-auto py-4 flex flex-col gap-1 opacity-60 hover:opacity-100 hover:border-secondary/50 transition-all mt-2"
              onclick={() => (isForgingRelation = true)}
            >
              <span class="text-xs font-bold uppercase">+ Forge Relation</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer Stats/Hint -->
    <div class="p-6 bg-base-200/50 border-t border-base-300">
      <div class="flex flex-col items-center gap-4">
        <p class="text-[10px] opacity-60 text-center flex items-center gap-1">
          Made with<Heart class="w-4 h-4" fill="red" /> from
          <a href="https://frstudios.co.ke">FRStudios</a>.
        </p>
      </div>
    </div>
    </div>
  {/if}
{/if}
