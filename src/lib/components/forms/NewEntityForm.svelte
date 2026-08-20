<!--
  NewEntityForm.svelte

  Summary: Form to create a new storage target (D1 table, KV namespace, Durable Object class, or R2 bucket pointer).
  Expects: None (shares global schemaState).
  Output: Dispatches the entity structure to the schemaState engine.
-->
<script lang="ts">
  import * as Form from "formsnap";
  import { superForm, defaults } from "sveltekit-superforms";
  import { valibot } from "sveltekit-superforms/adapters";
  import { tableSchema } from "$lib/schemas";
  import { schemaState } from "$lib/state";
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    Database,
    X,
    Cpu,
    Zap,
    HardDrive,
    Lightbulb,
    TriangleAlert,
  } from "lucide-svelte";

  // Local state for target-specific attributes
  let doClass = $state("");
  let doPath = $state("");
  let kvId = $state("");
  let r2BucketName = $state("");

  const form = superForm(defaults(valibot(tableSchema)), {
    SPA: true,
    validators: valibot(tableSchema),
    async onUpdate({ form }) {
      if (form.valid && (schemaState.filePath || schemaState.isSandboxMode)) {
        const extra =
          form.data.target === "do"
            ? {
                class: doClass.trim() || undefined,
                path: doPath.trim() || undefined,
              }
            : form.data.target === "kv"
              ? {
                  id: kvId.trim() || undefined,
                }
              : form.data.target === "r2"
                ? {
                    bucket_name: r2BucketName.trim() || undefined,
                  }
                : undefined;

        await schemaState.addTable(
          form.data.name,
          form.data.target as any,
          extra,
        );
        schemaState.showNewTableModal = false;
      }
    },
  });

  const { form: formData, enhance } = form;

  const isDuplicateName = $derived(
    schemaState.nodes.some(
      (n) => n.id.toLowerCase() === $formData.name.trim().toLowerCase(),
    ),
  );

  const targetConfig = {
    d1: {
      label: "D1 Database Table",
      icon: Database,
      color: "text-primary",
      details:
        "Creates a standard Drizzle sqliteTable code structure in schema.ts.",
    },
    do: {
      label: "Durable Object Class Binding",
      icon: Cpu,
      color: "text-secondary",
      details:
        "Configures a Durable Object binding in wrangler.toml/json and maps to a TS class.",
    },
    kv: {
      label: "KV Namespace Binding",
      icon: Zap,
      color: "text-accent",
      details:
        "Configures a Key-Value storage binding in wrangler.toml/json & visual ERD node.",
    },
    r2: {
      label: "R2 Bucket Binding",
      icon: HardDrive,
      color: "text-info",
      details:
        "Configures an R2 Object Storage bucket binding in wrangler.toml/json & visual ERD node.",
    },
  };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-neutral/60 backdrop-blur-md"
  transition:fade={{ duration: 120 }}
  onclick={(e) =>
    e.target === e.currentTarget && (schemaState.showNewTableModal = false)}
