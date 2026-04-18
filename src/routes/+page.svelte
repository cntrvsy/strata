<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    ConnectionMode,
    addEdge,
    type Connection,
    type Edge,
    type Node as FlowNode,
  } from "@xyflow/svelte";
  import type { NodeChange, EdgeChange } from "@xyflow/system";
  import { onMount } from "svelte";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import { schemaState } from "$lib/state.svelte";
  import { parseSchema, addEdgeToSchema } from "$lib/parser";
  import TableNode from "$lib/components/TableNode.svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { readTextFile } from "@tauri-apps/plugin-fs";
  import { invoke } from "@tauri-apps/api/core";
  import SchemaEditor from "$lib/components/SchemaEditor.svelte";
  import {
    FileCode,
    Share2,
    FolderOpen,
    GitBranch,
    History,
    Check,
  } from "lucide-svelte";

  const nodeTypes = {
    table: TableNode,
  };

  let gitStatus = $state("");
  let currentBranch = $state("main");
  let branchModalOpen = $state(false);
  let branchName = $state("");
  let commitModalOpen = $state(false);
  let commitMessage = $state("");

  // Svelte Flow Event Handlers
  function onnodeschange(changes: NodeChange[]) {
    const nextNodes = [...schemaState.nodes];
    changes.forEach((change) => {
      if (change.type === "position" && change.position) {
        const node = nextNodes.find((n) => n.id === change.id);
        if (node) node.position = change.position;
      }
      if (change.type === "select") {
        const node = nextNodes.find((n) => n.id === change.id);
        if (node) node.selected = change.selected;
      }
    });
    schemaState.nodes = nextNodes;
  }

  function onedgeschange(changes: EdgeChange[]) {
    const nextEdges = [...schemaState.edges];
    changes.forEach((change) => {
      if (change.type === "select") {
        const edge = nextEdges.find((e) => e.id === change.id);
        if (edge) edge.selected = change.selected;
      }
    });
    schemaState.edges = nextEdges;
  }

  async function onconnect(connection: Connection) {
    if (!connection.source || !connection.target) return;

    schemaState.edges = addEdge(
      {
        ...connection,
        animated: true,
        style: "stroke: var(--color-primary); stroke-width: 2; opacity: 0.6;",
        type: "smoothstep",
      },
      schemaState.edges
    );

    if (schemaState.filePath) {
      schemaState.isSaving = true;
      try {
        const cleanCode = getRawText(schemaState.rawCode);
        const newCode = addEdgeToSchema(cleanCode, connection.source, connection.target);
        
        await invoke("save_file", {
          path: schemaState.filePath,
          content: newCode,
        });

        // Pull the clean formatted code back into the editor
        const raw = await readTextFile(schemaState.filePath);
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
      } catch (err) {
        console.error("Failed to save connection to code", err);
      } finally {
        setTimeout(() => {
          schemaState.isSaving = false;
        }, 600);
      }
    }
  }

  // Sync diagram when code changes
  $effect(() => {
    if (schemaState.rawCode) {
      updateDiagram();
    }
  });

  function getRawText(html: string) {
    if (typeof document === "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function updateDiagram() {
    const cleanCode = getRawText(schemaState.rawCode);
    const { nodes, edges } = parseSchema(cleanCode);
    schemaState.nodes = nodes;
    schemaState.edges = edges;
    checkGit();
  }

  async function checkGit() {
    if (schemaState.filePath) {
      try {
        gitStatus = await invoke("git_status", { path: schemaState.filePath });
      } catch (e) {
        console.warn("Git not available or not a repo", e);
      }
    }
  }

  async function handleCreateBranch() {
    if (branchName) {
      try {
        await invoke("git_create_branch", { name: branchName });
        currentBranch = branchName;
        branchModalOpen = false;
        branchName = "";
        await checkGit();
      } catch (e) {
        alert("Failed to create branch: " + e);
      }
    }
  }

  async function performCommit() {
    if (commitMessage && schemaState.filePath) {
      try {
        const cleanCode = getRawText(schemaState.rawCode);
        await invoke("save_file", {
          path: schemaState.filePath,
          content: cleanCode,
        });
        await invoke("git_commit", {
          path: schemaState.filePath,
          message: commitMessage,
        });
        commitModalOpen = false;
        commitMessage = "";
        await checkGit();
      } catch (e) {
        alert("Commit failed: " + e);
      }
    }
  }

  async function handleNodeDragStop(event: any) {
    const { node } = event;
    if (schemaState.filePath) {
      try {
        await invoke("save_node_pos", {
          path: schemaState.filePath,
          tableName: node.id,
          x: node.position.x,
          y: node.position.y,
        });
        const raw = await readTextFile(schemaState.filePath);
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
      } catch (err) {
        console.error("Failed to save position:", err);
      }
    }
  }

  async function handleSave() {
    if (schemaState.filePath) {
      schemaState.isSaving = true;
      const cleanCode = getRawText(schemaState.rawCode);

      try {
        await invoke("save_file", {
          path: schemaState.filePath,
          content: cleanCode,
        });
        updateDiagram();
      } catch (e) {
        console.error("Failed to save file:", e);
      } finally {
        setTimeout(() => {
          schemaState.isSaving = false;
        }, 600);
      }
    }
  }

  // Keyboard Shortcuts: Ctrl + S for Diagram Sync
  $effect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  onMount(async () => {
    if (schemaState.filePath) {
      try {
        const raw = await readTextFile(schemaState.filePath);
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
      } catch (e) {
        console.error("Failed to restore last session:", e);
        schemaState.filePath = null;
      }
    }
  });

  async function openFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "TypeScript", extensions: ["ts"] }],
      });

      if (selected && typeof selected === "string") {
        schemaState.filePath = selected;
        const raw = await readTextFile(selected);
        // Wrap in code block for Tipex to handle it cleanly
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans">
  <PaneGroup direction="horizontal" autoSaveId="strata-forge-main-layout">
    <!-- Workspace: Code Pane (Left Side - Source of Truth) -->
    <Pane
      defaultSize={35}
      minSize={20}
      class="flex flex-col bg-base-100 z-20 border-r border-base-300"
    >
      <!-- Code Header -->
      <div
        class="h-14 flex items-center justify-between px-6 border-b border-base-300 bg-base-100"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-2 h-2 rounded-full {schemaState.filePath
              ? 'bg-success'
              : 'bg-base-300'} {schemaState.isSaving
              ? 'animate-ping'
              : 'animate-pulse'}"
          ></div>
          <span
            class="font-extrabold text-[10px] uppercase tracking-[0.2em] opacity-80"
            >{schemaState.isSaving ? "Saving..." : "Source Truth"}</span
          >
        </div>
        <div class="flex items-center gap-2">
          <div
            class="badge badge-outline badge-sm font-mono opacity-50 gap-2 px-3"
          >
            <GitBranch class="w-3 h-3" />
            {currentBranch}
          </div>
          <button
            class="btn btn-ghost btn-xs btn-square"
            onclick={() => (branchModalOpen = true)}
            title="Create New Branch"
          >
            <History class="w-3.5 h-3.5" />
          </button>
          <div class="h-4 w-px bg-base-300 mx-1"></div>
          <button
            class="btn btn-primary btn-sm px-4 shadow-lg shadow-primary/20"
            onclick={() => (commitModalOpen = true)}
            disabled={!schemaState.filePath}
          >
            <Check class="w-4 h-4 mr-2" />
            Commit
          </button>
        </div>
      </div>

      <!-- Editor Canvas -->
      <div class="grow relative flex flex-col overflow-hidden bg-base-50/30">
        <div
          class="flex items-center justify-between px-4 py-1.5 bg-base-100 border-b border-base-300"
        >
          <div class="flex items-center gap-2">
            <FileCode class="w-3 h-3 opacity-50" />
            <span class="text-[9px] font-mono opacity-50"
              >{schemaState.filePath || "untitled.ts"}</span
            >
          </div>
          {#if gitStatus}
            <div class="text-[9px] text-warning flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-warning"></span>
              UNCOMMITTED
            </div>
          {/if}
        </div>

        <div class="grow overflow-auto p-4 flex flex-col">
          {#if schemaState.filePath}
            <SchemaEditor
              bind:value={schemaState.rawCode}
              onUpdate={updateDiagram}
            />
          {:else}
            <div
              class="grow flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500"
            >
              <div
                class="p-6 bg-primary/5 rounded-3xl mb-6 ring-1 ring-primary/10"
              >
                <FileCode class="w-12 h-12 text-primary/40" />
              </div>
              <h2 class="text-xl font-bold mb-2">No Schema Loaded</h2>
              <p
                class="text-sm text-base-content/60 max-w-[240px] mb-8 leading-relaxed"
              >
                Connect a Drizzle schema file to start syncing your database
                design.
              </p>
              <button
                class="btn btn-primary rounded-xl px-8 shadow-xl shadow-primary/20"
                onclick={openFile}
              >
                <FolderOpen class="w-4 h-4 mr-2" />
                Select schema.ts
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Stats Footer -->
      <div
        class="h-8 flex items-center px-4 bg-base-100 border-t border-base-300"
      >
        <span
          class="text-[9px] font-mono opacity-40 uppercase tracking-tighter"
        >
          Nodes: {schemaState.nodes.length} | Sync: {gitStatus
            ? "Modified"
            : "Clean"}
        </span>
      </div>
    </Pane>

    <!-- Resizer -->
    <PaneResizer
      class="relative w-1.5 bg-base-300/50 hover:bg-primary/40 transition-all duration-300 cursor-col-resize group"
    >
      <div
        class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-base-300 group-hover:bg-primary/60"
      ></div>
    </PaneResizer>

    <!-- Workspace: Diagram Pane (Right Side) -->
    <Pane
      defaultSize={65}
      minSize={30}
      class="relative flex flex-col bg-base-200/30"
    >
      <!-- Floating Toolbar -->
      <div class="absolute top-6 left-6 z-10 flex flex-col gap-4">
        <div
          class="flex items-center gap-3 bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl p-2 px-4 rounded-2xl h-14 transition-all hover:border-primary/30"
        >
          <div class="p-2 bg-primary/10 rounded-xl">
            <Share2 class="w-5 h-5 text-primary" />
          </div>
          <div class="flex flex-col">
            <h1
              class="font-black text-[10px] tracking-widest text-base-content/40 uppercase"
            >
              Strata Forge
            </h1>
            <span class="text-[10px] font-mono opacity-60"> Diagram View </span>
          </div>
          <div class="h-6 w-px bg-base-300 mx-1"></div>
          <div class="flex gap-1">
            <button
              class="btn btn-ghost btn-sm btn-square"
              onclick={openFile}
              title="Open Drizzle Schema"
            >
              <FolderOpen class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Svelte Flow Canvas -->
      <div class="grow">
        <SvelteFlow
          bind:nodes={schemaState.nodes}
          bind:edges={schemaState.edges}
          {nodeTypes}
          onreconnect={() => {}}
          onnodedragstop={handleNodeDragStop}
          {onconnect}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.5 }}
          initialViewport={{ x: 0, y: 0, zoom: 0.5 }}
          snapGrid={[15, 15]}
          colorMode="light"
          minZoom={0.1}
          maxZoom={2}
        >
          <Controls
            position="bottom-left"
            class="bg-base-100! border-base-300! shadow-lg! rounded-xl! overflow-hidden"
          />
          <Background patternColor="oklch(var(--p) / 0.1)" gap={24} />
          <MiniMap
            position="bottom-right"
            class="bg-base-100! border-base-300! shadow-lg! rounded-xl!"
          />
        </SvelteFlow>
      </div>

      <!-- Coordinate Overlay (Bottom Left of Diagram) -->
      <div class="absolute bottom-6 left-28 z-10 pointer-events-none">
        <div
          class="bg-neutral text-neutral-content px-3 py-1.5 rounded-xl text-[10px] font-mono shadow-2xl flex gap-3 border border-white/10 backdrop-blur-md opacity-80"
        >
          <span class="opacity-50">COORD</span>
          <div class="flex gap-2">
            <span class="text-primary font-bold">X:</span>
            <span class="w-10 overflow-hidden"
              >{Math.round(
                schemaState.nodes.find((n) => n.selected)?.position.x ?? 0,
              )}</span
            >
          </div>
          <div class="flex gap-2 border-l border-white/10 pl-2">
            <span class="text-secondary font-bold">Y:</span>
            <span class="w-10 overflow-hidden"
              >{Math.round(
                schemaState.nodes.find((n) => n.selected)?.position.y ?? 0,
              )}</span
            >
          </div>
        </div>
      </div>
    </Pane>
  </PaneGroup>

  <!-- Branch Modal -->
  {#if branchModalOpen}
    <div class="modal modal-open backdrop-blur-sm">
      <div
        class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-8 max-w-sm"
      >
        <div class="flex items-center gap-4 mb-6">
          <div class="p-3 bg-secondary/10 rounded-2xl">
            <History class="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h3 class="font-black text-lg uppercase tracking-wider">
              New Branch
            </h3>
            <p class="text-[10px] font-mono opacity-50 uppercase">
              Snapshot current state
            </p>
          </div>
        </div>

        <div class="form-control mb-8">
          <label class="label mb-1" for="branch-name-input">
            <span
              class="label-text font-bold text-[10px] uppercase opacity-40 tracking-widest"
              >Branch Name</span
            >
          </label>
          <input
            id="branch-name-input"
            bind:value={branchName}
            class="input input-bordered bg-base-200 focus:input-secondary font-mono text-sm rounded-2xl"
            placeholder="feature/new-schema"
          />
        </div>

        <div class="modal-action flex items-center justify-between">
          <button
            class="btn btn-ghost rounded-xl px-6"
            onclick={() => (branchModalOpen = false)}>Cancel</button
          >
          <button
            class="btn btn-secondary rounded-xl px-8 shadow-lg shadow-secondary/20"
            onclick={handleCreateBranch}
            disabled={!branchName}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Commit Modal -->
  {#if commitModalOpen}
    <div class="modal modal-open backdrop-blur-sm">
      <div
        class="modal-box bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-8 max-w-md"
      >
        <div class="flex items-center gap-4 mb-6">
          <div class="p-3 bg-primary/10 rounded-2xl">
            <GitBranch class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-black text-lg uppercase tracking-wider">
              Commit Changes
            </h3>
            <p class="text-[10px] font-mono opacity-50 uppercase">
              Target: {schemaState.filePath?.split("/").pop()}
            </p>
          </div>
        </div>

        <div class="form-control mb-8">
          <label class="label mb-1" for="commit-message-input">
            <span
              class="label-text font-bold text-[10px] uppercase opacity-40 tracking-widest"
              >Message</span
            >
          </label>
          <textarea
            id="commit-message-input"
            bind:value={commitMessage}
            class="textarea textarea-bordered bg-base-200 focus:textarea-primary h-24 font-mono text-sm rounded-2xl"
            placeholder="What did you change?"
          ></textarea>
        </div>

        <div class="modal-action flex items-center justify-between">
          <button
            class="btn btn-ghost rounded-xl px-6"
            onclick={() => (commitModalOpen = false)}>Cancel</button
          >
          <button
            class="btn btn-primary rounded-xl px-8 shadow-lg shadow-primary/20"
            onclick={performCommit}
            disabled={!commitMessage}
          >
            Confirm Commit
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @reference "./layout.css";

  :global(.svelte-flow) {
    --bg-color: transparent;
    --text-color: oklch(var(--bc));
    --node-border-radius: 12px;
    --node-box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  /* Customizing Svelte Flow built-ins to match theme */
  :global(.svelte-flow__controls button) {
    @apply border-base-300 hover:bg-base-200 transition-colors;
    fill: currentColor;
  }

  :global(.svelte-flow__minimap) {
    @apply border-base-300 bg-base-100/80 backdrop-blur-md;
  }
</style>
