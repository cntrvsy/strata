<!--
  AddFieldForm.svelte

  Summary: Form to append new columns/fields to D1 tables, KV schemas, or R2 buckets.
  Expects: tableName prop and onComplete callback.
  Output: Dispatches column/folder additions to the state engine.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { columnSchema } from "$lib/schemas";
  import { schemaState } from "../../state";
  import { X, Check } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const node = $derived(schemaState.nodes.find(n => n.id === tableName));
  const target = $derived((node?.data as any)?.target || "d1");

  const form = superForm(defaults(valibot(columnSchema)), {
    SPA: true,
    validators: valibot(columnSchema),
    async onUpdate({ form }) {
      if (form.valid && schemaState.filePath) {
        await schemaState.addColumn(
          tableName,
          form.data.name,
          form.data.type,
          form.data.referencesTable,
          form.data.referencesColumn,
        );
        onComplete();
      }
    },
  });

  const { form: formData, enhance } = form;

  // Potential targets for Foreign Keys
  const potentialTargets = $derived(
    schemaState.nodes.filter((n) => n.id !== tableName && (n.data as any)?.target === "d1").map((n) => n.id),
  );

  // Columns of the selected reference table
  const potentialColumns = $derived.by(() => {
    if (!$formData.referencesTable) return [];
    const targetNode = schemaState.nodes.find(
      (n) => n.id === $formData.referencesTable,
    );
    return (targetNode?.data as any)?.columns?.map((c: any) => c.name) || [];
  });
</script>

<div
  class="flex flex-col gap-5 p-1 animate-in fade-in slide-in-from-top-2 duration-300"
>
  <div
    class="flex items-center justify-between border-b border-base-300/60 pb-3 mb-1"
  >
    <h4 class="text-[10px] font-bold uppercase tracking-wider opacity-50">
      {target === "r2" ? "Add Folder Path" : "Add Field"}
    </h4>
    <button class="btn btn-ghost btn-xs btn-circle hover:bg-base-200" onclick={onComplete}>
      <X class="w-3.5 h-3.5 opacity-60" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3">
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-semibold opacity-60 mb-1.5 block uppercase tracking-wider"
            >
              {target === "r2" ? "Folder Name/Prefix" : "Name"}
            </Form.Label>
            <input
              {...props}
              bind:value={$formData.name}
              placeholder={target === "r2" ? "e.g. avatars" : "e.g. id, email"}
              class="input input-sm input-bordered w-full rounded-xl bg-base-200/40 border-base-300/60 focus:input-primary transition-all text-xs"
            />
          {/snippet}
        </Form.Control>
      </Form.Field>

      <Form.Field {form} name="type">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-semibold opacity-60 mb-1.5 block uppercase tracking-wider"
            >
              {target === "r2" ? "MIME Type Constraint" : "Type"}
            </Form.Label>
            {#if target === "r2"}
              <input
                {...props}
                bind:value={$formData.type}
                placeholder="e.g. image/*, application/pdf"
                class="input input-sm input-bordered w-full rounded-xl bg-base-200/40 border-base-300/60 focus:input-primary transition-all text-xs font-mono"
              />
            {:else}
              <select
                {...props}
                bind:value={$formData.type}
                class="select select-sm select-bordered w-full rounded-xl bg-base-200/40 border-base-300/60 focus:select-primary transition-all text-xs"
              >
                {#if target === "kv"}
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="any">Any</option>
                {:else}
                  <option value="text">Text</option>
                  <option value="integer">Integer</option>
                  <option value="blob">Blob</option>
                  <option value="real">Real</option>
                {/if}
              </select>
            {/if}
          {/snippet}
        </Form.Control>
      </Form.Field>
    </div>

    <!-- Foreign Key Section (only for D1 tables) -->
    {#if target === "d1"}
      <div
        class="bg-base-200/30 p-4 rounded-2xl border border-base-300/60 flex flex-col gap-3"
      >
        <div class="flex items-center gap-2 opacity-50">
          <div class="w-1.5 h-1.5 rounded-full bg-secondary"></div>
          <span class="text-[9px] font-bold uppercase tracking-wider"
            >Foreign Key (Optional)</span
          >
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Form.Field {form} name="referencesTable">
            <Form.Control>
              {#snippet children({ props })}
                <select
                  {...props}
                  bind:value={$formData.referencesTable}
                  class="select select-xs select-bordered w-full rounded-xl bg-base-100/60 border-base-300/60 focus:select-primary transition-all text-[10px]"
                >
                  <option value="">No Reference</option>
                  {#each potentialTargets as targetName}
                    <option value={targetName}>{targetName}</option>
                  {/each}
                </select>
              {/snippet}
            </Form.Control>
          </Form.Field>

          <Form.Field {form} name="referencesColumn">
            <Form.Control>
              {#snippet children({ props })}
                <select
                  {...props}
                  bind:value={$formData.referencesColumn}
                  disabled={!$formData.referencesTable}
                  class="select select-xs select-bordered w-full rounded-xl bg-base-100/60 border-base-300/60 focus:select-primary transition-all text-[10px] disabled:opacity-50"
                >
                  <option value="">Select col...</option>
                  {#each potentialColumns as col}
                    <option value={col}>{col}</option>
                  {/each}
                </select>
              {/snippet}
            </Form.Control>
          </Form.Field>
        </div>
      </div>
    {/if}

    <button
      type="submit"
      class="btn btn-primary btn-sm rounded-xl w-full gap-2 mt-2 shadow-sm font-semibold"
    >
      <Check class="w-3.5 h-3.5" />
      {target === "r2" ? "Add Folder Path" : "Create Field"}
    </button>
  </form>
</div>