>
  <div
    class="bg-base-100 border border-base-300/80 rounded-box shadow-2xl w-full max-w-md overflow-hidden"
    in:scale={{ duration: 140, start: 0.98, easing: cubicOut }}
    out:scale={{ duration: 100, start: 0.98 }}
    data-testid="new-table-modal"
  >
    <div
      class="p-6 border-b border-base-300/60 flex items-center justify-between bg-base-200/40"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-field">
          <Database class="w-5 h-5 text-primary" />
        </div>
        <h2 class="text-base font-bold tracking-tight">Create New Entity</h2>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle hover:bg-base-200 transition-colors"
        onclick={() => (schemaState.showNewTableModal = false)}
        title="Close modal"
      >
        <X class="w-4 h-4 opacity-60" />
      </button>
    </div>

    <form use:enhance class="p-6 flex flex-col gap-5">
      <!-- Entity Name -->
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <fieldset class="fieldset gap-1.5 p-0">
              <legend
                class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60"
                >Entity Name / Binding Variable</legend
              >
              <input
                {...props}
                bind:value={$formData.name}
                placeholder={$formData.target === "kv"
                  ? "e.g. ISITFUN_KV"
                  : $formData.target === "r2"
                    ? "e.g. GAMES_BUCKET"
                    : "e.g. users"}
                class="input input-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:input-primary transition-all font-mono text-sm {isDuplicateName
                  ? 'input-error'
                  : ''}"
              />
            </fieldset>
          {/snippet}
        </Form.Control>
        {#if isDuplicateName}
          <div
            class="flex items-center gap-1.5 text-[10px] text-error mt-1.5 font-bold"
          >
            <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
            <span
              >An entity or binding named "{$formData.name}" already exists.</span
            >
          </div>
        {/if}
        <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
      </Form.Field>

      <!-- Target Selection -->
      <Form.Field {form} name="target">
        <Form.Control>
          {#snippet children({ props })}
            <fieldset class="fieldset gap-1.5 p-0">
              <legend
                class="fieldset-legend text-[10px] font-bold uppercase tracking-wider opacity-60"
                >Storage Target</legend
              >
              <select
                {...props}
                bind:value={$formData.target}
                class="select select-bordered w-full rounded-field bg-base-200/40 border-base-300/60 hover:border-base-content/30 focus:select-primary transition-all text-sm font-medium"
              >
                <option value="d1">Cloudflare D1 Table (Drizzle Schema)</option>
                <option value="do"
                  >Cloudflare Durable Object (Class + Wrangler Binding)</option
                >
                <option value="kv"
                  >Cloudflare KV Namespace (Wrangler Binding)</option
                >
                <option value="r2"
                  >Cloudflare R2 Bucket (Wrangler Binding)</option
                >
              </select>
            </fieldset>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
      </Form.Field>

      <!-- KV Specific Fields -->
      {#if $formData.target === "kv"}
        <div
          class="p-4 bg-accent/5 border border-accent/15 rounded-box flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200"
        >
          <fieldset class="fieldset gap-1.5 p-0">
            <legend
              class="fieldset-legend text-[10px] font-bold opacity-60 uppercase"
              >KV Namespace ID (Optional)</legend
            >
            <input
              id="kv-id-input"
              bind:value={kvId}
              placeholder="e.g. 19ac9d9ad7cd48959e05c276643434342121219"
              class="input input-sm input-bordered w-full rounded-field bg-base-100/50 border-base-300/60 hover:border-base-content/30 focus:input-accent transition-all font-mono text-xs"
            />
          </fieldset>
        </div>
      {/if}

      <!-- R2 Specific Fields -->
      {#if $formData.target === "r2"}
        <div
          class="p-4 bg-info/5 border border-info/15 rounded-box flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200"
        >
          <fieldset class="fieldset gap-1.5 p-0">
            <legend
              class="fieldset-legend text-[10px] font-bold opacity-60 uppercase"
              >R2 Bucket Name (Optional)</legend
            >
            <input
              id="r2-bucket-input"
              bind:value={r2BucketName}
              placeholder="e.g. tutorial-videos (defaults to binding name)"
              class="input input-sm input-bordered w-full rounded-field bg-base-100/50 border-base-300/60 hover:border-base-content/30 focus:input-info transition-all font-mono text-xs"
            />
          </fieldset>
        </div>
      {/if}

      <!-- DO Specific Fields -->
      {#if $formData.target === "do"}
        <div
          class="p-4 bg-secondary/5 border border-secondary/15 rounded-box flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
        >
          <fieldset class="fieldset gap-1.5 p-0">
            <legend
              class="fieldset-legend text-[10px] font-bold opacity-60 uppercase"
              >Target Class Name</legend
            >
            <input
              id="do-class-input"
              bind:value={doClass}
              placeholder="e.g. UserSession"
              class="input input-sm input-bordered w-full rounded-field bg-base-100/50 border-base-300/60 hover:border-base-content/30 focus:input-secondary transition-all font-mono text-xs"
              required
            />
          </fieldset>

          <fieldset class="fieldset gap-1.5 p-0">
            <legend
              class="fieldset-legend text-[10px] font-bold opacity-60 uppercase"
              >Target TS File Path</legend
            >
            <input
              id="do-path-input"
              bind:value={doPath}
              placeholder="e.g. ./src/objects/UserSession.ts"
              class="input input-sm input-bordered w-full rounded-field bg-base-100/50 border-base-300/60 hover:border-base-content/30 focus:input-secondary transition-all font-mono text-xs"
              required
            />
          </fieldset>
        </div>
      {/if}

      <!-- Storage Hint -->
      <div
        class="p-3.5 bg-info/5 border border-info/10 rounded-box text-[11px] leading-relaxed flex items-start gap-2.5"
      >
        <Lightbulb class="w-4 h-4 text-info/90 shrink-0 mt-0.5" />
        <div class="flex flex-col gap-0.5 text-base-content/85">
          <span class="font-bold text-base-content">
            {targetConfig[
              ($formData.target as keyof typeof targetConfig) || "d1"
            ].label}
          </span>
          <span class="text-[10.5px] opacity-80">
            {targetConfig[
              ($formData.target as keyof typeof targetConfig) || "d1"
            ].details}
          </span>
        </div>
      </div>

      <div class="mt-2 flex flex-col gap-3">
        <button
          type="submit"
          class="btn btn-primary rounded-field w-full shadow-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
          disabled={isDuplicateName || !$formData.name.trim()}
        >
          Create Entity
        </button>
        <p class="text-[10px] text-center opacity-40 leading-relaxed px-4">
          Creates a card in <code>schema.ts</code> and syncs bindings with your
          <code>wrangler.toml</code>
          / <code>wrangler.json</code>.
        </p>
      </div>
    </form>
  </div>
</div>
