<!--
  NewEntityModal.svelte

  Summary: Orchestration dialog for creating entities across Cloudflare primitives (D1, DO, KV, R2).
  Expects: None (reads from and writes to schemaState.showNewTableModal).
  Output: Dispatches creation to primitive-specific sub-forms.
-->
<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Database, Cpu, Zap, HardDrive, X, Sparkles } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import NewD1TableForm from "./NewD1TableForm.svelte";
  import NewDOBindingForm from "./NewDOBindingForm.svelte";
  import NewKVBindingForm from "./NewKVBindingForm.svelte";
  import NewR2BindingForm from "./NewR2BindingForm.svelte";

  type TargetPrimitive = "d1" | "do" | "kv" | "r2";
  let activeTarget = $state<TargetPrimitive>("d1");

  function close() {
    schemaState.showNewTableModal = false;
  }

  function openScaffoldModal() {
    close();
    schemaState.showScaffoldModal = true;
  }

  const targets = [
    {
      id: "d1" as const,
      label: "D1 Table",
      icon: Database,
      badgeColor: "badge-primary",
      activeClass: "border-primary bg-primary/10 text-primary",
    },
    {
      id: "do" as const,
      label: "Durable Object",
      icon: Cpu,
      badgeColor: "badge-secondary",
      activeClass: "border-secondary bg-secondary/10 text-secondary",
    },
    {
      id: "kv" as const,
      label: "KV Namespace",
      icon: Zap,
      badgeColor: "badge-accent",
      activeClass: "border-accent bg-accent/10 text-accent",
    },
    {
      id: "r2" as const,
      label: "R2 Bucket",
      icon: HardDrive,
      badgeColor: "badge-info",
      activeClass: "border-info bg-info/10 text-info",
    },
  ];
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && schemaState.showNewTableModal) {
      close();
    }
  }}
/>

{#if schemaState.showNewTableModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-neutral/60 backdrop-blur-md"
    transition:fade={{ duration: 120 }}
    onclick={(e) => e.target === e.currentTarget && close()}
    data-testid="new-table-modal"
  >
    <div
      class="bg-base-100 border border-base-300/80 rounded-box shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      in:scale={{ duration: 140, start: 0.98, easing: cubicOut }}
      out:scale={{ duration: 100, start: 0.98 }}
    >
      <!-- Header -->
      <div class="p-5 border-b border-base-300/60 flex items-center justify-between bg-base-200/40 shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-field">
            <Database class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 class="text-base font-bold tracking-tight">Create New Entity</h2>
            <p class="text-[11px] opacity-60">Add a D1 database table or Cloudflare Worker binding</p>
          </div>
        </div>
        <button
          class="btn btn-ghost btn-sm btn-circle hover:bg-base-200 transition-colors"
          onclick={close}
          title="Close modal"
        >
          <X class="w-4 h-4 opacity-60" />
        </button>
      </div>

      <!-- Segmented Target Switcher -->
      <div class="p-5 pb-0 shrink-0">
        <div class="grid grid-cols-4 gap-1.5 p-1 bg-base-200/80 rounded-xl border border-base-300/60">
          {#each targets as t}
            {@const Icon = t.icon}
            <button
              type="button"
              class="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all {activeTarget === t.id
                ? `${t.activeClass} font-bold shadow-xs border-current`
                : 'border-transparent text-base-content/70 hover:text-base-content hover:bg-base-100/60'}"
              onclick={() => (activeTarget = t.id)}
            >
              <Icon class="w-4 h-4 mb-1" />
              <span class="text-[10.5px] leading-tight">{t.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Active Primitive Form Body (Scrollable if needed) -->
      <div class="p-5 overflow-y-auto flex-1">
        {#if activeTarget === "d1"}
          <NewD1TableForm onClose={close} />
        {:else if activeTarget === "do"}
          <NewDOBindingForm onClose={close} />
        {:else if activeTarget === "kv"}
          <NewKVBindingForm onClose={close} />
        {:else if activeTarget === "r2"}
          <NewR2BindingForm onClose={close} />
        {/if}
      </div>

      <!-- Footer Architecture Scaffold Link -->
      <div class="px-5 py-3 border-t border-base-300/60 bg-base-200/30 flex items-center justify-between shrink-0">
        <span class="text-[11px] opacity-60">Looking for pre-built auth schemas?</span>
        <button
          type="button"
          class="btn btn-xs btn-ghost text-secondary hover:bg-secondary/10 font-bold gap-1 text-[11px]"
          onclick={openScaffoldModal}
        >
          <Sparkles class="w-3 h-3" />
          <span>Scaffold Auth & SSO Mirrors →</span>
        </button>
      </div>
    </div>
  </div>
{/if}
