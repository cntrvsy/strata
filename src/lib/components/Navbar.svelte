<script lang="ts">
  import { FolderOpen, Share2, Camera, Download } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";
  import { addTableToSchema } from "$lib/parser";
  import { toPng } from 'html-to-image';

  const { onOpenFile } = $props<{ onOpenFile: () => void }>();

  async function exportToImage() {
    const flowElement = document.querySelector('.svelte-flow') as HTMLElement;
    if (!flowElement) return;

    // Hide UI elements that shouldn't be in the export
    const controls = flowElement.querySelector('.svelte-flow__controls') as HTMLElement;
    const minimap = flowElement.querySelector('.svelte-flow__minimap') as HTMLElement;
    
    if (controls) controls.style.display = 'none';
    if (minimap) minimap.style.display = 'none';

    try {
      const dataUrl = await toPng(flowElement, {
        backgroundColor: 'white', // Ensure high contrast for export
        quality: 1,
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `strata-forge-export-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      if (controls) controls.style.display = 'flex';
      if (minimap) minimap.style.display = 'block';
    }
  }
</script>

<div class="absolute top-0 left-0 right-0 h-16 border-b border-base-300 bg-base-100/80 backdrop-blur-xl z-30 flex items-center justify-between px-6">
  <div class="flex items-center gap-4">
    <div class="p-2.5 bg-primary/10 rounded-2xl shadow-inner">
      <Share2 class="w-6 h-6 text-primary" />
    </div>
    <div class="flex flex-col">
      <span class="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 leading-none mb-1">Strata Forge</span>
      <h1 class="text-sm font-bold tracking-tight">
        {schemaState.filePath?.split('/').pop() || 'No Schema Loaded'}
      </h1>
    </div>
    <div class="h-6 w-px bg-base-300 mx-2"></div>
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full {!schemaState.isValid ? 'bg-error animate-pulse' : 'bg-success'} shadow-[0_0_8px_currentColor]"></div>
      <span class="text-[9px] font-mono uppercase opacity-50 tracking-wider">
        {!schemaState.isValid ? 'Parsing Error' : 'Live Mirror Active'}
      </span>
    </div>
  </div>

  <div class="flex items-center gap-3">
    {#if schemaState.filePath}
      <button 
        class="btn btn-primary btn-sm gap-2 rounded-xl shadow-lg shadow-primary/20" 
        onclick={() => schemaState.showNewTableModal = true}
      >
        <span class="text-lg leading-none">+</span>
        New Table
      </button>
    {/if}
    {#if schemaState.nodes.length > 0}
      <button 
        class="btn btn-ghost btn-sm gap-2 rounded-xl text-primary hover:bg-primary/5" 
        onclick={exportToImage}
        title="Export as PNG"
      >
        <Camera class="w-4 h-4" />
        Export
      </button>
    {/if}
    <button class="btn btn-ghost btn-sm gap-2 rounded-xl" onclick={onOpenFile}>
      <FolderOpen class="w-4 h-4" />
      Open Schema
    </button>
  </div>
</div>
