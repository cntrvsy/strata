<!--
  WelcomeLauncher.svelte

  Summary: Clean, high-contrast onboarding launcher for Strata when no schema file is loaded.
  Expects: None (shares global schemaState).
  Output: File open dialog triggers, demo loaders, and recent file access.
-->
<script lang="ts">
  import {
    FileCode,
    FolderOpen,
    Sparkles,
    Upload,
    Clock,
    Layers,
    ArrowRight,
    Trash2,
  } from "lucide-svelte";
  import { schemaState } from "#lib/state";
  import { SAMPLE_TEMPLATES } from "#lib/mock";

  let activeTab = $state<"quickstart" | "templates" | "recents">("quickstart");
</script>

{#if schemaState.machine.current === "EMPTY" && !schemaState.isSandboxMode}
  <div
    class="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-base-300/40 backdrop-blur-md animate-in fade-in duration-300"
    data-testid="welcome-launcher"
  >
    <div
      class="card bg-base-100 border border-base-300/80 shadow-2xl rounded-box w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
    >
      <!-- Banner Header -->
      <div
        class="bg-base-200/50 px-6 pt-6 pb-4 border-b border-base-300/60 flex flex-col items-center text-center shrink-0"
      >
        <div
          class="w-12 h-12 bg-primary/10 rounded-field flex items-center justify-center mb-3 ring-1 ring-primary/20 shadow-xs"
        >
          <FileCode class="w-6 h-6 text-primary" />
        </div>
        <h2 class="text-xl font-bold tracking-tight text-base-content">
          Welcome to Strata
        </h2>
        <p class="text-xs text-base-content/60 max-w-md mt-1 leading-relaxed font-medium">
          Open a local Drizzle schema or explore interactive Cloudflare D1 templates
        </p>

        <!-- Segmented Tab Navigation -->
        <div
          role="tablist"
          class="tabs tabs-box bg-base-200/80 border border-base-300/60 mt-4 p-1 rounded-field w-full max-w-md grid grid-cols-3"
        >
          <button
            role="tab"
            class="tab font-semibold text-xs transition-all flex items-center gap-1.5 justify-center {activeTab === 'quickstart' ? 'tab-active font-bold shadow-xs' : 'opacity-70 hover:opacity-100'}"
            onclick={() => (activeTab = "quickstart")}
          >
            <Sparkles class="w-3.5 h-3.5 text-primary" />
            <span>Quick Start</span>
          </button>
          <button
            role="tab"
            class="tab font-semibold text-xs transition-all flex items-center gap-1.5 justify-center {activeTab === 'templates' ? 'tab-active font-bold shadow-xs' : 'opacity-70 hover:opacity-100'}"
            onclick={() => (activeTab = "templates")}
          >
            <Layers class="w-3.5 h-3.5 text-secondary" />
            <span>Demos</span>
            <span class="badge badge-xs badge-neutral opacity-80">
              {Object.keys(SAMPLE_TEMPLATES).length}
            </span>
          </button>
          <button
            role="tab"
            class="tab font-semibold text-xs transition-all flex items-center gap-1.5 justify-center {activeTab === 'recents' ? 'tab-active font-bold shadow-xs' : 'opacity-70 hover:opacity-100'} {!schemaState.recentFiles.length ? 'opacity-40 cursor-not-allowed' : ''}"
            disabled={!schemaState.recentFiles.length}
            onclick={() => schemaState.recentFiles.length && (activeTab = "recents")}
          >
            <Clock class="w-3.5 h-3.5 text-accent" />
            <span>Recents</span>
            {#if schemaState.recentFiles.length > 0}
              <span class="badge badge-xs badge-neutral opacity-80">
                {schemaState.recentFiles.length}
              </span>
            {/if}
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="card-body p-6 overflow-y-auto space-y-4">
        {#if activeTab === "quickstart"}
          <div class="space-y-4 animate-in fade-in duration-200">
            <!-- Focused Drop Zone / File Opener -->
            <button
              class="w-full border-2 border-dashed border-base-300 hover:border-primary/60 bg-base-200/20 hover:bg-primary/5 rounded-box p-7 flex flex-col items-center justify-center text-center transition-all group cursor-pointer"
              onclick={() => schemaState.openNewFile()}
              aria-label="Open Schema File"
            >
              <div
                class="p-3 bg-primary/10 rounded-field text-primary mb-2.5 group-hover:scale-105 transition-transform"
              >
                <Upload class="w-6 h-6" />
              </div>
              <span class="font-bold text-sm text-base-content group-hover:text-primary transition-colors">
                Select or Drop Schema File
              </span>
              <p class="text-xs text-base-content/60 mt-1 max-w-sm leading-relaxed">
                Open <code class="font-mono text-primary font-semibold">schema.ts</code>, <code class="font-mono text-primary font-semibold">schema/index.ts</code>, or <code class="font-mono text-primary font-semibold">drizzle.config.ts</code>
              </p>

              <span class="btn btn-primary btn-sm rounded-field px-5 mt-4 shadow-xs font-semibold text-xs">
                <FolderOpen class="w-4 h-4 mr-1" />
                Browse Local Files
              </span>
            </button>

            <!-- Quick Template Hint or Recent File Resume -->
            {#if schemaState.recentFiles.length > 0}
              <div
                class="bg-base-200/40 rounded-box p-3.5 border border-base-300/60 flex items-center justify-between"
              >
                <div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div class="p-2 bg-accent/10 rounded-field text-accent shrink-0">
                    <Clock class="w-4 h-4" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-[10px] uppercase font-bold text-base-content/50">
                      Last Opened
                    </span>
                    <span class="text-xs font-bold truncate text-base-content">
                      {schemaState.recentFiles[0].split("/").pop()}
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    class="btn btn-ghost btn-xs rounded-field font-bold text-primary hover:bg-primary/10"
                    onclick={() => schemaState.openFileDirectly(schemaState.recentFiles[0])}
                  >
                    Resume <ArrowRight class="w-3.5 h-3.5 ml-0.5" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error hover:bg-error/10"
                    onclick={() => schemaState.clearRecentFiles()}
                    title="Clear recent file cache"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>
            {:else}
              <div
                class="bg-base-200/40 rounded-box p-3.5 border border-base-300/60 flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-secondary/10 rounded-field text-secondary">
                    <Sparkles class="w-4 h-4" />
                  </div>
                  <div class="flex flex-col text-left">
                    <span class="text-xs font-bold text-base-content">New to Strata?</span>
                    <span class="text-[11px] text-base-content/60">
                      Try an interactive Cloudflare D1 + KV + DO playground demo.
                    </span>
                  </div>
                </div>
                <button
                  class="btn btn-secondary btn-xs rounded-field font-semibold px-3"
                  onclick={() => (activeTab = "templates")}
                >
                  Explore Demos
                </button>
              </div>
            {/if}
          </div>
        {:else if activeTab === "templates"}
          <div class="space-y-2 animate-in fade-in duration-200">
            <div class="flex items-center justify-between px-1 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                Interactive Starter Schemas
              </span>
              <span class="text-[10px] text-base-content/40 font-mono">No file required</span>
            </div>

            <ul class="list bg-base-200/30 rounded-box border border-base-300/60 divide-y divide-base-300/40 max-h-64 overflow-y-auto">
              {#each Object.values(SAMPLE_TEMPLATES) as tpl}
                <li class="list-row items-center justify-between p-3 hover:bg-base-200/70 transition-colors group">
                  <div class="flex flex-col min-w-0 pr-3 flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="font-bold text-xs text-base-content group-hover:text-secondary transition-colors truncate">
                        {tpl.name}
                      </span>
                      <span class="badge badge-xs badge-outline opacity-70 shrink-0 font-mono text-[9px]">
                        {tpl.badge}
                      </span>
                    </div>
                    <p class="text-[10.5px] text-base-content/60 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                  <button
                    class="btn btn-ghost btn-xs text-secondary font-bold group-hover:bg-secondary group-hover:text-secondary-content shrink-0 rounded-field px-2.5"
                    onclick={() => schemaState.loadSandboxDemo(tpl.key)}
                  >
                    <ArrowRight class="w-3.5 h-3.5" />
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {:else if activeTab === "recents"}
          <div class="space-y-2 animate-in fade-in duration-200">
            <div class="flex items-center justify-between px-1 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                Recently Opened Files
              </span>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-base-content/40 font-mono">
                  {schemaState.recentFiles.length} items
                </span>
                {#if schemaState.recentFiles.length > 0}
                  <button
                    class="btn btn-ghost btn-xs text-error hover:bg-error/10 rounded-field text-[10px] h-6 min-h-0 px-2 font-semibold flex items-center gap-1"
                    onclick={() => {
                      schemaState.clearRecentFiles();
                      activeTab = "quickstart";
                    }}
                    title="Clear recent files cache"
                  >
                    <Trash2 class="w-3 h-3" />
                    Clear Cache
                  </button>
                {/if}
              </div>
            </div>

            <ul class="list bg-base-200/30 rounded-box border border-base-300/60 divide-y divide-base-300/40 max-h-64 overflow-y-auto">
              {#each schemaState.recentFiles as path}
                <li class="list-row items-center justify-between p-3 hover:bg-base-200/70 transition-colors group">
                  <div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div class="p-2 bg-base-200 rounded-field text-base-content/60 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      <FolderOpen class="w-4 h-4" />
                    </div>
                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="font-bold text-xs truncate text-base-content group-hover:text-primary transition-colors">
                        {path.split("/").pop()}
                      </span>
                      <span class="text-[9.5px] text-base-content/40 font-mono truncate">
                        {path}
                      </span>
                    </div>
                  </div>
                  <button
                    class="btn btn-ghost btn-xs text-primary font-bold group-hover:bg-primary group-hover:text-primary-content shrink-0 rounded-field px-2.5"
                    onclick={() => schemaState.openFileDirectly(path)}
                  >
                    <ArrowRight class="w-3.5 h-3.5" />
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <!-- Card Footer -->
      <div
        class="bg-base-200/40 px-6 py-3 border-t border-base-300/60 flex items-center justify-between shrink-0 text-[11px] text-base-content/50"
      >
        <span>Git & JSDoc metadata standard</span>
        <span class="font-mono text-[10px]">Strata v3.1</span>
      </div>
    </div>
  </div>
{/if}
