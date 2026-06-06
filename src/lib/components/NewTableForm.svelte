<script lang="ts">
  /**
   * NewTableForm Component
   * Handles the creation of new storage entities (D1 Tables, KV, DO).
   * Implements the Disk-First save pattern.
   */
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { tableSchema } from "$lib/schemas";
  import { schemaState } from "../state.svelte";
  import { addTableToSchema } from "$lib/parser";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { Database, Cpu, Zap, X } from "lucide-svelte";

  const form = superForm(defaults(valibot(tableSchema)), {
    SPA: true,
    validators: valibot(tableSchema),
    async onUpdate({ form }) {
      if (form.valid && schemaState.filePath) {
        const newCode = addTableToSchema(
          schemaState.rawCode,
          form.data.name,
          form.data.target as any,
        );

        schemaState.machine.send("SAVE");
        try {
          await writeTextFile(schemaState.filePath, newCode);
          await schemaState.syncWithFile();
          schemaState.machine.send("SAVE_SUCCESS");
          schemaState.showNewTableModal = false;
        } catch (err) {
          schemaState.machine.send("SAVE_ERROR");
          console.error("Failed to auto-save new table:", err);
        }
      }
    },
  });

  const { form: formData, enhance, errors } = form;
</script>

<div
  class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-base-900/60 backdrop-blur-sm animate-in fade-in duration-300"
>
  <div
    class="bg-base-100 border border-base-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
    data-testid="new-table-modal"
  >
    <div
      class="p-6 border-b border-base-300 flex items-center justify-between bg-base-200/50"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <Database class="w-5 h-5 text-primary" />
        </div>
        <h2 class="text-lg font-bold tracking-tight">Forge New Entity</h2>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        onclick={() => (schemaState.showNewTableModal = false)}
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <form use:enhance class="p-8 flex flex-col gap-6">
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block"
              >Entity Name</Form.Label
            >
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="e.g. users_table"
              class="input input-bordered w-full rounded-lg bg-base-200/50 border-base-300 focus:border-primary transition-all font-mono text-sm"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
      </Form.Field>

      <Form.Field {form} name="target">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3 block"
              >Storage Target</Form.Label
            >
            <div class="grid grid-cols-3 gap-3">
              {#each ["d1", "do", "kv"] as t}
                <label class="cursor-pointer">
                  <input
                    type="radio"
                    {...props}
                    bind:group={$formData.target}
                    value={t}
                    class="sr-only"
                  />
                  <div
                    class="flex flex-col items-center p-4 rounded-lg border-2 transition-all {$formData.target ===
                    t
                      ? 'border-primary bg-primary/5'
                      : 'border-base-300 bg-base-200/30 opacity-50 hover:opacity-100'}"
                  >
                    {#if t === "d1"}<Database
                        class="w-5 h-5 mb-2 {$formData.target === t
                          ? 'text-primary'
                          : ''}"
                      />{/if}
                    {#if t === "do"}<Cpu
                        class="w-5 h-5 mb-2 {$formData.target === t
                          ? 'text-secondary'
                          : ''}"
                      />{/if}
                    {#if t === "kv"}<Zap
                        class="w-5 h-5 mb-2 {$formData.target === t
                          ? 'text-accent'
                          : ''}"
                      />{/if}
                    <span
                      class="text-[10px] font-bold uppercase tracking-tighter"
                      >{t}</span
                    >
                  </div>
                </label>
              {/each}
            </div>
          {/snippet}
        </Form.Control>
      </Form.Field>

      <div class="mt-4 flex flex-col gap-3">
        <button
          type="submit"
          class="btn btn-primary btn-lg rounded-lg w-full shadow-xl shadow-primary/20"
        >
          Forge Entity
        </button>
        <p class="text-[10px] text-center opacity-40 leading-relaxed px-4">
          This will inject a new <code>sqliteTable</code> block into your
          <code>schema.ts</code> and sync immediately.
        </p>
      </div>
    </form>
  </div>
</div>
