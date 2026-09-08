<!--
  NewR2BindingForm.svelte

  Summary: Dedicated form for configuring Cloudflare R2 Object Storage bucket bindings.
  Expects: onClose callback.
  Output: Dispatches R2 bucket entity creation to schemaState.
-->
<script lang="ts">
  import { HardDrive, ArrowRight, TriangleAlert, Info } from "lucide-svelte";
  import { schemaState } from "#lib/state";

  let { onClose }: { onClose: () => void } = $props();

  let bindingName = $state("");
  let bucketName = $state("");

  const sanitizedBinding = $derived(
    bindingName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
  );

  const isDuplicate = $derived(
    Boolean(sanitizedBinding && schemaState.nodes.some(
      (n) => n.id.toLowerCase() === sanitizedBinding.toLowerCase()
    ))
  );

  const defaultBucketSuggestion = $derived(
    sanitizedBinding ? sanitizedBinding.toLowerCase().replace(/_/g, "-") : ""
  );

  const isValid = $derived(sanitizedBinding.length > 0 && !isDuplicate);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!isValid) return;

    await schemaState.addTable(sanitizedBinding, "r2", {
      bucket_name: bucketName.trim() || defaultBucketSuggestion || undefined
    });

    onClose();
  }
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-4">
  <!-- Binding Variable Name -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60">
      R2 Binding Variable Name
    </legend>
    <input
      type="text"
      bind:value={bindingName}
      placeholder="e.g. ASSETS_BUCKET or USER_UPLOADS"
      class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-info transition-all font-mono text-sm {isDuplicate ? 'input-error' : ''}"
    />

    {#if isDuplicate}
      <div class="flex items-center gap-1.5 text-[11px] text-error mt-1 font-semibold">
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
        <span>A binding or entity named "{sanitizedBinding}" already exists.</span>
      </div>
    {/if}
  </fieldset>

  <!-- Bucket Name (Optional) -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60">
      R2 Bucket Name (Optional)
    </legend>
    <input
      type="text"
      bind:value={bucketName}
      placeholder={defaultBucketSuggestion ? `e.g. ${defaultBucketSuggestion}` : "e.g. prod-user-uploads"}
      class="input input-sm input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-info transition-all font-mono text-xs"
    />
    <p class="text-[10px] opacity-60 mt-0.5">
      Defaults to the binding name in kebab-case if left empty.
    </p>
  </fieldset>

  <div class="p-3 bg-base-200/50 border border-base-300/80 rounded-box text-[11px] opacity-75 leading-relaxed flex items-start gap-2">
    <Info class="w-4 h-4 text-info shrink-0 mt-0.5" />
    <span>
      Adds an R2 Object Storage bucket binding to your Worker and displays bucket folders and storage schemas on the ERD canvas.
    </span>
  </div>

  <!-- Action Buttons -->
  <div class="mt-2 flex items-center justify-end gap-2">
    <button
      type="button"
      class="btn btn-sm btn-ghost rounded-field text-xs"
      onclick={onClose}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="btn btn-sm btn-info rounded-field text-xs font-bold shadow-sm"
      disabled={!isValid}
    >
      <span>Configure R2 Bucket</span>
      <ArrowRight class="w-3.5 h-3.5" />
    </button>
  </div>
</form>
