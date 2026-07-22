<!--
  ProjectSettingsModal.svelte

  Summary: Modal dialog to configure custom relative paths to wrangler.toml for binding discovery.
  Expects: None (triggered by active modal state).
  Output: Dispatches the project config updates to schemaState and saves schema.ts.
-->
<script lang="ts">
  import { schemaState } from "../state";
  import { X, Settings, FileText, Info, CheckCircle, AlertCircle, FolderOpen, Loader2 } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import { PlatformService } from "../services/platform";

  let wranglerPath = $state(schemaState.wranglerPath || "");
  let isDetecting = $state(false);

  let validationStatus = $state<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  let validationError = $state('');
  let bindingCounts = $state({ kv: 0, do: 0, r2: 0 });

  function getRelativePath(fromAbsolute: string, toAbsolute: string): string {
    const fromParts = fromAbsolute.replace(/\\/g, '/').split('/');
    const toParts = toAbsolute.replace(/\\/g, '/').split('/');
    
    fromParts.pop(); // Remove schema filename
    
    let i = 0;
    while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
      i++;
    }
    
    const upCount = fromParts.length - i;
    const upParts = Array(upCount).fill('..');
    const downParts = toParts.slice(i);
    
    return [...upParts, ...downParts].join('/');
  }

  function resolvePath(base: string, rel: string): string {
    const normalizedBase = base.replace(/\\/g, '/');
    const normalizedRel = rel.replace(/\\/g, '/');

    if (normalizedRel.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedRel)) {
      return normalizedRel;
    }

    const parts = normalizedBase.split('/');
    parts.pop(); // Remove filename
    const relParts = normalizedRel.split('/');
    for (const part of relParts) {
      if (part === '.') continue;
      if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }
    return parts.join('/');
  }

  function parseWranglerBindings(tomlContent: string) {
    const bindings: { type: 'kv' | 'do' | 'r2'; name: string }[] = [];
    const blocks = tomlContent.split(/\[\[/);
    
    for (const block of blocks) {
      const lines = block.split('\n');
      const headerLine = lines[0].trim();
      
      if (headerLine.startsWith('kv_namespaces')) {
        let name = '';
        for (const line of lines) {
          const match = line.match(/^\s*binding\s*=\s*["']([^"']+)["']/);
          if (match) { name = match[1]; break; }
        }
        if (name) bindings.push({ type: 'kv', name });
      } else if (headerLine.startsWith('durable_objects.bindings')) {
        let name = '';
        for (const line of lines) {
          const nameMatch = line.match(/^\s*name\s*=\s*["']([^"']+)["']/);
          if (nameMatch) { name = nameMatch[1]; break; }
        }
        if (name) bindings.push({ type: 'do', name });
      } else if (headerLine.startsWith('r2_buckets')) {
        let name = '';
        for (const line of lines) {
          const match = line.match(/^\s*binding\s*=\s*["']([^"']+)["']/);
          if (match) { name = match[1]; break; }
        }
        if (name) bindings.push({ type: 'r2', name });
      }
    }
    return bindings;
  }

  function parseJsonBindings(jsonContent: string) {
    const bindings: { type: 'kv' | 'do' | 'r2'; name: string }[] = [];
    try {
      const cleaned = jsonContent
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(?:^|[^\\:])\/\/.*$/gm, '');
      const data = JSON.parse(cleaned);

      if (Array.isArray(data.kv_namespaces)) {
        for (const kv of data.kv_namespaces) {
          if (kv && kv.binding) bindings.push({ type: 'kv', name: kv.binding });
        }
      }
      if (data.durable_objects && Array.isArray(data.durable_objects.bindings)) {
        for (const dobj of data.durable_objects.bindings) {
          if (dobj && dobj.name) bindings.push({ type: 'do', name: dobj.name });
        }
      }
      if (Array.isArray(data.r2_buckets)) {
        for (const r2 of data.r2_buckets) {
          if (r2 && r2.binding) bindings.push({ type: 'r2', name: r2.binding });
        }
      }
    } catch {}
    return bindings;
  }

  $effect(() => {
    const pathToCheck = wranglerPath.trim();
    if (!pathToCheck || !schemaState.filePath) {
      validationStatus = 'idle';
      validationError = '';
      bindingCounts = { kv: 0, do: 0, r2: 0 };
      return;
    }

    let active = true;
    validationStatus = 'validating';
    validationError = '';

    const absPath = resolvePath(schemaState.filePath, pathToCheck);

    PlatformService.readText(absPath)
      .then((content) => {
        if (!active) return;
        try {
          let bindings: any[] = [];
          if (absPath.endsWith('.json') || absPath.endsWith('.jsonc')) {
            bindings = parseJsonBindings(content);
          } else {
            bindings = parseWranglerBindings(content);
          }
          
          const counts = { kv: 0, do: 0, r2: 0 };
          for (const b of bindings) {
            if (b.type === 'kv') counts.kv++;
            else if (b.type === 'do') counts.do++;
            else if (b.type === 'r2') counts.r2++;
          }
          
          bindingCounts = counts;
          validationStatus = 'valid';
        } catch (e: any) {
          validationStatus = 'invalid';
          validationError = `Failed to parse configuration: ${e.message || String(e)}`;
        }
      })
      .catch((err) => {
        if (!active) return;
        validationStatus = 'invalid';
        validationError = `File not found or unreadable.`;
      });

    return () => {
      active = false;
    };
  });

  async function browseWrangler() {
    if (!schemaState.filePath) return;
    
    const dir = schemaState.filePath.substring(
      0,
      schemaState.filePath.lastIndexOf("/"),
    );
    
    try {
      const selected = await PlatformService.selectFile(
        ["toml", "json", "jsonc"],
        dir,
        "Wrangler Configuration"
      );
      if (selected) {
        const relPath = getRelativePath(schemaState.filePath, selected);
        wranglerPath = relPath;
        toast.success("Wrangler file selected", {
          description: `Relative path calculated: ${relPath}`
        });
      }
    } catch (e: any) {
      toast.error("File selection failed", {
        description: e?.message || String(e)
      });
    }
  }

  async function autoDetectWrangler() {
    if (!schemaState.filePath) return;
    isDetecting = true;

    const dir = schemaState.filePath.substring(
      0,
      schemaState.filePath.lastIndexOf("/"),
    );

    let foundPath: string | null = null;
    let currentDir = dir;
    let prefix = "";

    for (let depth = 0; depth < 12; depth++) {
      for (const name of ["wrangler.toml", "wrangler.jsonc", "wrangler.json"]) {
        const fullPath = currentDir + "/" + name;
        try {
          const content = await PlatformService.readText(fullPath);
          if (content) {
            foundPath = prefix + name;
            break;
          }
        } catch (e) {}
      }
      if (foundPath) break;

      const lastSlash = currentDir.lastIndexOf("/");
      if (lastSlash <= 0) break;
      currentDir = currentDir.substring(0, lastSlash);
      prefix += "../";
    }

    isDetecting = false;

    if (foundPath) {
      wranglerPath = foundPath;
      toast.success("Configuration Detected", {
        description: `Found configuration file at: ${foundPath}`,
      });
    } else {
      toast.error("Detection Failed", {
        description:
          "Could not auto-detect wrangler configuration in parent directories.",
      });
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    if (!schemaState.filePath) return;
    try {
      await schemaState.updateProjectConfig(wranglerPath.trim() || undefined);
      schemaState.showProjectSettingsModal = false;
      toast.success("Settings Saved", {
        description: "Project configuration JSDoc updated successfully.",
      });
    } catch (err: any) {
      toast.error("Failed to save settings", {
        description: err?.message || String(err),
      });
    }
  }
</script>

<div
  class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-base-900/65 backdrop-blur-md animate-in fade-in duration-300"
>
  <div
    class="bg-base-100 border border-base-300/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
    data-testid="project-settings-modal"
  >
    <div
      class="p-6 border-b border-base-300/60 flex items-center justify-between bg-base-200/40"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <Settings class="w-5 h-5 text-primary" />
        </div>
        <h2 class="text-base font-bold tracking-tight">Project Settings</h2>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle hover:bg-base-200"
        onclick={() => (schemaState.showProjectSettingsModal = false)}
      >
        <X class="w-4 h-4 opacity-60" />
      </button>
    </div>

    <form onsubmit={handleSave} class="p-6 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <label
          for="wrangler-path-input"
          class="text-[10px] font-bold uppercase tracking-wider opacity-50 block"
        >
          Wrangler Config Path
        </label>
        <div class="flex items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <FileText
              class="absolute left-3 w-4 h-4 text-base-content/40 font-mono"
            />
            <input
              id="wrangler-path-input"
              type="text"
              bind:value={wranglerPath}
              placeholder="e.g. ../../wrangler.toml"
              class="input input-bordered w-full pl-10 pr-28 rounded-xl bg-base-200/40 border-base-300/60 focus:input-primary transition-all font-mono text-sm h-11"
            />
            <button
              type="button"
              class="absolute right-2 btn btn-xs btn-ghost hover:bg-base-200/80 text-primary font-bold rounded-lg transition-all h-7"
              disabled={isDetecting}
              onclick={autoDetectWrangler}
            >
              {#if isDetecting}
                Detecting...
              {:else}
                Auto-Detect
              {/if}
            </button>
          </div>
          <button
            type="button"
            class="btn btn-outline border-base-300/60 hover:bg-base-200 text-base-content/70 hover:text-base-content rounded-xl h-11 w-11 p-0 flex items-center justify-center shrink-0 transition-all"
            title="Browse File"
            onclick={browseWrangler}
          >
            <FolderOpen class="w-4.5 h-4.5" />
          </button>
        </div>

        <!-- Real-Time Validation Status -->
        <div class="mt-2 rounded-xl p-3 border transition-all duration-300 bg-base-200/20 border-base-300/40">
          {#if validationStatus === 'idle'}
            <div class="flex items-start gap-2.5 text-[11px] leading-relaxed text-base-content/65">
              <Info class="w-4 h-4 text-info shrink-0 mt-0.5" />
              <div>
                <span class="font-semibold block text-base-content/80">Default Configuration</span>
                <span>Leaving this empty tells Strata to auto-discover <code>wrangler.toml</code> in parent folders.</span>
              </div>
            </div>
          {:else}
            <div class="flex flex-col gap-2">
              <div class="flex items-start gap-2.5 text-[11px] leading-relaxed">
                {#if validationStatus === 'validating'}
                  <Loader2 class="w-4 h-4 text-primary shrink-0 animate-spin mt-0.5" />
                  <div>
                    <span class="font-semibold block text-primary">Validating File...</span>
                    <span class="text-base-content/65">Reading and parsing Wrangler configuration bindings.</span>
                  </div>
                {:else}
                  {#if validationStatus === 'valid'}
                    <CheckCircle class="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <div>
                      <span class="font-semibold block text-success">Configuration Loaded</span>
                      <span class="text-base-content/65">Bindings successfully synchronized from Wrangler file.</span>
                    </div>
                  {:else if validationStatus === 'invalid'}
                    <AlertCircle class="w-4 h-4 text-error shrink-0 mt-0.5" />
                    <div>
                      <span class="font-semibold block text-error">Validation Error</span>
                      <span class="text-error/85">{validationError}</span>
                    </div>
                  {/if}
                {/if}
              </div>

              {#if validationStatus === 'valid'}
                <div class="h-px bg-base-300/40 my-1"></div>
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div class="bg-base-200/40 rounded-lg p-1.5 border border-base-300/30">
                    <span class="block text-[14px] font-bold text-base-content">{bindingCounts.kv}</span>
                    <span class="text-[9px] uppercase tracking-wider opacity-50 font-bold">KV Bindings</span>
                  </div>
                  <div class="bg-base-200/40 rounded-lg p-1.5 border border-base-300/30">
                    <span class="block text-[14px] font-bold text-base-content">{bindingCounts.do}</span>
                    <span class="text-[9px] uppercase tracking-wider opacity-50 font-bold">DO Bindings</span>
                  </div>
                  <div class="bg-base-200/40 rounded-lg p-1.5 border border-base-300/30">
                    <span class="block text-[14px] font-bold text-base-content">{bindingCounts.r2}</span>
                    <span class="text-[9px] uppercase tracking-wider opacity-50 font-bold">R2 Bindings</span>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Cloudflare bindings info -->
      <div
        class="p-4 bg-info/5 border border-info/10 rounded-2xl text-[11px] leading-relaxed flex gap-2"
      >
        <span class="text-info font-bold text-sm">💡</span>
        <div class="flex flex-col gap-1 text-base-content/85">
          <span class="font-bold text-base-content"
            >Cloudflare Configuration</span
          >
          <span
            >Durable Objects, KV Namespaces, and R2 Buckets require a valid <code
              >wrangler.toml</code
            > path to extract binding names and expose public method signatures inside
            the canvas.</span
          >
        </div>
      </div>

      <div class="mt-2 flex flex-col gap-3">
        <button
          type="submit"
          class="btn btn-primary rounded-xl w-full shadow-sm font-bold"
        >
          Save Configuration
        </button>
        <p class="text-[10px] text-center opacity-40 leading-relaxed px-4">
          This will update the <code>strataConfig</code> object in your
          <code>schema.ts</code>.
        </p>
      </div>
    </form>
  </div>
</div>
