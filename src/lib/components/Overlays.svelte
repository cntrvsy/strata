<script lang="ts">
  import { FileCode, FolderOpen, AlertCircle } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";

  const { onOpenFile } = $props<{ onOpenFile: () => void }>();
</script>

<!-- Empty State Overlay -->
{#if !schemaState.filePath}
  <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-base-100/60 backdrop-blur-sm animate-in fade-in duration-700">
    <div class="p-8 bg-base-100 border border-base-300 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-sm text-center">
      <div class="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-primary/10">
        <FileCode class="w-10 h-10 text-primary/40" />
      </div>
      <h2 class="text-2xl font-black mb-3 tracking-tight">Ready?</h2>
      <p class="text-sm text-base-content/50 mb-8 leading-relaxed">
        Connect your Drizzle <code class="bg-base-200 px-1.5 py-0.5 rounded text-primary">schema.ts</code> and see your mental model come to life.
      </p>
      <button class="btn btn-primary btn-lg rounded-2xl px-12 shadow-xl shadow-primary/30" onclick={onOpenFile}>
        <FolderOpen class="w-5 h-5 mr-3" />
        Select File
      </button>
    </div>
  </div>
{/if}

<!-- Validation Error Overlay -->
{#if !schemaState.isValid}
  <div class="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl animate-in slide-in-from-bottom-8">
    <div class="alert alert-error shadow-2xl rounded-2xl border-none bg-error/90 backdrop-blur-md text-error-content flex items-start gap-4">
      <div class="p-2 bg-white/20 rounded-xl">
        <AlertCircle class="w-5 h-5" />
      </div>
      <div class="flex flex-col gap-1">
        <h3 class="font-bold text-sm uppercase tracking-tight">Sync Paused: Parse Error</h3>
        <p class="text-[10px] opacity-90 font-mono leading-tight">{schemaState.error}</p>
      </div>
    </div>
  </div>
{/if}

<!-- Coordinate Stats -->
<div class="absolute bottom-10 left-28 z-10 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
  <div class="bg-neutral text-neutral-content px-3 py-1.5 rounded-xl text-[10px] font-mono shadow-2xl flex gap-3 border border-white/10 backdrop-blur-md">
    <span class="opacity-30">NODES: {schemaState.nodes.length}</span>
    <div class="h-3 w-px bg-white/10"></div>
    <span>COORD: {Math.round(schemaState.nodes.find(n => n.selected)?.position.x ?? 0)}, {Math.round(schemaState.nodes.find(n => n.selected)?.position.y ?? 0)}</span>
  </div>
</div>
