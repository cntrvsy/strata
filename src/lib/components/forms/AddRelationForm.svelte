<!--
  AddRelationForm.svelte

  Summary: Form to create physical SQLite relationships or logical/synthetic relations.
  Expects: sourceTableName prop and onComplete callback.
  Output: Dispatches relationship additions to the state engine.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { relationSchema } from "$lib/schemas";
  import { schemaState } from "$lib/state";
  import { Link, X } from "lucide-svelte";

  const { sourceTableName, onComplete } = $props<{
    sourceTableName: string;
    onComplete: () => void;
  }>();

  const form = superForm(defaults(valibot(relationSchema)), {
    SPA: true,
    validators: valibot(relationSchema),
    async onUpdate({ form }) {
      if (form.valid && schemaState.filePath) {
        await schemaState.addRelation(
          form.data.source,
          form.data.target,
        );
        onComplete();
      }
    },
  });

  const { form: formData, enhance } = form;

  $effect(() => {
    if (sourceTableName) {
      $formData.source = sourceTableName;
    }
  });

  // Filter out the source table from targets
  const potentialTargets = $derived(
    schemaState.nodes.filter((n) => n.id !== sourceTableName).map((n) => n.id),
  );
</script>

<div
  class="flex flex-col gap-5 p-1 animate-in fade-in slide-in-from-top-2 duration-300"
>
  <div
    class="flex items-center justify-between border-b border-base-300/60 pb-3 mb-1"
  >
    <h4 class="text-[10px] font-bold uppercase tracking-wider opacity-50">
      Create Relation
    </h4>
    <button class="btn btn-ghost btn-xs btn-circle hover:bg-base-200" onclick={onComplete}>
      <X class="w-3.5 h-3.5 opacity-60" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-4">
    <Form.Field {form} name="target">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label
            class="text-[10px] font-semibold opacity-60 mb-1.5 block uppercase tracking-wider"
            >Target Entity</Form.Label
          >
          <select
            {...props}
            bind:value={$formData.target}
            class="select select-sm select-bordered w-full rounded-xl bg-base-200/40 border-base-300/60 focus:select-primary transition-all text-xs"
          >
            <option value="" disabled selected>Select target...</option>
            {#each potentialTargets as target}
              <option value={target}>{target}</option>
            {/each}
          </select>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
    </Form.Field>

    <div class="flex flex-col gap-2 pt-2">
      <button
        type="submit"
        class="btn btn-primary btn-sm rounded-xl w-full gap-2 shadow-sm font-semibold"
        disabled={!$formData.target}
      >
        <Link class="w-3.5 h-3.5" />
        Create Relation
      </button>
      <p class="text-[9px] text-center opacity-40 px-2 leading-tight">
        D1 &rarr; D1: Writes Drizzle relations.<br />
        D1 &rarr; KV/DO: Writes Synthetic JSDoc.
      </p>
    </div>
  </form>
</div>
