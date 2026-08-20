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
  import { schemaState } from "$lib/state";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X, Check, Lightbulb } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const node = $derived(schemaState.nodes.find((n) => n.id === tableName));
  const target = $derived((node?.data as any)?.target || "d1");

  const form = superForm(defaults(valibot(columnSchema)), {
    SPA: true,
    validators: valibot(columnSchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
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
    schemaState.nodes
      .filter((n) => n.id !== tableName && (n.data as any)?.target === "d1")
      .map((n) => n.id),
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
  class="flex flex-col gap-5 p-1"
  transition:slide={{ duration: 140, easing: cubicOut }}
>
  <div
    class="flex items-center justify-between border-b border-base-300/60 pb-3 mb-1"
  >
    <h4 class="text-[10px] font-bold uppercase tracking-wider opacity-50">
      {target === "r2"
        ? "Add Folder Path"
        : target === "do"
          ? "Add Public Method"
          : "Add Field"}
    </h4>
    <button
      class="btn btn-ghost btn-xs btn-circle hover:bg-base-200 transition-colors"
      onclick={onComplete}
      title="Close form"
    >
      <X class="w-3.5 h-3.5 opacity-60" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-4">
    <div class="flex flex-col gap-3">
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <fieldset class="fieldset gap-1 p-0">
              <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
                {target === "r2"
                  ? "Folder Name/Prefix"
                  : target === "do"
                    ? "Method Signature"
                    : "Name"}
              </legend>
              <input
                {...props}
                bind:value={$formData.name}
                placeholder={target === "r2"
                  ? "e.g. avatars"
                  : target === "do"
                    ? "e.g. getValue() or getVal(id: number)"
                    : "e.g. id, email"}
                class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-primary transition-all text-xs font-mono"
              />
            </fieldset>
          {/snippet}
        </Form.Control>
      </Form.Field>

      <Form.Field {form} name="type">
        <Form.Control>
          {#snippet children({ props })}
            <fieldset class="fieldset gap-1 p-0">
              <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
                {target === "r2"
                  ? "MIME Type Constraint"
                  : target === "do"
                    ? "Return Type"
                    : "Type"}
              </legend>
              {#if target === "r2"}
                <input
                  {...props}
                  bind:value={$formData.type}
                  placeholder="e.g. image/*, application/pdf"
                  class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-primary transition-all text-xs font-mono"
                />
              {:else}
                <select
                  {...props}
                  bind:value={$formData.type}
                  class="select select-sm select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-xs font-medium"
                >
                  {#if target === "kv"}
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="any">Any</option>
                  {:else if target === "do"}
                    <option value="Promise<any>">Promise&lt;any&gt;</option>
                    <option value="Promise<string>">Promise&lt;string&gt;</option>
                    <option value="Promise<number>">Promise&lt;number&gt;</option>
                    <option value="Promise<boolean>">Promise&lt;boolean&gt;</option>
                    <option value="Promise<void>">Promise&lt;void&gt;</option>
                  {:else}
                    <option value="text">Text (String)</option>
                    <option value="integer">Integer (Number)</option>
                    <option value="timestamp">Timestamp (Date &rarr; mode: "timestamp")</option>
                    <option value="boolean_int">Boolean (0/1 &rarr; mode: "boolean")</option>
                    <option value="real">Real (Float)</option>
                    <option value="blob">Blob (Binary)</option>
                  {/if}
                </select>
                {#if target === "d1" && $formData.type === "timestamp"}
                  <div
                    class="flex items-start gap-1.5 p-2 bg-primary/5 rounded-field border border-primary/10 mt-1.5 text-[10px] text-primary font-medium"
                  >
                    <Lightbulb class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong>D1 Date:</strong> Generates
                      <code>integer("{$formData.name || "field"}", &#123; mode: "timestamp" &#125;)</code> for native JS Date mapping.
                    </div>
                  </div>
                {:else if target === "d1" && $formData.type === "boolean_int"}
                  <div
                    class="flex items-start gap-1.5 p-2 bg-primary/5 rounded-field border border-primary/10 mt-1.5 text-[10px] text-primary font-medium"
                  >
                    <Lightbulb class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong>D1 Boolean:</strong> Generates
                      <code>integer("{$formData.name || "field"}", &#123; mode: "boolean" &#125;)</code> for 0/1 boolean flags.
                    </div>
                  </div>
                {/if}
              {/if}
            </fieldset>
          {/snippet}
        </Form.Control>
      </Form.Field>
    </div>

    <!-- Foreign Key Section (only for D1 tables) -->
    {#if target === "d1"}
      <div
        class="bg-base-200/50 p-3.5 rounded-box border border-base-300 flex flex-col gap-3"
      >
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-secondary"></div>
          <span
            class="text-[9.5px] font-bold text-base-content/80 uppercase tracking-wider"
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
                  class="select select-xs select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-[10px]"
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
                  class="select select-xs select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
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
      class="btn btn-primary btn-sm rounded-field w-full gap-2 mt-2 shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
      disabled={!$formData.name.trim()}
    >
      <Check class="w-3.5 h-3.5" />
      {target === "r2"
        ? "Add Folder Path"
        : target === "do"
          ? "Create Method"
          : "Create Field"}
    </button>
  </form>
</div>

