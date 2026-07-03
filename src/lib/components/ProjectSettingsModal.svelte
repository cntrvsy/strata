<!--
  ProjectSettingsModal.svelte

  Summary: Modal dialog to configure custom relative paths to wrangler.toml for binding discovery.
  Expects: None (triggered by active modal state).
  Output: Dispatches the project config updates to schemaState and saves schema.ts.
-->
<script lang="ts">
  import { schemaState } from "../state";
  import { X, Settings, FileText, Info } from "lucide-svelte";
  import { toast } from "svelte-sonner";

  let wranglerPath = $state(schemaState.wranglerPath || "");

  async function handleSave(e: Event) {
    e.preventDefault();
    if (!schemaState.filePath) return;
    try {
      await schemaState.updateProjectConfig(wranglerPath.trim() || undefined);
      schemaState.showProjectSettingsModal = false;
      toast.success("Settings Saved", {
        description: "Project configuration JSDoc updated successfully."
      });
    } catch (err: any) {
      toast.error("Failed to save settings", {
        description: err?.message || String(err)
      });
    }
  }
</script>

<div
  class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-base-900/60 backdrop-blur-sm animate-in fade-in duration-300"
>
  <div
    class="bg-base-100 border border-base-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
    data-testid="project-settings-modal"
  >
    <div
      class="p-6 border-b border-base-300 flex items-center justify-between bg-base-200/50"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <Settings class="w-5 h-5 text-primary" />
        </div>
        <h2 class="text-lg font-bold tracking-tight">Project Settings</h2>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle"
        onclick={() => (schemaState.showProjectSettingsModal = false)}
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <form onsubmit={handleSave} class="p-8 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <label
          for="wrangler-path-input"
          class="text-[10px] font-black uppercase tracking-widest opacity-40 block"
        >
          Wrangler.toml Relative Path
        </label>
        <div class="relative flex items-center">
          <FileText class="absolute left-3 w-4 h-4 text-base-content/40 font-mono" />
          <input
            id="wrangler-path-input"
            type="text"
            bind:value={wranglerPath}
            placeholder="e.g. ../../../../wrangler.toml"
            class="input input-bordered w-full pl-10 rounded-lg bg-base-200/50 border-base-300 focus:border-primary transition-all font-mono text-sm"
          />
        </div>
        <span class="text-[10px] opacity-55 leading-normal mt-1 flex gap-1">
          <Info class="w-3.5 h-3.5 text-info shrink-0" />
          Specify the relative path from your schema file to <code>wrangler.toml</code>. Leaving this empty tells Strata to auto-discover it.
        </span>
      </div>

      <!-- Cloudflare bindings info -->
      <div class="p-4 bg-info/5 border border-info/10 rounded-2xl text-[11px] leading-relaxed flex gap-2">
        <span class="text-info font-bold text-sm">💡</span>
        <div class="flex flex-col gap-1 text-base-content/85">
          <span class="font-bold text-base-content">Cloudflare Configuration</span>
          <span>Durable Objects, KV Namespaces, and R2 Buckets require a valid <code>wrangler.toml</code> path to extract binding names and expose public method signatures inside the canvas.</span>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <button
          type="submit"
          class="btn btn-primary btn-lg rounded-lg w-full shadow-xl shadow-primary/20"
        >
          Save Configuration
        </button>
        <p class="text-[10px] text-center opacity-40 leading-relaxed px-4">
          This will update the <code>strataConfig</code> object in your <code>schema.ts</code>.
        </p>
      </div>
    </form>
  </div>
</div>
