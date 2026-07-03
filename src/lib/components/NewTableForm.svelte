<!--
  NewTableForm.svelte

  Summary: Form modal to create a new storage target (D1 table, KV, DO, or R2).
  Expects: None (triggered by active modal state).
  Output: Dispatches the new table declaration code to the schemaState engine.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { tableSchema } from "$lib/schemas";
  import { schemaState } from "../state";
  import { Database, Cpu, Zap, X, HardDrive } from "lucide-svelte";

  const form = superForm(defaults(valibot(tableSchema)), {
    SPA: true,
    validators: valibot(tableSchema),
    async onUpdate({ form }) {
      if (form.valid && schemaState.filePath) {
        await schemaState.addTable(form.data.name, form.data.target as any);
        schemaState.showNewTableModal = false;
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

      <!-- Callout/Hint for Cloudflare Bindings -->
      <div class="p-4 bg-info/5 border border-info/10 rounded-2xl text-[11px] leading-relaxed flex gap-2">
        <span class="text-info font-bold text-sm">💡</span>
        <div class="flex flex-col gap-1 text-base-content/85">
          <span class="font-bold text-base-content">Cloudflare Storage Bindings</span>
          <span>KV Namespaces, Durable Objects, and R2 Buckets are automatically discovered and loaded from <code>wrangler.toml</code> or resolved from custom class paths. You do not need to create them manually in Drizzle.</span>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <button
          type="submit"
          class="btn btn-primary btn-lg rounded-lg w-full shadow-xl shadow-primary/20"
        >
          Forge D1 Table
        </button>
        <p class="text-[10px] text-center opacity-40 leading-relaxed px-4">
          This will inject a new <code>sqliteTable</code> block into your
          <code>schema.ts</code> and sync immediately.
        </p>
      </div>
    </form>
  </div>
</div>
