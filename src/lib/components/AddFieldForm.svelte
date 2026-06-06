<script lang="ts">
  /**
   * AddFieldForm Component
   * Appends new columns to D1 tables or fields to KV/DO objects.
   * Supports Foreign Key selection.
   */
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { columnSchema } from "$lib/schemas";
  import { schemaState } from "../state.svelte";
  import { addColumnToSchema } from "$lib/parser";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { X, Check } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const form = superForm(defaults(valibot(columnSchema)), {
    SPA: true,
    validators: valibot(columnSchema),
    async onUpdate({ form }) {
      if (form.valid && schemaState.filePath) {
        const newCode = addColumnToSchema(
          schemaState.rawCode,
          tableName,
          form.data.name,
          form.data.type,
          form.data.referencesTable,
          form.data.referencesColumn,
        );

        schemaState.machine.send("SAVE");
        try {
          await writeTextFile(schemaState.filePath, newCode);
          await schemaState.syncWithFile();
          schemaState.machine.send("SAVE_SUCCESS");
          onComplete();
        } catch (err) {
          schemaState.machine.send("SAVE_ERROR");
          console.error("Failed to auto-save new column:", err);
        }
      }
    },
  });

  const { form: formData, enhance } = form;

  // Potential targets for Foreign Keys
  const potentialTargets = $derived(
    schemaState.nodes.filter((n) => n.id !== tableName).map((n) => n.id),
  );

  // Columns of the selected reference table
  const potentialColumns = $derived.by(() => {
    if (!$formData.referencesTable) return [];
    const target = schemaState.nodes.find(
      (n) => n.id === $formData.referencesTable,
    );
    return (target?.data as any)?.columns?.map((c: any) => c.name) || [];
  });
</script>

<div
  class="flex flex-col gap-5 p-1 animate-in fade-in slide-in-from-top-2 duration-300"
>
  <div
    class="flex items-center justify-between border-b border-base-300 pb-3 mb-1"
  >
    <h4 class="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
      Add Field
    </h4>
    <button class="btn btn-ghost btn-xs btn-circle" onclick={onComplete}>
      <X class="w-3 h-3" />
    </button>
  </div>

  <form use:enhance class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3">
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-bold opacity-50 mb-1.5 block uppercase"
              >Name</Form.Label
            >
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="id, created_at..."
              class="input input-sm input-bordered w-full rounded-lg bg-base-200 focus:border-primary transition-all text-xs"
            />
          {/snippet}
        </Form.Control>
      </Form.Field>

      <Form.Field {form} name="type">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-bold opacity-50 mb-1.5 block uppercase"
              >Type</Form.Label
            >
            <select
              {...props}
              bind:value={$formData.type}
              class="select select-sm select-bordered w-full rounded-lg bg-base-200 focus:border-primary transition-all text-xs"
            >
              <option value="text">Text</option>
              <option value="integer">Integer</option>
              <option value="blob">Blob</option>
              <option value="real">Real</option>
            </select>
          {/snippet}
        </Form.Control>
      </Form.Field>
    </div>

    <!-- Foreign Key Section -->
    <div
      class="bg-base-200/50 p-4 rounded-lg border border-base-300 flex flex-col gap-3"
    >
      <div class="flex items-center gap-2 opacity-40">
        <div class="w-1.5 h-1.5 rounded-full bg-secondary"></div>
        <span class="text-[9px] font-black uppercase tracking-widest"
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
                class="select select-xs select-bordered w-full rounded-lg bg-base-100 transition-all text-[10px]"
              >
                <option value="">No Reference</option>
                {#each potentialTargets as target}
                  <option value={target}>{target}</option>
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
                class="select select-xs select-bordered w-full rounded-lg bg-base-100 transition-all text-[10px]"
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

    <button
      type="submit"
      class="btn btn-primary btn-sm rounded-lg w-full gap-2 mt-2 shadow-lg shadow-primary/20"
    >
      <Check class="w-3 h-3" />
      Forge Field
    </button>
  </form>
</div>
