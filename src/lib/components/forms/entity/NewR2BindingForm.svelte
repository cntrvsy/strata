<!--
  NewR2BindingForm.svelte

  Summary: Dedicated form and recipe generator for Cloudflare R2 Object Storage bucket bindings.
  Expects: onClose callback.
  Output: Provides copyable wrangler.jsonc recipe and optional sandbox canvas addition.
-->
<script lang="ts">
  import { Copy, Check, Info, TriangleAlert, Sparkles } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { toast } from "svelte-sonner";

  let { onClose }: { onClose: () => void } = $props();

  let bindingName = $state("");
  let bucketName = $state("");
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

  const defaultBucketSuggestion = $derived(
    sanitizedBinding ? sanitizedBinding.toLowerCase().replace(/_/g, "-") : "",
  );

  const isValid = $derived(sanitizedBinding.length > 0 && !isDuplicate);

  const recipeJsonc = $derived(
`{
  "binding": "${sanitizedBinding || 'MY_BUCKET'}",
  "bucket_name": "${bucketName.trim() || defaultBucketSuggestion || 'my-bucket'}"
}`
  );

  async function handleCopy() {
    if (!isValid) return;
    try {
      await navigator.clipboard.writeText(recipeJsonc);
      copied = true;
      toast.success("Wrangler Recipe Copied", {
        description: `Copied "${sanitizedBinding}" R2 binding. Paste into your wrangler.jsonc r2_buckets array.`
      });
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }

  async function handleAddToSandbox() {
    if (!isValid) return;
    await schemaState.addTable(sanitizedBinding, "r2", {
      bucket_name: bucketName.trim() || defaultBucketSuggestion || undefined,
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
      R2 Binding Variable Name
    </legend>
    <input
      type="text"
      bind:value={bindingName}
      placeholder="e.g. ASSETS_BUCKET or USER_UPLOADS"
      class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-info transition-all font-mono text-sm {isDuplicate
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

  <!-- Bucket Name (Optional) -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend
      class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60"
    >
      R2 Bucket Name (Optional)
    </legend>
    <input
      type="text"
      bind:value={bucketName}
      placeholder={defaultBucketSuggestion
        ? `e.g. ${defaultBucketSuggestion}`
        : "e.g. prod-user-uploads"}
      class="input input-sm input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-info transition-all font-mono text-xs"
    />
    <p class="text-[10px] opacity-60 mt-0.5">
      Defaults to the binding name in kebab-case if left empty.
    </p>
  </fieldset>

  <!-- Recipe Code Block -->
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <span class="text-[10px] font-bold uppercase tracking-wider opacity-60">
        wrangler.jsonc snippet
      </span>
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-1 text-[10.5px] font-semibold text-info hover:bg-info/10"
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
    <Info class="w-4 h-4 text-info shrink-0 mt-0.5" />
    <span>
      Cloudflare R2 storage buckets are declared in <code>wrangler.jsonc</code> under <code>r2_buckets</code>. Add this block in your editor and save—Strata will automatically visualize it.
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
        class="btn btn-sm btn-info rounded-field text-xs font-bold shadow-sm"
        disabled={!isValid}
        onclick={handleAddToSandbox}
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>Add to Sandbox Canvas</span>
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-sm btn-info rounded-field text-xs font-bold shadow-sm"
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
