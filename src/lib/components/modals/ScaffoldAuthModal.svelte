<!--
  ScaffoldAuthModal.svelte

  Summary: Modal dialog for scaffolding pre-architected auth and identity patterns (Better Auth, Clerk, WorkOS).
  Expects: None (reads from and writes to schemaState.showScaffoldAuthModal).
  Output: Triggers schemaState cluster generation actions.
-->
<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    Shield,
    Users,
    Building2,
    X,
    Sparkles,
    ArrowRight,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";

  function close() {
    schemaState.showScaffoldAuthModal = false;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && schemaState.showScaffoldAuthModal) {
      close();
    }
  }}
/>

{#if schemaState.showScaffoldAuthModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-neutral/60 backdrop-blur-md animate-in fade-in duration-150"
    onclick={(e) => e.target === e.currentTarget && close()}
    role="dialog"
    aria-modal="true"
    data-testid="scaffold-auth-modal"
  >
    <div
      class="bg-base-100 border border-base-300/80 rounded-box shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
      in:scale={{ duration: 140, start: 0.98, easing: cubicOut }}
      out:scale={{ duration: 100, start: 0.98 }}
    >
      <!-- Header -->
      <div
        class="p-5 border-b border-base-300/60 flex items-center justify-between bg-base-200/40"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 bg-secondary/15 rounded-field">
            <Sparkles class="w-5 h-5 text-secondary" />
          </div>
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold tracking-tight">
                Scaffold Auth & Identity Tables
              </h2>
              <span class="badge badge-xs badge-success badge-outline font-mono"
                >Non-destructive</span
              >
            </div>
            <span class="text-[11px] opacity-65"
              >Appends production-ready auth and webhook tables without
              modifying existing code</span
            >
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

      <!-- Scaffolding Options -->
      <div class="p-6 flex flex-col gap-4">
        <!-- Better Auth -->
        <div
          class="p-4 rounded-xl border border-secondary/25 bg-secondary/5 hover:border-secondary/40 transition-all flex items-start gap-4"
        >
          <div
            class="p-2.5 rounded-lg bg-secondary/15 text-secondary shrink-0 mt-0.5"
          >
            <Shield class="w-5 h-5" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sm">Better Auth Cluster</span>
              <span
                class="badge badge-xs badge-secondary badge-outline font-mono"
                >4 Tables</span
              >
            </div>
            <p class="text-xs opacity-70 leading-relaxed">
              Scaffolds standard Drizzle tables for <code class="text-secondary"
                >user</code
              >, <code class="text-secondary">session</code>,
              <code class="text-secondary">account</code>, and
              <code class="text-secondary">verification</code> with relational foreign
              keys.
            </p>
            <div class="mt-2.5">
              <button
                type="button"
                class="btn btn-xs btn-secondary rounded-field font-semibold gap-1.5"
                onclick={async () => {
                  close();
                  await schemaState.scaffoldBetterAuthCluster();
                }}
              >
                <span>Scaffold Better Auth</span>
                <ArrowRight class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Clerk Mirror -->
        <div
          class="p-4 rounded-xl border border-purple-500/25 bg-purple-500/5 hover:border-purple-500/40 transition-all flex items-start gap-4"
        >
          <div
            class="p-2.5 rounded-lg bg-purple-500/15 text-purple-400 shrink-0 mt-0.5"
          >
            <Users class="w-5 h-5" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sm">Clerk Webhook Mirror</span>
              <span
                class="badge badge-xs badge-outline border-purple-500/50 text-purple-400 font-mono"
                >1 Table</span
              >
            </div>
            <p class="text-xs opacity-70 leading-relaxed">
              Scaffolds a local D1 mirror table (<code class="text-purple-400"
                >clerkUsers</code
              >) for syncing user metadata, images, and emails from Clerk
              webhooks.
            </p>
            <div class="mt-2.5">
              <button
                type="button"
                class="btn btn-xs border border-purple-500/50 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-field font-semibold gap-1.5"
                onclick={async () => {
                  close();
                  await schemaState.scaffoldWebhookMirror("clerk");
                }}
              >
                <span class="text-white">Scaffold Clerk Mirror</span>
                <ArrowRight class="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>

        <!-- WorkOS SSO -->
        <div
          class="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40 transition-all flex items-start gap-4"
        >
          <div
            class="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5"
          >
            <Building2 class="w-5 h-5" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sm">WorkOS Directory Sync & SSO</span>
              <span
                class="badge badge-xs badge-outline border-emerald-500/50 text-emerald-400 font-mono"
                >1 Table</span
              >
            </div>
            <p class="text-xs opacity-70 leading-relaxed">
              Scaffolds a local D1 mirror table (<code class="text-emerald-400"
                >workosUsers</code
              >) mapped to enterprise org and user IDs for SSO authentication
              sync.
            </p>
            <div class="mt-2.5">
              <button
                type="button"
                class="btn btn-xs border border-emerald-500/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-field font-semibold gap-1.5"
                onclick={async () => {
                  close();
                  await schemaState.scaffoldWebhookMirror("workos");
                }}
              >
                <span class="text-black/60">Scaffold WorkOS Mirror</span>
                <ArrowRight class="w-3 h-3 text-black/60" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
