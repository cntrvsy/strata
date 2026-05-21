<script lang="ts">
  /**
   * AddRelationForm Component
   * Forges relationships between entities.
   * Logic intelligently switches between Drizzle relations() and Synthetic JSDoc.
   */
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { relationSchema } from "$lib/schemas";
  import { schemaState } from "../state.svelte";
  import { addEdgeToSchema } from "$lib/parser";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
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
        const newCode = addEdgeToSchema(
          schemaState.rawCode,
          form.data.source,
          form.data.target,
        );

        schemaState.machine.send("SAVE");
        try {
          await writeTextFile(schemaState.filePath, newCode);
          await schemaState.syncWithFile();
          schemaState.machine.send("SAVE_SUCCESS");
          onComplete();
        } catch (err) {
          schemaState.machine.send("SAVE_ERROR");
          console.error("Failed to auto-save relation:", err);
        }
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
    class="flex items-center justify-between border-b border-base-300 pb-3 mb-1"
  >
    <h4 class="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
      Forge Relation
    </h4>
    <button class="btn btn-ghost btn-xs btn-circle" onclick={onComplete}>
      <X class="w-3 h-3" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-4">
    <Form.Field {form} name="target">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label
            class="text-[10px] font-bold opacity-50 mb-1.5 block uppercase"
            >Target Entity</Form.Label
          >
          <select
            {...props}
            bind:value={$formData.target}
            class="select select-sm select-bordered w-full rounded-xl bg-base-200 focus:border-primary transition-all text-xs"
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
        class="btn btn-primary btn-sm rounded-xl w-full gap-2 shadow-lg shadow-primary/20"
        disabled={!$formData.target}
      >
        <Link class="w-3 h-3" />
        Forge Edge
      </button>
      <p class="text-[9px] text-center opacity-40 px-2 leading-tight">
        D1 &rarr; D1: Writes Drizzle relations.<br />
        D1 &rarr; KV/DO: Writes Synthetic JSDoc.
      </p>
    </div>
  </form>
</div>
