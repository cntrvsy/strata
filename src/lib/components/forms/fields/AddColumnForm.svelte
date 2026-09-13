<!--
  AddColumnForm.svelte

  Summary: Dedicated form to append new SQL columns to D1 database tables.
  Expects: tableName prop and onComplete callback.
  Output: Dispatches column additions to the schemaState engine.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { d1ColumnSchema } from "#lib/schemas";
  import { schemaState } from "#lib/state";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X, Check, Lightbulb, TriangleAlert } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const node = $derived(schemaState.nodes.find((n) => n.id === tableName));
  const existingColumns = $derived<string[]>(
    ((node?.data as any)?.columns || []).map((c: any) => c.name.toLowerCase())
  );

  const form = superForm(defaults(valibot(d1ColumnSchema)), {
    SPA: true,
    validators: valibot(d1ColumnSchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
        if (existingColumns.includes(form.data.name.trim().toLowerCase())) {
          return;
        }
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

  // Check collision in real-time
  const isDuplicate = $derived(
    $formData.name.trim() !== "" &&
      existingColumns.includes($formData.name.trim().toLowerCase())
  );

  // Targets for Foreign Keys (including self-reference for trees/hierarchies)
  const potentialTargets = $derived(
    schemaState.nodes
      .filter((n) => (n.data as any)?.target === "d1")
      .map((n) => n.id)
  );

  // Columns of the selected reference table
  const potentialColumns = $derived.by(() => {
    if (!$formData.referencesTable) return [];
    const targetNode = schemaState.nodes.find(
      (n) => n.id === $formData.referencesTable
    );
    return (targetNode?.data as any)?.columns?.map((c: any) => c.name) || [];
  });
</script>

<div
  class="flex flex-col gap-4 p-1"
  transition:slide={{ duration: 140, easing: cubicOut }}
  data-testid="add-column-form"
>
  <div class="flex items-center justify-between border-b border-base-300/60 pb-2.5">
    <div class="flex items-center gap-1.5">
      <div class="w-2 h-2 rounded-full bg-primary"></div>
      <h4 class="text-[10px] font-bold uppercase tracking-wider text-base-content/80">
        Add D1 Column
      </h4>
    </div>
    <button
      class="btn btn-ghost btn-xs btn-circle hover:bg-base-200 transition-colors"
      onclick={onComplete}
      title="Close form"
      type="button"
    >
      <X class="w-3.5 h-3.5 opacity-60" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-3.5">
    <!-- Column Name -->
    <Form.Field {form} name="name">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Column Name
            </legend>
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="e.g. id, email, user_id"
              class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-primary transition-all text-xs font-mono {isDuplicate ? 'input-error' : ''}"
            />
          </fieldset>
        {/snippet}
      </Form.Control>
      {#if isDuplicate}
        <div class="flex items-center gap-1.5 text-[10px] text-error font-medium mt-1">
          <TriangleAlert class="w-3 h-3 shrink-0" />
          <span>Column "{ $formData.name }" already exists on this table.</span>
        </div>
      {/if}
      <Form.FieldErrors class="text-[10px] text-error font-medium mt-1" />
    </Form.Field>

    <!-- Column Type -->
    <Form.Field {form} name="type">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Data Type
            </legend>
            <select
              {...props}
              bind:value={$formData.type}
              class="select select-sm select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-xs font-medium"
            >
              <option value="text">Text (String)</option>
              <option value="integer">Integer (Number)</option>
              <option value="timestamp">Timestamp (Date &rarr; mode: "timestamp")</option>
              <option value="boolean_int">Boolean (0/1 &rarr; mode: "boolean")</option>
              <option value="real">Real (Float)</option>
              <option value="blob">Blob (Binary)</option>
            </select>
          </fieldset>
        {/snippet}
      </Form.Control>
    </Form.Field>

    {#if $formData.type === "timestamp"}
      <div class="flex items-start gap-1.5 p-2 bg-primary/5 rounded-field border border-primary/15 text-[10px] text-primary font-medium">
        <Lightbulb class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <div>
          Generates <code>integer("{$formData.name || 'col'}", &#123; mode: "timestamp" &#125;)</code> for Date serialization.
        </div>
      </div>
    {:else if $formData.type === "boolean_int"}
      <div class="flex items-start gap-1.5 p-2 bg-primary/5 rounded-field border border-primary/15 text-[10px] text-primary font-medium">
        <Lightbulb class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <div>
          Generates <code>integer("{$formData.name || 'col'}", &#123; mode: "boolean" &#125;)</code> for 0/1 boolean flags.
        </div>
      </div>
    {/if}

    <!-- Foreign Key Section (Optional) -->
    <div class="bg-base-200/50 p-3 rounded-box border border-base-300 flex flex-col gap-2.5">
      <div class="flex items-center justify-between">
        <span class="text-[9.5px] font-bold text-base-content/80 uppercase tracking-wider">
          Foreign Key Reference (Optional)
        </span>
        {#if $formData.referencesTable === tableName}
          <span class="badge badge-xs badge-info font-mono text-[8px]">Self-Ref Tree</span>
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-2">
        <Form.Field {form} name="referencesTable">
          <Form.Control>
            {#snippet children({ props })}
              <select
                {...props}
                bind:value={$formData.referencesTable}
                class="select select-xs select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-[10px]"
              >
                <option value="">No Reference</option>
                {#each potentialTargets as targetName}
                  <option value={targetName}>
                    {targetName} {targetName === tableName ? '(self)' : ''}
                  </option>
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
                class="select select-xs select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Select column...</option>
                {#each potentialColumns as col}
                  <option value={col}>{col}</option>
                {/each}
              </select>
            {/snippet}
          </Form.Control>
        </Form.Field>
      </div>
    </div>

    <button
      type="submit"
      class="btn btn-primary btn-sm rounded-field w-full gap-2 mt-1 shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isDuplicate || !$formData.name.trim()}
    >
      <Check class="w-3.5 h-3.5" />
      <span>Add Field</span>
    </button>
  </form>
</div>
