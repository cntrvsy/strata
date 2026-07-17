<script lang="ts">
  import {
    X,
    Check,
    Cpu,
    Save,
    Copy,
    Info,
    HelpCircle,
    FileText,
    AlertTriangle
  } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import { schemaState } from "$lib/state";

  let copied = $state(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(schemaState.generatedResolversCode);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      console.error("[Strata] Copy failed:", e);
    }
  }

  async function handleSave() {
    await schemaState.saveResolvers();
  }
</script>

{#if schemaState.showResolverModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-6"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="bg-base-100 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-base-300 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div
        class="px-8 py-5 bg-base-200/90 border-b border-base-300 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary/10 rounded-2xl text-primary">
            <Cpu class="w-5 h-5" />
          </div>
          <div>
            <h2 class="font-black text-base text-base-content tracking-wide uppercase">
              TypeScript Resolver Customizer
            </h2>
            <p class="text-[10px] opacity-50 font-medium mt-0.5 leading-none">
              Bridge D1 database records with Cloudflare Key-Value stores and Durable Objects.
            </p>
          </div>
        </div>

        <button
          class="btn btn-ghost btn-sm btn-circle text-base-content/65 hover:text-base-content hover:bg-base-300 transition-colors"
          onclick={() => (schemaState.showResolverModal = false)}
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Layout -->
      <div class="flex grow overflow-hidden">
        <!-- Sidebar Customizer Panel (Left 1/3) -->
        <div class="w-1/3 bg-base-200/50 border-r border-base-300/80 p-6 overflow-y-auto flex flex-col gap-5 text-xs font-sans">
          <!-- The Why description -->
          <div class="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex flex-col gap-2">
            <div class="flex items-center gap-1.5 text-primary font-bold">
              <Info class="w-3.5 h-3.5" />
              <span>Why do I need Resolvers?</span>
            </div>
            <p class="text-[11px] leading-relaxed opacity-75">
              SQLite/D1 does not support native relations or foreign keys pointing to Cloudflare bindings (KV, DO, R2) directly. 
              Strata resolves this by generating typed getter functions to fetch values from KV or stubs from Durable Objects using D1 column keys.
            </p>
          </div>

          <!-- Warnings list for Wrangler Bindings consistency check -->
          {#if schemaState.resolverWarnings.length > 0}
            <div class="bg-error/5 border border-error/20 text-error rounded-2xl p-4 flex flex-col gap-2 animate-in fade-in duration-300">
              <div class="flex items-center gap-1.5 font-bold">
                <AlertTriangle class="w-3.5 h-3.5" />
                <span>Configuration Inconsistencies</span>
              </div>
              <ul class="list-disc pl-4 space-y-1.5 text-[10px] leading-relaxed opacity-90">
                {#each schemaState.resolverWarnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
              <p class="text-[9px] opacity-60 leading-normal mt-0.5">
                Ensure these binding names match the configurations in your Wrangler files.
              </p>
            </div>
          {/if}

          <!-- Configuration Controls -->
          <div class="flex flex-col gap-4">
            <h4 class="font-bold text-[10px] uppercase tracking-widest opacity-40 border-b border-base-300 pb-1">Resolver Settings</h4>

            <!-- Function Prefix -->
            <label class="flex flex-col gap-1 cursor-pointer">
              <span class="font-bold text-[10px] uppercase text-base-content/60">Function Prefix</span>
              <input
                type="text"
                bind:value={schemaState.resolverConfigPrefix}
                class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                placeholder="e.g. resolve, fetch, get"
              />
              <span class="text-[9px] opacity-40 font-medium mt-0.5">Appended to helper functions (e.g. <code>resolveUsersToKV</code>)</span>
            </label>

            <!-- DO Return Style -->
            <label class="flex flex-col gap-1 cursor-pointer">
              <span class="font-bold text-[10px] uppercase text-base-content/60">Durable Objects Client</span>
              <select
                bind:value={schemaState.resolverConfigDoStyle}
                class="select select-sm select-bordered rounded-lg bg-base-100 w-full font-medium text-xs h-8 min-h-8"
              >
                <option value="wrapped">Wrapped Client Class (Helper Methods)</option>
                <option value="raw">Raw DO Stub (Standard return)</option>
              </select>
              <span class="text-[9px] opacity-40 font-medium mt-0.5">Choose whether to wrap DO stubs in a typed helper client.</span>
            </label>

            <!-- KV Read Mode -->
            <label class="flex flex-col gap-1 cursor-pointer">
              <span class="font-bold text-[10px] uppercase text-base-content/60">KV Retrieval Mode</span>
              <select
                bind:value={schemaState.resolverConfigKvRead}
                class="select select-sm select-bordered rounded-lg bg-base-100 w-full font-medium text-xs h-8 min-h-8"
              >
                <option value="json">JSON (Auto Parse with Text Fallback)</option>
                <option value="text">Raw Text (String output)</option>
                <option value="arrayBuffer">ArrayBuffer (Binary buffer)</option>
              </select>
              <span class="text-[9px] opacity-40 font-medium mt-0.5">Specifies the return type requested from KV namespaces.</span>
            </label>

            <!-- Save Destination -->
            <label class="flex flex-col gap-1 cursor-pointer">
              <span class="font-bold text-[10px] uppercase text-base-content/60">Output File Path</span>
              <input
                type="text"
                bind:value={schemaState.resolverConfigPath}
                class="input input-sm input-bordered rounded-lg bg-base-100 w-full font-mono text-xs h-8 min-h-8"
                placeholder="e.g. ./src/db/resolvers.ts"
              />
              <span class="text-[9px] opacity-40 font-medium mt-0.5">Absolute path to save resolvers file next to schema.</span>
            </label>
          </div>
        </div>

        <!-- Code Preview Area (Right 2/3) -->
        <div class="w-2/3 p-8 overflow-y-auto flex flex-col gap-4 bg-base-100">
          <div class="flex items-center justify-between border-b border-base-200 pb-2">
            <div class="flex items-center gap-2 text-success font-bold text-xs uppercase tracking-wide">
              <FileText class="w-4 h-4" />
              <span>Live Generated Code Preview</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="btn btn-ghost btn-xs text-xs font-bold flex items-center gap-1.5"
                onclick={copyCode}
              >
                {#if copied}
                  <Check class="w-3.5 h-3.5 text-success" />
                  <span class="text-success">Copied!</span>
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                {/if}
              </button>
            </div>
          </div>

          <div class="grow relative">
            <pre class="bg-neutral text-neutral-content p-5 rounded-2xl text-[10px] font-mono leading-relaxed overflow-x-auto border border-white/5 h-[48vh] overflow-y-auto select-all">{schemaState.generatedResolversCode}</pre>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-8 py-5 bg-base-200/50 flex items-center justify-between border-t border-base-200"
      >
        <p class="text-[10px] font-bold opacity-30 tracking-wider font-mono">
          TS RESOLVERS GENERATOR ➔ DRIZZLE ORM BINDING LAYERS
        </p>
        <div class="flex items-center gap-3">
          <button
            class="btn btn-ghost btn-sm btn-circle absolute top-4 right-4"
            onclick={() => (schemaState.showResolverModal = false)}
            aria-label="Close"
          >
            <X class="w-4 h-4" />
          </button>
          <button
            class="btn btn-ghost btn-sm px-5 rounded-xl font-bold transition-all active:scale-95 text-xs"
            onclick={() => (schemaState.showResolverModal = false)}
          >
            Cancel
          </button>
          <button
            class="btn btn-primary btn-sm px-6 rounded-xl shadow-lg shadow-primary/15 font-bold transition-all active:scale-95 text-xs flex items-center gap-1.5"
            onclick={handleSave}
          >
            <Save class="w-3.5 h-3.5" />
            <span>Save to Disk</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
