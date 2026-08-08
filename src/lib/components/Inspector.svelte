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
    Trash2,
    Check,
    Pencil,
    Heart,
    HardDrive,
    Wrench,
    Lightbulb,
    TriangleAlert,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state";
  import { uiState } from "$lib/state/uiStore.svelte";
  import AddFieldForm from "$lib/components/forms/AddFieldForm.svelte";
  import AddRelationForm from "$lib/components/forms/AddRelationForm.svelte";
  import D1Inspector from "$lib/components/inspector/D1Inspector.svelte";
  import KVInspector from "$lib/components/inspector/KVInspector.svelte";
  import DOInspector from "$lib/components/inspector/DOInspector.svelte";
  import R2Inspector from "$lib/components/inspector/R2Inspector.svelte";

  // --- Local UI State ---

  /** Whether the user is currently filling out the 'Add Field' form */
  let isAddingField = $state(false);
  /** Whether the user is currently filling out the 'Create Relation' form */
  let isCreatingRelation = $state(false);
  /** Whether the user is confirming a destructive deletion */
  let isConfirmingDelete = $state(false);

  let activeTab = $state<"fields" | "relations">("fields");

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
    isCreatingRelation = false;
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
      isCreatingRelation = false;
      isConfirmingDelete = false;
      editingTableName = null;
      editingColumnName = null;
      activeTab = "fields";
    }
  });

  const selectedNode = $derived(
    schemaState.nodes.find((n) => n.id === schemaState.activeInspectorNodeId),
  );
  const isReadOnly = $derived(
    !!selectedNode &&
      ((selectedNode.data as any)?.isExternal ||
        (selectedNode.data as any)?.target === "do" ||
        (selectedNode.data as any)?.target === "kv" ||
        (selectedNode.data as any)?.target === "r2"),
  );
</script>

