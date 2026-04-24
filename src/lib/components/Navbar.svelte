<script lang="ts">
  import { FolderOpen, Share2 } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";

  const { onOpenFile } = $props<{ onOpenFile: () => void }>();
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
    <button class="btn btn-ghost btn-sm gap-2 rounded-xl" onclick={onOpenFile}>
      <FolderOpen class="w-4 h-4" />
      Open Schema
    </button>
  </div>
</div>
