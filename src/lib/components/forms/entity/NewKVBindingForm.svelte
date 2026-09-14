<!--
  NewKVBindingForm.svelte

  Summary: Dedicated form and recipe generator for Cloudflare Workers KV Namespace bindings.
  Expects: onClose callback.
  Output: Provides copyable wrangler.jsonc recipe and optional sandbox canvas addition.
-->
<script lang="ts">
  import { Copy, Check, Info, TriangleAlert, Sparkles } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { toast } from "svelte-sonner";

  let { onClose }: { onClose: () => void } = $props();

  let bindingName = $state("");
  let kvNamespaceId = $state("");
  let copied = $state(false);

  const sanitizedBinding = $derived(
    bindingName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_"),
  );

  const isDuplicate = $derived(
    Boolean(
      sanitizedBinding &&
        schemaState.nodes.some(
          (n) => n.id.toLowerCase() === sanitizedBinding.toLowerCase(),
        ),
    ),
  );

  const isValid = $derived(sanitizedBinding.length > 0 && !isDuplicate);

  const recipeJsonc = $derived(
`{
  "binding": "${sanitizedBinding || 'MY_KV'}",
  "id": "${kvNamespaceId.trim() || 'local-kv-id'}"
}`
  );

  async function handleCopy() {
    if (!isValid) return;
    try {
      await navigator.clipboard.writeText(recipeJsonc);
      copied = true;
      toast.success("Wrangler Recipe Copied", {
        description: `Copied "${sanitizedBinding}" KV binding. Paste into your wrangler.jsonc kv_namespaces array.`
      });
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }

  async function handleAddToSandbox() {
    if (!isValid) return;
    await schemaState.addTable(sanitizedBinding, "kv", {
      id: kvNamespaceId.trim() || undefined,
    });
    onClose();
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Binding Variable Name -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend
      class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60"
    >
      KV Binding Variable Name
    </legend>
    <input
      type="text"
      bind:value={bindingName}
      placeholder="e.g. CACHE_KV or RATE_LIMIT_KV"
      class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-accent transition-all font-mono text-sm {isDuplicate
        ? 'input-error'
        : ''}"
    />

    {#if isDuplicate}
      <div
        class="flex items-center gap-1.5 text-[11px] text-error mt-1 font-semibold"
      >
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
        <span>A binding or entity named "{sanitizedBinding}" already exists.</span>
      </div>
    {/if}
  </fieldset>

  <!-- Namespace ID (Optional) -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend
      class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60"
    >
      KV Namespace ID (Optional)
    </legend>
    <input
      type="text"
      bind:value={kvNamespaceId}
      placeholder="e.g. 19ac9d9ad7cd48959e05c276643434342121219"
      class="input input-sm input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-accent transition-all font-mono text-xs"
    />
  </fieldset>

  <!-- Recipe Code Block -->
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">
        wrangler.jsonc snippet
      </span>
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-1 text-[10.5px] font-semibold text-accent hover:bg-accent/10"
        onclick={handleCopy}
        disabled={!isValid}
      >
        {#if copied}
          <Check class="w-3 h-3 text-success" />
          <span>Copied</span>
        {:else}
          <Copy class="w-3 h-3" />
          <span>Copy Snippet</span>
        {/if}
      </button>
    </div>
    <div class="bg-base-300/60 p-2.5 rounded-field font-mono text-[11px] border border-base-300 text-base-content/80 overflow-x-auto select-all">
      <pre><code>{recipeJsonc}</code></pre>
    </div>
  </div>

  <div
    class="p-3 bg-base-200/50 border border-base-300/80 rounded-box text-[11px] opacity-75 leading-relaxed flex items-start gap-2"
  >
    <Info class="w-4 h-4 text-accent shrink-0 mt-0.5" />
    <span>
      Cloudflare KV bindings are configured in <code>wrangler.jsonc</code>. Paste this snippet into your configuration and save in your editor—Strata will automatically detect and render the node on the canvas.
    </span>
  </div>

  <!-- Action Buttons -->
  <div class="mt-2 flex items-center justify-end gap-2">
    <button
      type="button"
      class="btn btn-sm btn-ghost rounded-field text-xs"
      onclick={onClose}
    >
      Close
    </button>
    {#if schemaState.isSandboxMode}
      <button
        type="button"
        class="btn btn-sm btn-accent rounded-field text-xs font-bold shadow-sm"
        disabled={!isValid}
        onclick={handleAddToSandbox}
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>Add to Sandbox Canvas</span>
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-sm btn-accent rounded-field text-xs font-bold shadow-sm"
        disabled={!isValid}
        onclick={async () => {
          await handleCopy();
          onClose();
        }}
      >
        <Copy class="w-3.5 h-3.5" />
        <span>Copy Recipe & Close</span>
      </button>
    {/if}
  </div>
</div>
