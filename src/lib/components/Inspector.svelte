<script lang="ts">
  import { Share2, Check } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";

  interface TableNodeData {
    label: string;
    columns: Array<{ name: string; definition: string }>;
  }
</script>

{#if schemaState.nodes.some(n => n.selected)}
  {@const selectedNode = schemaState.nodes.find(n => n.selected)!}
  <div 
    class="absolute top-6 right-6 bottom-6 w-80 bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl rounded-[2.5rem] z-40 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300"
  >
    <div class="p-6 border-b border-base-300 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <Share2 class="w-4 h-4 text-primary" />
        </div>
        <h3 class="font-bold text-sm tracking-tight">{selectedNode.id}</h3>
      </div>
      <button class="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100" onclick={() => {
        const nextNodes = [...schemaState.nodes];
        const n = nextNodes.find(n => n.id === selectedNode.id);
        if (n) n.selected = false;
        schemaState.nodes = nextNodes;
      }}>
        <Check class="w-4 h-4" />
      </button>
    </div>
    
    <div class="grow overflow-auto p-4 flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <span class="text-[10px] font-black uppercase opacity-30 tracking-widest px-2">Columns</span>
        <div class="flex flex-col gap-1">
          {#each (selectedNode.data as any).columns as col}
            <div class="bg-base-200/50 p-3 rounded-2xl flex flex-col gap-1 border border-transparent hover:border-primary/20 transition-all">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs">{col.name}</span>
                <span class="text-[9px] font-mono opacity-50 uppercase">{col.definition.split('(')[0]}</span>
              </div>
              {#if col.definition.includes('references')}
                <div class="badge badge-secondary badge-xs text-[8px] font-mono uppercase tracking-tighter opacity-80">Foreign Key</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="p-6 bg-base-200/50 border-t border-base-300 text-center">
      <p class="text-[9px] opacity-40 uppercase tracking-widest font-black mb-4">Edit in your IDE to sync</p>
      <div class="flex justify-center gap-2">
        <div class="w-2 h-2 rounded-full bg-success"></div>
        <div class="w-2 h-2 rounded-full bg-base-300"></div>
        <div class="w-2 h-2 rounded-full bg-base-300"></div>
      </div>
    </div>
  </div>
{/if}
