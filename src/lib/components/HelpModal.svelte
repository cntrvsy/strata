<script lang="ts">
  import {
    X,
    Info,
    Share2,
    MousePointer2,
    Code2,
    Sparkles,
  } from "lucide-svelte";
  import { schemaState } from "$lib/state.svelte";

  let { show = $bindable(false) } = $props();

  const sections = [
    {
      title: "The Forge Philosophy",
      icon: Sparkles,
      content:
        "Strata Forge is a bidirectional editor. Your schema.ts is the source of truth. Drag nodes to move them, and we'll save the positions back to your code using JSDoc.",
    },
    {
      title: "Storage Targets",
      icon: Info,
      content:
        'Use JSDoc hints like @strata { "target": "kv" } to change how nodes appear. We support D1 (Relational), Durable Objects, and KV namespaces.',
    },
    {
      title: "Smart Relations",
      icon: Share2,
      content:
        "Solid lines are physical Foreign Keys (.references()). Dashed lines are logical Drizzle relations (relations()). You can forge new ones by dragging between nodes.",
    },
    {
      title: "AI Power",
      icon: Code2,
      content:
        "Download the STRATA_FORGE_AI.md file and feed it to your favorite LLM. It will learn how to design schemas that perfectly sync with this UI.",
    },
  ];
</script>

{#if show}
  <div
    class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-base-900/40 backdrop-blur-md transition-all duration-300"
  >
    <div
      class="bg-base-100 w-full max-w-2xl rounded-3xl shadow-2xl border border-base-300 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
      data-testid="help-modal"
    >
      <div
        class="px-8 py-6 border-b border-base-200 flex items-center justify-between bg-linear-to-r from-base-100 to-base-200/50"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-xl">
            <Info class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight">Strata Forge Guide</h2>
            <p
              class="text-[10px] uppercase font-black tracking-widest opacity-40"
            >
              Single Source of Truth ERD
            </p>
          </div>
        </div>
        <button
          class="btn btn-ghost btn-circle btn-sm"
          onclick={() => (show = false)}
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-8 grid grid-cols-2 gap-6">
        {#each sections as section}
          <div
            class="flex flex-col gap-3 p-4 rounded-2xl border border-base-200 hover:border-primary/20 hover:bg-primary/5 transition-all group"
          >
            <div
              class="p-2 bg-base-200 rounded-lg w-fit group-hover:bg-primary/10 transition-colors"
            >
              <section.icon
                class="w-4 h-4 group-hover:text-primary transition-colors"
              />
            </div>
            <h3 class="font-bold text-sm">{section.title}</h3>
            <p class="text-xs leading-relaxed opacity-60">{section.content}</p>
          </div>
        {/each}
      </div>

      <div class="px-8 py-6 bg-base-200/50 flex items-center justify-between">
        <p class="text-[10px] font-medium opacity-40 italic">
          Forged for Cloudflare + Drizzle
        </p>
        <button
          class="btn btn-primary btn-sm px-6 rounded-xl"
          onclick={() => (show = false)}
        >
          Got it
        </button>
      </div>
    </div>
  </div>
{/if}
