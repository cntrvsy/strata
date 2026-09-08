<!--
  AddFolderForm.svelte

  Summary: Dedicated form to append virtual folder path prefixes to Cloudflare R2 bucket schemas.
  Expects: tableName prop and onComplete callback.
  Output: Dispatches folder updates to schemaState.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { r2FolderSchema } from "#lib/schemas";
  import { schemaState } from "#lib/state";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X, Check, HardDrive } from "lucide-svelte";

  const { tableName, onComplete } = $props<{
    tableName: string;
    onComplete: () => void;
  }>();

  const form = superForm(defaults(valibot(r2FolderSchema)), {
    SPA: true,
    validators: valibot(r2FolderSchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
        await schemaState.addColumn(
          tableName,
          form.data.name,
          form.data.type || "*/*"
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
  data-testid="add-folder-form"
>
  <div class="flex items-center justify-between border-b border-base-300/60 pb-2.5">
    <div class="flex items-center gap-1.5">
      <div class="w-2 h-2 rounded-full bg-info"></div>
      <h4 class="text-[10px] font-bold uppercase tracking-wider text-base-content/80">
        Add R2 Folder Prefix
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
    <!-- Folder Prefix -->
    <Form.Field {form} name="name">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Folder Prefix / Directory
            </legend>
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="e.g. avatars, public/images, exports"
              class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-info transition-all text-xs font-mono"
            />
          </fieldset>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="text-[10px] text-error font-medium mt-1" />
    </Form.Field>

    <!-- MIME Filter (Optional) -->
    <Form.Field {form} name="type">
      <Form.Control>
        {#snippet children({ props })}
          <fieldset class="fieldset gap-1 p-0">
            <legend class="fieldset-legend text-[10px] font-bold text-base-content/80 uppercase tracking-wider">
              Allowed MIME Constraint (Optional)
            </legend>
            <input
              {...props}
              bind:value={$formData.type}
              placeholder="e.g. image/*, application/pdf, */*"
              class="input input-sm input-bordered w-full rounded-field bg-base-100 border-base-300 text-base-content hover:border-base-content/30 focus:input-info transition-all text-xs font-mono"
            />
          </fieldset>
        {/snippet}
      </Form.Control>
    </Form.Field>

    <button
      type="submit"
      class="btn btn-info btn-sm rounded-field w-full gap-2 mt-1 shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!$formData.name.trim()}
    >
      <Check class="w-3.5 h-3.5" />
      <span>Add Folder Prefix</span>
    </button>
  </form>
</div>
