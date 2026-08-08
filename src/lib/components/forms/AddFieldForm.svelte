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
  import { X, Check } from "lucide-svelte";

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
  class="flex flex-col gap-5 p-1 animate-in fade-in slide-in-from-top-2 duration-300"
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
      class="btn btn-ghost btn-xs btn-circle hover:bg-base-200"
      onclick={onComplete}
    >
      <X class="w-3.5 h-3.5 opacity-60" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-4">
    <div class="flex flex-col gap-3">
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-bold text-base-content/80 mb-1 block uppercase tracking-wider"
            >
              {target === "r2"
                ? "Folder Name/Prefix"
                : target === "do"
                  ? "Method Signature"
                  : "Name"}
            </Form.Label>
            <input
              {...props}
              bind:value={$formData.name}
              placeholder={target === "r2"
                ? "e.g. avatars"
                : target === "do"
                  ? "e.g. getValue() or getVal(id: number)"
                  : "e.g. id, email"}
              class="input input-sm input-bordered w-full rounded-xl bg-base-100 border-base-300 text-base-content focus:input-primary transition-all text-xs font-mono"
            />
          {/snippet}
        </Form.Control>
      </Form.Field>

      <Form.Field {form} name="type">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-bold text-base-content/80 mb-1 block uppercase tracking-wider"
            >
              {target === "r2"
                ? "MIME Type Constraint"
                : target === "do"
                  ? "Return Type"
                  : "Type"}
            </Form.Label>
            {#if target === "r2"}
              <input
                {...props}
                bind:value={$formData.type}
                placeholder="e.g. image/*, application/pdf"
                class="input input-sm input-bordered w-full rounded-xl bg-base-100 border-base-300 text-base-content focus:input-primary transition-all text-xs font-mono"
              />
            {:else}
              <select
                {...props}
                bind:value={$formData.type}
                class="select select-sm select-bordered w-full rounded-xl bg-base-100 border-base-300 text-base-content focus:select-primary transition-all text-xs font-medium"
              >
                {#if target === "kv"}
                  <option class="bg-base-100 text-base-content" value="string">String</option>
                  <option class="bg-base-100 text-base-content" value="number">Number</option>
                  <option class="bg-base-100 text-base-content" value="boolean">Boolean</option>
                  <option class="bg-base-100 text-base-content" value="any">Any</option>
                {:else if target === "do"}
                  <option class="bg-base-100 text-base-content" value="Promise<any>">Promise&lt;any&gt;</option>
                  <option class="bg-base-100 text-base-content" value="Promise<string>">Promise&lt;string&gt;</option>
                  <option class="bg-base-100 text-base-content" value="Promise<number>">Promise&lt;number&gt;</option>
                  <option class="bg-base-100 text-base-content" value="Promise<boolean>">Promise&lt;boolean&gt;</option>
                  <option class="bg-base-100 text-base-content" value="Promise<void>">Promise&lt;void&gt;</option>
                {:else}
                  <option class="bg-base-100 text-base-content" value="text">Text (String)</option>
                  <option class="bg-base-100 text-base-content" value="integer">Integer (Number)</option>
                  <option class="bg-base-100 text-base-content" value="timestamp">Timestamp (Date → mode: "timestamp")</option>
                  <option class="bg-base-100 text-base-content" value="boolean_int">Boolean (0/1 → mode: "boolean")</option>
                  <option class="bg-base-100 text-base-content" value="real">Real (Float)</option>
                  <option class="bg-base-100 text-base-content" value="blob">Blob (Binary)</option>
                {/if}
              </select>
              {#if target === "d1" && $formData.type === "timestamp"}
                <p class="text-[9.5px] text-primary mt-1 font-sans leading-tight font-medium">
                  💡 <strong>D1 Date:</strong> Generates <code>integer("{$formData.name || 'field'}", &#123; mode: "timestamp" &#125;)</code> for native JS Date mapping.
                </p>
              {:else if target === "d1" && $formData.type === "boolean_int"}
                <p class="text-[9.5px] text-primary mt-1 font-sans leading-tight font-medium">
                  💡 <strong>D1 Boolean:</strong> Generates <code>integer("{$formData.name || 'field'}", &#123; mode: "boolean" &#125;)</code> for 0/1 boolean flags.
                </p>
              {/if}
            {/if}
          {/snippet}
        </Form.Control>
      </Form.Field>
    </div>

    <!-- Foreign Key Section (only for D1 tables) -->
    {#if target === "d1"}
      <div
        class="bg-base-200/50 p-3.5 rounded-2xl border border-base-300 flex flex-col gap-3"
      >
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-secondary"></div>
          <span class="text-[9.5px] font-bold text-base-content/80 uppercase tracking-wider"
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
                  class="select select-xs select-bordered w-full rounded-xl bg-base-100 border-base-300 text-base-content focus:select-primary transition-all text-[10px]"
                >
                  <option class="bg-base-100 text-base-content" value="">No Reference</option>
                  {#each potentialTargets as targetName}
                    <option class="bg-base-100 text-base-content" value={targetName}>{targetName}</option>
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
                  class="select select-xs select-bordered w-full rounded-xl bg-base-100 border-base-300 text-base-content focus:select-primary transition-all text-[10px] disabled:opacity-50"
                >
                  <option class="bg-base-100 text-base-content" value="">Select col...</option>
                  {#each potentialColumns as col}
                    <option class="bg-base-100 text-base-content" value={col}>{col}</option>
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
      {target === "r2"
        ? "Add Folder Path"
        : target === "do"
          ? "Create Method"
          : "Create Field"}
    </button>
  </form>
</div>
