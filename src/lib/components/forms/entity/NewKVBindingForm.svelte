<!--
  NewKVBindingForm.svelte

  Summary: Dedicated form for configuring Cloudflare Workers KV Namespace bindings.
  Expects: onClose callback.
  Output: Dispatches KV namespace entity creation to schemaState.
-->
<script lang="ts">
  import { Zap, ArrowRight, TriangleAlert, Info } from "lucide-svelte";
  import { schemaState } from "#lib/state";

  let { onClose }: { onClose: () => void } = $props();

  let bindingName = $state("");
  let kvNamespaceId = $state("");

  const sanitizedBinding = $derived(
    bindingName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
  );

  const isDuplicate = $derived(
    Boolean(sanitizedBinding && schemaState.nodes.some(
      (n) => n.id.toLowerCase() === sanitizedBinding.toLowerCase()
    ))
  );

  const isValid = $derived(sanitizedBinding.length > 0 && !isDuplicate);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!isValid) return;

    await schemaState.addTable(sanitizedBinding, "kv", {
      id: kvNamespaceId.trim() || undefined
    });

    onClose();
  }
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-4">
  <!-- Binding Variable Name -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60">
      KV Binding Variable Name
    </legend>
    <input
      type="text"
      bind:value={bindingName}
      placeholder="e.g. CACHE_KV or RATE_LIMIT_KV"
      class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-accent transition-all font-mono text-sm {isDuplicate ? 'input-error' : ''}"
    />

    {#if isDuplicate}
      <div class="flex items-center gap-1.5 text-[11px] text-error mt-1 font-semibold">
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
        <span>A binding or entity named "{sanitizedBinding}" already exists.</span>
      </div>
    {/if}
  </fieldset>

  <!-- Namespace ID (Optional) -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60">
      KV Namespace ID (Optional)
    </legend>
    <input
      type="text"
      bind:value={kvNamespaceId}
      placeholder="e.g. 19ac9d9ad7cd48959e05c276643434342121219"
      class="input input-sm input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-accent transition-all font-mono text-xs"
    />
    <p class="text-[10px] opacity-60 mt-0.5">
      Can be omitted during local development or bound to your Cloudflare dashboard namespace ID later.
    </p>
  </fieldset>

  <div class="p-3 bg-base-200/50 border border-base-300/80 rounded-box text-[11px] opacity-75 leading-relaxed flex items-start gap-2">
    <Info class="w-4 h-4 text-accent shrink-0 mt-0.5" />
    <span>
      Adds a Key-Value storage binding to your Cloudflare Worker environment and renders a KV node on the ERD canvas.
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
      class="btn btn-sm btn-accent rounded-field text-xs font-bold shadow-sm"
      disabled={!isValid}
    >
      <span>Configure KV Namespace</span>
      <ArrowRight class="w-3.5 h-3.5" />
    </button>
  </div>
</form>
