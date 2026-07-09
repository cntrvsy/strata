<!--
  R2Inspector.svelte

  Summary: Sub-inspector displaying and mutating directory paths for Cloudflare R2.
  Expects: tableName (string), data (object showing columns), isReadOnly (boolean).
-->
<script lang="ts">
  import { Pencil, Trash2, Check } from "lucide-svelte";
  import { schemaState } from "../../state";

  let { tableName, data, isReadOnly } = $props<{
    tableName: string;
    data: any;
    isReadOnly: boolean;
  }>();

  let editingColumnName = $state<string | null>(null);
  let newColumnName = $state("");

  async function submitRenameColumn() {
    if (!editingColumnName || !newColumnName) return;
    await schemaState.renameColumn(tableName, editingColumnName, newColumnName);
    editingColumnName = null;
  }

  async function deleteColumn(colName: string) {
    await schemaState.deleteColumn(tableName, colName);
  }
</script>

<div class="flex flex-col gap-2">
  {#each data.columns as col}
    <div
      class="bg-base-200/30 p-3 rounded-xl flex flex-col gap-1.5 border border-base-300/30 hover:border-base-300/60 transition-all group"
      data-testid="field-row-{col.name}"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 grow">
          {#if editingColumnName === col.name}
            <div class="flex items-center gap-1 grow">
              <input
                bind:value={newColumnName}
                class="input input-xs input-bordered w-full rounded-lg font-semibold text-xs h-7 bg-base-100 focus:input-primary transition-all font-mono"
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
              <span class="font-mono text-xs font-bold group-hover/field:text-primary transition-colors text-base-content/85">
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
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-mono opacity-50 uppercase bg-info/10 text-info px-1.5 py-0.5 rounded leading-none shrink-0 border border-info/15 font-bold">
            {col.definition}
          </span>
          {#if !isReadOnly}
            <button
              class="opacity-0 group-hover/field:opacity-100 btn btn-ghost btn-xs btn-circle text-error/60 hover:text-error hover:bg-error/10 transition-all"
              onclick={() => deleteColumn(col.name)}
            >
              <Trash2 class="w-3 h-3" />
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>