{#if schemaState.activeInspectorNodeId}
  {@const selectedNode = schemaState.nodes.find(
    (n) => n.id === schemaState.activeInspectorNodeId,
  )}
  {#if selectedNode}
    {@const data = selectedNode.data as any}
    {@const config =
      targetConfig[(data.target as keyof typeof targetConfig) || "d1"]}

    <div
      class="w-full h-full max-h-full bg-base-100 border-r border-base-300 flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-left-8 duration-300"
      data-testid="inspector-panel"
    >
      <!-- Header -->
      <div
        class="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/50"
      >
        <div class="flex items-center gap-3">
          <div class="p-2.5 {config.bg} rounded-xl shadow-xs">
            <config.icon class="w-4 h-4 {config.text}" />
          </div>
          <div class="flex flex-col grow">
            {#if editingTableName === selectedNode.id}
              <div class="flex items-center gap-1">
                <input
                  bind:value={newTableName}
                  class="input input-xs input-bordered w-full rounded-lg font-bold text-sm h-7 bg-base-100 focus:input-primary transition-all text-base-content"
                  onkeydown={(e) => e.key === "Enter" && submitRenameTable()}
                  data-testid="inspector-rename-table-input"
                />
                <button
                  class="btn btn-primary btn-xs btn-circle"
                  onclick={submitRenameTable}
                  data-testid="inspector-rename-table-submit"
                  ><Check class="w-3 h-3 text-primary-content" /></button
                >
              </div>
            {:else}
              <div class="flex items-center gap-2 group/header">
                <h3
                  class="font-bold text-sm tracking-tight leading-none text-base-content"
                  data-testid="inspector-title"
                >
                  {selectedNode.id}
                </h3>
                {#if !isReadOnly}
                  <button
                    class="opacity-40 group-hover/header:opacity-100 transition-all btn btn-ghost btn-xs btn-circle h-5 w-5 hover:bg-base-200"
                    onclick={() => {
                      editingTableName = selectedNode.id;
                      newTableName = selectedNode.id;
                    }}
                    data-testid="inspector-rename-table-btn"
                  >
                    <Pencil class="w-3 h-3 text-base-content" />
                  </button>
                {/if}
              </div>
            {/if}
            <span
              class="text-[9.5px] uppercase tracking-wider font-bold text-base-content/80 mt-0.5"
              >{config.label}</span
            >
          </div>
        </div>
        <div class="flex items-center gap-1">
          {#if !isReadOnly}
            {#if !isConfirmingDelete}
              <button
                class="btn btn-ghost btn-xs btn-circle hover:text-error hover:bg-error/10 text-base-content/70 hover:opacity-100 transition-all"
                onclick={() => (isConfirmingDelete = true)}
                title="Delete Entity"
                data-testid="delete-entity-button"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            {:else}
              <div
                class="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200 pr-2"
              >
                <button
                  class="btn btn-error btn-xs rounded-lg font-bold text-white shadow-xs"
                  onclick={() => deleteTable(selectedNode.id)}
                  data-testid="confirm-delete-entity-button"
                >
                  Delete?
                </button>
                <button
                  class="btn btn-ghost btn-xs btn-circle hover:bg-base-200"
                  onclick={() => (isConfirmingDelete = false)}
                >
                  <X class="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            {/if}
          {/if}
          <button
            class="btn btn-ghost btn-xs btn-circle hover:bg-base-200"
            onclick={dismiss}
          >
            <X class="w-4 h-4 opacity-60" />
          </button>
        </div>
      </div>

      {#if schemaState.auditIssues.some((i) => i.symbolName === selectedNode.id)}
        {@const issue = schemaState.auditIssues.find(
          (i) => i.symbolName === selectedNode.id,
        )!}
        <div
          class="px-5 py-2.5 bg-warning/10 border-b border-warning/20 flex flex-col gap-1.5 text-xs text-warning"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold flex items-center gap-1.5 text-[11px]">
              <TriangleAlert class="w-3.5 h-3.5 shrink-0 text-warning" />
              <span>JSDoc Metadata Warning</span>
            </span>
            {#if issue.line}
              <button
                class="text-[9px] font-mono underline hover:opacity-80"
                onclick={() => uiState.jumpToCodeLine(issue.line)}
              >
                Line {issue.line} ↗
              </button>
            {/if}
          </div>
          <p class="text-[10.5px] leading-tight text-warning/90">
            {issue.message}
          </p>
          {#if issue.suggestedFix}
            <button
              class="btn btn-xs btn-warning rounded-lg text-[10px] h-6 min-h-6 self-start font-bold gap-1 mt-0.5"
              onclick={() => schemaState.repairNodeJsdoc(selectedNode.id)}
            >
              <Wrench class="w-3 h-3" />
              <span>Auto-Repair JSDoc</span>
            </button>
          {/if}
        </div>
      {/if}

      <!-- JSDoc Audit Issues Banner -->
      {#if schemaState.auditIssues.some((i) => i.symbolName === selectedNode.id)}
        {@const nodeIssues = schemaState.auditIssues.filter(
          (i) => i.symbolName === selectedNode.id,
        )}
        <div
          class="mx-5 mt-4 p-3 rounded-2xl bg-error/10 border border-error/20 flex flex-col gap-2"
        >
          <div class="flex items-center gap-2 text-error text-xs font-bold">
            <TriangleAlert class="w-4 h-4 shrink-0" />
            <span
              >{nodeIssues.length} JSDoc Diagnostic Issue{nodeIssues.length > 1
                ? "s"
                : ""}</span
            >
          </div>
          {#each nodeIssues as issue}
            <p
              class="text-[11px] text-base-content/80 leading-relaxed font-sans"
            >
              {issue.message}
            </p>
          {/each}
          <button
            class="btn btn-error btn-xs rounded-xl font-bold gap-1.5 self-start text-[10px] shadow-sm mt-1"
            onclick={() => schemaState.repairNodeJsdoc(selectedNode.id)}
          >
            <Wrench class="w-3 h-3" />
            <span>Auto-Repair JSDoc Metadata</span>
          </button>
        </div>
      {/if}

      <!-- Tabs Navigation -->

      <div
        class="tabs tabs-boxed rounded-2xl bg-base-200/80 p-1 mx-5 mt-4 flex select-none shrink-0 border border-base-300"
      >
        <button
          class="tab tab-sm grow rounded-xl transition-all text-xs font-semibold py-1.5 {activeTab ===
          'fields'
            ? 'tab-active bg-base-100 shadow-xs font-bold text-primary'
            : 'text-base-content/75 hover:text-base-content'}"
          onclick={() => (activeTab = "fields")}
        >
          Fields ({data.columns.length})
        </button>
        <button
          class="tab tab-sm grow rounded-xl transition-all text-xs font-semibold py-1.5 {activeTab ===
          'relations'
            ? 'tab-active bg-base-100 shadow-xs font-bold text-primary'
            : 'text-base-content/75 hover:text-base-content'}"
          onclick={() => (activeTab = "relations")}
        >
          Relationships ({schemaState.edges.filter(
            (e) => e.source === selectedNode.id || e.target === selectedNode.id,
          ).length})
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-6">
        {#if isReadOnly}
          <div
            class="alert alert-info/10 bg-info/5 text-base-content/90 text-[11px] rounded-2xl flex items-start gap-2.5 border border-info/10 p-3.5 leading-relaxed"
          >
            <span>ℹ️</span>
            <span
              >This entity's structure is read-only (parsed dynamically from
              external source code or wrangler.toml configuration). Modifying
              its fields is disabled.</span
            >
          </div>
        {/if}

        {#if isAddingField}
          <AddFieldForm
            tableName={selectedNode.id}
            onComplete={() => (isAddingField = false)}
          />
        {:else if isCreatingRelation}
          <AddRelationForm
            sourceTableName={selectedNode.id}
            onComplete={() => (isCreatingRelation = false)}
          />
        {:else if activeTab === "fields"}
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between px-1">
              <span
                class="text-[10px] font-bold uppercase opacity-75 text-base-content/75 tracking-wider"
                >Structure</span
              >
            </div>

            <div class="flex flex-col gap-2">
              {#if data.target === "d1" || !data.target}
                <D1Inspector tableName={selectedNode.id} {data} {isReadOnly} />
              {:else if data.target === "kv"}
                <KVInspector tableName={selectedNode.id} {data} {isReadOnly} />
              {:else if data.target === "do"}
                <DOInspector tableName={selectedNode.id} {data} {isReadOnly} />
              {:else if data.target === "r2"}
                <R2Inspector tableName={selectedNode.id} {data} {isReadOnly} />
              {/if}

              {#if !isReadOnly}
                <div class="grid grid-cols-2 gap-2 mt-2">
                  <button
                    class="btn btn-ghost btn-sm border border-dashed border-base-300 rounded-xl h-auto py-3 flex flex-col gap-1 opacity-70 hover:opacity-100 hover:border-primary/60 hover:bg-primary/5 transition-all"
                    onclick={() => (isAddingField = true)}
                    data-testid="add-field-button"
                  >
                    <span class="text-xs font-semibold uppercase tracking-wider"
                      >+ Field</span
                    >
                  </button>
                  <button
                    class="btn btn-ghost btn-sm border border-dashed border-base-300 rounded-xl h-auto py-3 flex flex-col gap-1 opacity-70 hover:opacity-100 hover:border-secondary/60 hover:bg-secondary/5 transition-all"
                    onclick={() => (isCreatingRelation = true)}
                    data-testid="add-relation-button"
                  >
                    <span class="text-xs font-semibold uppercase tracking-wider"
                      >+ Relation</span
                    >
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {:else if activeTab === "relations"}
          {@const tableEdges = schemaState.edges.filter(
            (e: any) =>
              e.source === selectedNode.id || e.target === selectedNode.id,
          )}
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between px-1">
              <span
                class="text-[10px] font-bold uppercase opacity-75 text-base-content/75 tracking-wider"
                >Defined Connections</span
              >
            </div>

            {#if tableEdges.length === 0}
              <div
                class="text-center py-8 text-xs text-base-content/70 font-medium"
              >
                No relationships defined for this entity.
              </div>
            {:else}
              <div class="flex flex-col gap-2">
                {#each tableEdges as edge}
                  {@const isSource = edge.source === selectedNode.id}
                  {@const otherNode = isSource ? edge.target : edge.source}
                  {@const isVirtual = edge.data?.isVirtual}
                  {@const card = edge.data?.cardinality || "unknown"}
                  <div
                    class="bg-base-200/30 p-3.5 rounded-2xl flex flex-col gap-2 border border-base-300/30 hover:border-base-300/60 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-xs font-mono font-bold {isSource
                            ? 'text-primary'
                            : 'text-secondary'}"
                        >
                          {isSource ? "→" : "←"}
                        </span>
                        <span class="font-bold text-xs text-base-content/90"
                          >{otherNode}</span
                        >
                      </div>

                      <span
                        class="badge badge-outline badge-xs text-[9px] uppercase font-mono opacity-80 text-base-content/85 px-1 py-0.5 rounded leading-none"
                      >
                        {card}
                      </span>
                    </div>

                    <div
                      class="flex items-center justify-between mt-1 text-[10px] text-base-content/60"
                    >
                      <div class="flex items-center gap-1.5">
                        <span
                          class="px-1.5 py-0.5 rounded bg-base-200 font-mono text-[9px] font-semibold text-base-content/60 border border-base-300/60"
                        >
                          {isVirtual ? "Logical" : "Physical"}
                        </span>
                        {#if edge.label}
                          <span class="font-mono text-xs opacity-75"
                            >{edge.label}</span
                          >
                        {/if}
                      </div>

                      {#if !isReadOnly}
                        <button
                          class="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10 transition-all"
                          onclick={() => {
                            schemaState.promptConfirm({
                              title: "Delete Relationship",
                              message: `Are you sure you want to delete relationship connection with "${otherNode}"?`,
                              confirmLabel: "Delete Relationship",
                              isDanger: true,
                              onConfirm: () => {
                                schemaState.deleteRelation(
                                  edge.source,
                                  edge.target,
                                  edge.label,
                                );
                              },
                            });
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
            <div
              class="mt-4 p-3.5 bg-base-200/30 border border-base-300/50 rounded-2xl flex flex-col gap-1.5 text-[10px]"
            >
              <span
                class="font-bold text-base-content/85 flex items-center gap-1"
              >
                <Lightbulb class="w-8 h-8 text-info/85 mt-0.5" /> Handle Fallbacks
              </span>
              <p
                class="leading-relaxed opacity-80 text-base-content/80 font-medium"
              >
                Physical foreign key references connect directly to the column
                rows. Logical relations and synthetic references fall back to
                entity-level handles on the sides of the node cards.
              </p>
            </div>

            {#if !isReadOnly}
              <button
                class="btn btn-ghost btn-sm border border-dashed border-base-300 rounded-xl h-auto py-3 flex flex-col gap-1 opacity-70 hover:opacity-100 hover:border-secondary/60 hover:bg-secondary/5 transition-all mt-2"
                onclick={() => (isCreatingRelation = true)}
              >
                <span class="text-xs font-semibold uppercase tracking-wider"
                  >+ Create Relation</span
                >
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer Stats/Hint -->
      <div class="p-6 bg-base-200/30 border-t border-base-300/60">
        <div class="flex flex-col items-center gap-4">
          <p
            class="text-[10px] opacity-75 text-base-content/75 text-center flex items-center gap-1"
          >
            Made with<Heart class="w-4 h-4" fill="red" /> from
            <a
              href="https://frstudios.co.ke"
              class="hover:text-primary transition-colors">FRstudios</a
            >.
          </p>
        </div>
      </div>
    </div>
  {/if}
{/if}
