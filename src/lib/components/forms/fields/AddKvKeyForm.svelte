<!--
  AddKvKeyForm.svelte

  Summary: Dedicated form to append key patterns and data types to Cloudflare KV namespaces.
  Expects: tableName prop and onComplete callback.
  Output: Dispatches KV key pattern additions to schemaState.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { kvKeySchema } from "#lib/schemas";
  import { schemaState } from "#lib/state";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X, Check, Zap } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const form = superForm(defaults(valibot(kvKeySchema)), {
    SPA: true,
    validators: valibot(kvKeySchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
        await schemaState.addColumn(
          tableName,
          form.data.name,
          form.data.type || "string"
        );
        onComplete();
      }
    },
  });

  const { form: formData, enhance } = form;
</script>

<div
  class="flex flex-col gap-4 p-1"
  transition:slide={{ duration: 140, easing: cubicOut }}
  data-testid="add-kv-key-form"
>
  <div class="flex items-center justify-between border-b border-base-300/60 pb-2.5">
    <div class="flex items-center gap-1.5">
      <div class="w-2 h-2 rounded-full bg-accent"></div>
      <h4 class="text-[10px] font-bold uppercase tracking-wider text-base-content/80">
        Add KV Key Pattern
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
    <!-- Key Name / Prefix -->
    <Form.Field {form} name="name">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Key Name / Pattern
            </legend>
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="e.g. user:session:* or config"
              class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-accent transition-all text-xs font-mono"
            />
          </fieldset>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="text-[10px] text-error font-medium mt-1" />
    </Form.Field>

    <!-- Value Type -->
    <Form.Field {form} name="type">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Value Type
            </legend>
            <select
              {...props}
              bind:value={$formData.type}
              class="select select-sm select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-accent transition-all text-xs font-medium"
            >
              <option value="string">String (JSON / Text)</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="any">Any (Stream / Buffer)</option>
            </select>
          </fieldset>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <button
      type="submit"
      class="btn btn-accent btn-sm rounded-field w-full gap-2 mt-1 shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!$formData.name.trim()}
    >
      <Check class="w-3.5 h-3.5" />
      <span>Add Key Pattern</span>
    </button>
  </form>
</div>
