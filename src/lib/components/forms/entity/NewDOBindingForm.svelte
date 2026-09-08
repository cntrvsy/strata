<!--
  NewDOBindingForm.svelte

  Summary: Dedicated form for configuring Cloudflare Durable Object class bindings.
  Expects: onClose callback.
  Output: Dispatches Durable Object entity creation to schemaState.
-->
<script lang="ts">
  import { Cpu, ArrowRight, TriangleAlert, Info } from "lucide-svelte";
  import { schemaState } from "#lib/state";

  let { onClose }: { onClose: () => void } = $props();

  let bindingName = $state("");
  let className = $state("");
  let classPath = $state("");

  const sanitizedBinding = $derived(
    bindingName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
  );

  const isDuplicate = $derived(
    Boolean(sanitizedBinding && schemaState.nodes.some(
      (n) => n.id.toLowerCase() === sanitizedBinding.toLowerCase()
    ))
  );

  const isValid = $derived(
    sanitizedBinding.length > 0 &&
    className.trim().length > 0 &&
    classPath.trim().length > 0 &&
    !isDuplicate
  );

  // Auto-fill class name and path suggestions when binding changes
  function handleBindingInput() {
    if (!className && bindingName) {
      // Convert BINDING_NAME to BindingName
      const pascal = bindingName
        .toLowerCase()
        .split(/[^a-z0-9]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
      if (pascal) {
        className = pascal;
        if (!classPath) {
          classPath = `./src/durable-objects/${pascal}.ts`;
        }
      }
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!isValid) return;

    await schemaState.addTable(sanitizedBinding, "do", {
      class: className.trim(),
      path: classPath.trim()
    });

    onClose();
  }
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-4">
  <!-- Binding Variable Name -->
  <fieldset class="fieldset gap-1.5 p-0">
    <legend class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60">
      Wrangler Binding Name
    </legend>
    <input
      type="text"
      bind:value={bindingName}
      oninput={handleBindingInput}
      placeholder="e.g. USER_SESSION or COUNTER_DO"
      class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-secondary transition-all font-mono text-sm {isDuplicate ? 'input-error' : ''}"
    />

    {#if isDuplicate}
      <div class="flex items-center gap-1.5 text-[11px] text-error mt-1 font-semibold">
        <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
        <span>A binding or entity named "{sanitizedBinding}" already exists.</span>
      </div>
    {/if}
  </fieldset>

  <!-- Class Name & Source Path -->
  <div class="p-3.5 bg-secondary/5 border border-secondary/20 rounded-box flex flex-col gap-3">
    <fieldset class="fieldset gap-1.5 p-0">
      <legend class="fieldset-legend text-[10px] font-bold opacity-70 uppercase">
        Target Class Name
      </legend>
      <input
        type="text"
        bind:value={className}
        placeholder="e.g. UserSession"
        class="input input-sm input-bordered w-full rounded-field bg-base-100/60 border-base-300/60 focus:input-secondary font-mono text-xs"
        required
      />
    </fieldset>

    <fieldset class="fieldset gap-1.5 p-0">
      <legend class="fieldset-legend text-[10px] font-bold opacity-70 uppercase">
        Source File Path
      </legend>
      <input
        type="text"
        bind:value={classPath}
        placeholder="e.g. ./src/durable-objects/UserSession.ts"
        class="input input-sm input-bordered w-full rounded-field bg-base-100/60 border-base-300/60 focus:input-secondary font-mono text-xs"
        required
      />
    </fieldset>
  </div>

  <div class="p-3 bg-base-200/50 border border-base-300/80 rounded-box text-[11px] opacity-75 leading-relaxed flex items-start gap-2">
    <Info class="w-4 h-4 text-secondary shrink-0 mt-0.5" />
    <span>
      Adds a Durable Object binding to your <code class="text-secondary font-mono">wrangler.json/toml</code> configuration and maps it to your TypeScript RPC class.
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
      class="btn btn-sm btn-secondary rounded-field text-xs font-bold shadow-sm"
      disabled={!isValid}
    >
      <span>Configure Durable Object</span>
      <ArrowRight class="w-3.5 h-3.5" />
    </button>
  </div>
</form>
