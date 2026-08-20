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
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Link, X, Info, CircleCheck } from "lucide-svelte";

  const { sourceTableName, onComplete } = $props<{
    sourceTableName: string;
    onComplete: () => void;
  }>();

  const form = superForm(defaults(valibot(relationSchema)), {
    SPA: true,
    validators: valibot(relationSchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
        await schemaState.addRelation(sourceTableName, form.data.target);
        onComplete();
      }
    },
  });

  const { form: formData, enhance } = form;

  $effect(() => {
    $formData.source = sourceTableName;
  });

  // Filter out the source table from targets
  const potentialTargets = $derived(
    schemaState.nodes.filter((n) => n.id !== sourceTableName).map((n) => n.id),
  );

  const sourceNode = $derived(
    schemaState.nodes.find((n) => n.id === sourceTableName),
  );
  const sourceType = $derived((sourceNode?.data as any)?.target || "d1");

  const targetNode = $derived(
    schemaState.nodes.find((n) => n.id === $formData.target),
  );
  const targetType = $derived((targetNode?.data as any)?.target || "d1");

  const isSqlRelational = $derived(sourceType === "d1" && targetType === "d1");
</script>

<div
  class="flex flex-col gap-5 p-1"
  transition:slide={{ duration: 140, easing: cubicOut }}
>
  <div
    class="flex items-center justify-between border-b border-base-300/60 pb-3 mb-1"
  >
    <h4 class="text-[10px] font-bold uppercase tracking-wider opacity-50">
      Create Relation
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
    <Form.Field {form} name="target">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend
              class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider"
              >Target Entity</legend
            >
            {#if potentialTargets.length > 0}
              <select
                {...props}
                bind:value={$formData.target}
                class="select select-sm select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-primary transition-all text-xs font-medium"
              >
                <option value="" disabled selected>Select target...</option>
                {#each potentialTargets as target}
                  {@const n = schemaState.nodes.find((x) => x.id === target)}
                  {@const t = (n?.data as any)?.target || "d1"}
                  <option value={target}>{target} ({t.toUpperCase()})</option>
                {/each}
              </select>
            {:else}
              <div
                class="p-3 bg-base-200/40 rounded-box border border-base-300/60 text-[11px] text-base-content/60 font-medium leading-relaxed"
              >
                No other entities available in the schema to create a
                relationship with. Create another table or binding first.
              </div>
            {/if}
          </fieldset>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
    </Form.Field>

    {#if $formData.target}
      {#if isSqlRelational}
        <div
          class="p-3 bg-success/5 border border-success/15 rounded-box flex items-start gap-2.5 text-[11px] leading-relaxed"
        >
          <CircleCheck class="w-4 h-4 text-success shrink-0 mt-0.5" />
          <div>
            <span class="font-bold text-success block"
              >D1 Relational Connection</span
            >
            <span class="text-base-content/80 text-[10.5px]"
              >Creates a Drizzle <code>relations()</code> helper block in
              <code>schema.ts</code> linking relational tables.</span
            >
          </div>
        </div>
      {:else}
        <div
          class="p-3 bg-info/5 border border-info/15 rounded-box flex items-start gap-2.5 text-[11px] leading-relaxed"
        >
          <Info class="w-4 h-4 text-info shrink-0 mt-0.5" />
          <div>
            <span class="font-bold text-info block"
              >Logical Storage Association</span
            >
            <span class="text-base-content/80 text-[10.5px]"
              >Links a Cloudflare {targetType.toUpperCase()} binding endpoint. Strata
              renders a visual JSDoc association line on the ERD without SQL foreign
              keys.</span
            >
          </div>
        </div>
      {/if}
    {/if}

    <div class="flex flex-col gap-2 pt-1">
      <button
        type="submit"
        class="btn btn-primary btn-sm rounded-field w-full gap-2 shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
        disabled={!$formData.target}
      >
        <Link class="w-3.5 h-3.5" />
        Create Relation
      </button>
      <p class="text-[9px] text-center opacity-40 px-2 leading-tight">
        D1 &rarr; D1: Drizzle relations.<br />
        D1 &rarr; KV/R2/DO: Visual JSDoc association.
      </p>
    </div>
  </form>
</div>
