<!--
  KVInspector.svelte

  Summary: Sub-inspector displaying and mutating key-value mappings for Cloudflare KV.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
-->
<script lang="ts">
  import { Pencil, Trash2, Check, SlidersHorizontal } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import { schemaState } from "../../state";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  let editingColumnName = $state<string | null>(null);
  let newColumnName = $state("");

  // Advanced settings state
  let expandedKey = $state<string | null>(null);
  let selectedType = $state("string");
  let selectedTtl = $state<number | null>(null);
  let selectedMetadata = $state("");

  async function submitRenameColumn() {
    if (!editingColumnName || !newColumnName) return;
    await schemaState.renameColumn(tableName, editingColumnName, newColumnName);
    editingColumnName = null;
  }

  async function deleteColumn(colName: string) {
    await schemaState.deleteColumn(tableName, colName);
  }

  function toggleSettings(col: any) {
    if (expandedKey === col.name) {
      expandedKey = null;
    } else {
      expandedKey = col.name;
      selectedType = col.definition || "string";
      selectedTtl = col.ttl !== undefined && col.ttl !== null ? col.ttl : null;
      selectedMetadata = col.metadata || "";
    }
  }

  async function saveKeySettings(colName: string) {
    if (selectedTtl !== null && selectedTtl !== undefined && selectedTtl < 60) {
      toast.error("Invalid expiration TTL", {
        description: "Cloudflare KV expiration TTL must be at least 60 seconds."
      });
      return;
    }
    await schemaState.updateColumnModifiers(tableName, colName, {
      defaultVal: selectedType,
      ttl: selectedTtl,
      metadata: selectedMetadata
    });
    expandedKey = null;
  }
</script>

<div class="flex flex-col gap-2">
  {#each data.columns as col}
    <div
      class="bg-base-200/30 p-3 rounded-xl flex flex-col gap-2 border border-base-300/30 hover:border-base-300/60 transition-all group"
      data-testid="field-row-{col.name}"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 grow">
          {#if editingColumnName === col.name}
            <div class="flex items-center gap-1 grow">
              <input
                bind:value={newColumnName}
                class="input input-xs input-bordered w-full rounded-lg font-semibold text-xs h-7 bg-base-100 focus:input-primary transition-all"
                onkeydown={(e) => e.key === "Enter" && submitRenameColumn()}
              />
              <button
                class="btn btn-primary btn-xs btn-circle"
                onclick={submitRenameColumn}
              >
                <Check class="w-3 h-3 text-primary-content" />
              </button>
            </div>
          {:else}
            <div class="flex items-center gap-2 group/col-title">
              <span class="font-bold text-xs group-hover/field:text-primary transition-colors text-base-content/85">
                {col.name}
              </span>
              {#if !isReadOnly}
                <button
                  class="opacity-0 group-hover/col-title:opacity-30 hover:opacity-100! transition-all btn btn-ghost btn-xs btn-circle h-4.5 w-4.5 hover:bg-base-200"
                  onclick={() => {
                    editingColumnName = col.name;
                    newColumnName = col.name;
                  }}
                >
                  <Pencil class="w-2.5 h-2.5 opacity-60" />
                </button>
              {/if}
            </div>
          {/if}
        </div>
        <div class="flex items-center gap-1.5">
          {#if col.ttl !== undefined && col.ttl !== null}
            <span class="badge badge-xs bg-info/10 text-info border-info/20 px-1 py-0.5 rounded text-[8px] font-bold font-mono">
              TTL: {col.ttl}s
            </span>
          {/if}
          {#if col.metadata}
            <span class="badge badge-xs bg-success/10 text-success border-success/20 px-1 py-0.5 rounded text-[8px] font-bold font-mono truncate max-w-[80px]" title={col.metadata}>
              Meta: {col.metadata}
            </span>
          {/if}
          <span class="text-[9px] font-mono opacity-50 uppercase bg-base-300/50 px-1.5 py-0.5 rounded border border-base-300/30 font-bold">
            {col.definition}
          </span>
          {#if !isReadOnly}
            <button
              class="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-base-content/65 hover:bg-base-200 transition-all"
              onclick={() => toggleSettings(col)}
              title="Advanced Settings"
            >
              <SlidersHorizontal class="w-3 h-3" />
            </button>
            <button
              class="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10 transition-all"
              onclick={() => deleteColumn(col.name)}
              title="Delete Key"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          {/if}
        </div>
      </div>

      {#if expandedKey === col.name && !isReadOnly}
        <div class="border-t border-base-300/40 pt-2 mt-1 flex flex-col gap-2.5 animate-in fade-in duration-200">
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <span class="text-[9px] font-bold uppercase opacity-40">Value Type</span>
              <select
                bind:value={selectedType}
                class="select select-xs select-bordered w-full rounded-lg bg-base-100 border-base-300/60 focus:select-primary transition-all text-[10px]"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="any">Any</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[9px] font-bold uppercase opacity-40">Expiration TTL (s)</span>
              <input
                type="number"
                bind:value={selectedTtl}
                placeholder="None"
                min="60"
                class="input input-xs input-bordered w-full rounded-lg bg-base-100 border-base-300/60 focus:input-primary transition-all text-[10px]"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-[9px] font-bold uppercase opacity-40">Metadata String / Description</span>
            <input
              type="text"
              bind:value={selectedMetadata}
              placeholder="e.g. user-profile, system-config"
              class="input input-xs input-bordered w-full rounded-lg bg-base-100 border-base-300/60 focus:input-primary transition-all text-[10px] font-mono"
            />
          </div>

          <div class="flex justify-end gap-1.5">
            <button
              class="btn btn-ghost btn-xs rounded-lg px-3 text-[10px]"
              onclick={() => expandedKey = null}
            >
              Cancel
            </button>
            <button
              class="btn btn-primary btn-xs rounded-lg px-4 text-[10px] font-semibold text-primary-content"
              onclick={() => saveKeySettings(col.name)}
            >
              Save Settings
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>
