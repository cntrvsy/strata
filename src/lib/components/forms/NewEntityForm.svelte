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
  import { schemaState } from "../../state";
  import { Database, X, Cpu, Zap, HardDrive } from "lucide-svelte";

  const form = superForm(defaults(valibot(tableSchema)), {
    SPA: true,
    validators: valibot(tableSchema),
    async onUpdate({ form }) {
      if (form.valid && schemaState.filePath) {
        // If target is "do", we also pass class and path
        const extra =
          form.data.target === "do"
            ? {
                class: doClass.trim() || undefined,
                path: doPath.trim() || undefined,
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

  // Local state for target-specific DO attributes
  let doClass = $state("");
  let doPath = $state("");

  const targetConfig = {
    d1: {
      label: "D1 Database Table",
      icon: Database,
      color: "text-primary",
      details: "Creates a standard sqliteTable code structure.",
    },
    do: {
      label: "Durable Object Pointer",
      icon: Cpu,
      color: "text-secondary",
      details: "Registers a class method signature binding.",
    },
    kv: {
      label: "KV Namespace Pointer",
      icon: Zap,
      color: "text-accent",
      details: "Creates an inline or JSDoc-annotated schema entry.",
    },
    r2: {
      label: "R2 Bucket Pointer",
      icon: HardDrive,
      color: "text-info",
      details: "Creates an empty object mapping directory hierarchies.",
    },
  };
</script>

<div
  class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-base-900/65 backdrop-blur-md animate-in fade-in duration-300"
>
  <div
    class="bg-base-100 border border-base-300/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
    data-testid="new-table-modal"
  >
    <div
      class="p-6 border-b border-base-300/60 flex items-center justify-between bg-base-200/40"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <Database class="w-5 h-5 text-primary" />
        </div>
        <h2 class="text-base font-bold tracking-tight">Create New Entity</h2>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
        onclick={() => (schemaState.showNewTableModal = false)}
      >
        <X class="w-4 h-4 opacity-60" />
      </button>
    </div>

    <form use:enhance class="p-6 flex flex-col gap-5">
      <!-- Entity Name -->
      <Form.Field {form} name="name">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5 block"
              >Entity Name</Form.Label
            >
            <input
              {...props}
              bind:value={$formData.name}
              placeholder="e.g. users"
              class="input input-bordered w-full rounded-xl bg-base-200/40 border-base-300/60 focus:input-primary transition-all font-mono text-sm"
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
      </Form.Field>

      <!-- Target Selection -->
      <Form.Field {form} name="target">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label
              class="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5 block"
              >Storage Target</Form.Label
            >
            <select
              {...props}
              bind:value={$formData.target}
              class="select select-bordered w-full rounded-xl bg-base-200/40 border-base-300/60 focus:select-primary transition-all text-sm"
            >
              <option value="d1">Cloudflare D1 Table</option>
              <option value="do">Cloudflare Durable Object Pointer</option>
              <option value="kv">Cloudflare KV Namespace Pointer</option>
              <option value="r2">Cloudflare R2 Bucket Pointer</option>
            </select>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="text-[10px] text-error mt-1 font-medium" />
      </Form.Field>

      <!-- DO Specific Fields -->
      {#if $formData.target === "do"}
        <div
          class="p-4 bg-secondary/5 border border-secondary/15 rounded-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
        >
          <div class="flex flex-col gap-1.5">
            <label
              for="do-class-input"
              class="text-[10px] font-bold opacity-60 uppercase"
              >Target Class Name</label
            >
            <input
              id="do-class-input"
              bind:value={doClass}
              placeholder="e.g. UserSession"
              class="input input-sm input-bordered w-full rounded-xl bg-base-100/50 border-base-300/60 focus:input-secondary transition-all font-mono text-xs"
              required
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label
              for="do-path-input"
              class="text-[10px] font-bold opacity-60 uppercase"
              >Target TS File Path</label
            >
            <input
              id="do-path-input"
              bind:value={doPath}
              placeholder="e.g. ./src/objects/UserSession.ts"
              class="input input-sm input-bordered w-full rounded-xl bg-base-100/50 border-base-300/60 focus:input-secondary transition-all font-mono text-xs"
              required
            />
          </div>
        </div>
      {/if}

      <!-- Storage Hint -->
      <div
        class="p-4 bg-info/5 border border-info/10 rounded-2xl text-[11px] leading-relaxed flex gap-2"
      >
        <span class="text-info font-bold text-sm">💡</span>
        <div class="flex flex-col gap-1 text-base-content/85">
          <span class="font-bold text-base-content">
            {targetConfig[
              ($formData.target as keyof typeof targetConfig) || "d1"
            ].label}
          </span>
          <span>
            {targetConfig[
              ($formData.target as keyof typeof targetConfig) || "d1"
            ].details}
          </span>
        </div>
      </div>

      <div class="mt-2 flex flex-col gap-3">
        <button
          type="submit"
          class="btn btn-primary rounded-xl w-full shadow-sm font-bold"
        >
          Create
        </button>
        <p class="text-[10px] text-center opacity-40 leading-relaxed px-4">
          This will inject a new entity block into your <code>schema.ts</code> and
          sync immediately.
        </p>
      </div>
    </form>
  </div>
</div>
