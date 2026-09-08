<!--
  AddMethodForm.svelte

  Summary: Dedicated form to append public RPC methods to Durable Object classes.
  Expects: tableName prop and onComplete callback.
  Output: Appends public methods to the DO class on disk or in JSDoc metadata.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { doMethodSchema } from "#lib/schemas";
  import { schemaState } from "#lib/state";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X, Check, Cpu } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const form = superForm(defaults(valibot(doMethodSchema)), {
    SPA: true,
    validators: valibot(doMethodSchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
        await schemaState.addColumn(
          tableName,
          form.data.name,
          form.data.returnType || "Promise<any>"
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
  data-testid="add-method-form"
>
  <div class="flex items-center justify-between border-b border-base-300/60 pb-2.5">
    <div class="flex items-center gap-1.5">
      <div class="w-2 h-2 rounded-full bg-secondary"></div>
      <h4 class="text-[10px] font-bold uppercase tracking-wider text-base-content/80">
        Add Public Method
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
    <!-- Method Signature -->
    <Form.Field {form} name="name">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Method Signature
            </legend>
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="e.g. get(key: string) or increment()"
              class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-secondary transition-all text-xs font-mono"
            />
          </fieldset>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="text-[10px] text-error font-medium mt-1" />
    </Form.Field>

    <!-- Return Type -->
    <Form.Field {form} name="returnType">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Return Type
            </legend>
            <select
              {...props}
              bind:value={$formData.returnType}
              class="select select-sm select-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:select-secondary transition-all text-xs font-mono"
            >
              <option value="Promise<void>">Promise&lt;void&gt;</option>
              <option value="Promise<string>">Promise&lt;string&gt;</option>
              <option value="Promise<number>">Promise&lt;number&gt;</option>
              <option value="Promise<boolean>">Promise&lt;boolean&gt;</option>
              <option value="Promise<any>">Promise&lt;any&gt;</option>
            </select>
          </fieldset>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <button
      type="submit"
      class="btn btn-secondary btn-sm rounded-field w-full gap-2 mt-1 shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!$formData.name.trim()}
    >
      <Check class="w-3.5 h-3.5" />
      <span>Add Method</span>
    </button>
  </form>
</div>
