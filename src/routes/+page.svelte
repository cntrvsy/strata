<script lang="ts">
  import { SvelteFlow, Controls, Background, MiniMap } from "@xyflow/svelte";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import { schemaState } from "$lib/state.svelte";
  import { parseSchema } from "$lib/parser";
  import TableNode from "$lib/components/TableNode.svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { readTextFile } from "@tauri-apps/plugin-fs";
  import { invoke } from "@tauri-apps/api/core";
  import {
    FileCode,
    Share2,
    Save,
    Undo2,
    FolderOpen,
    Search,
    Grid3X3,
    MousePointer2,
  } from "lucide-svelte";

  const nodeTypes = {
    table: TableNode,
  };

  // Sync diagram when code changes
  $effect(() => {
    if (schemaState.rawCode) {
      const { nodes, edges } = parseSchema(schemaState.rawCode);
      // Only update if something actually changed to avoid layout jumps
      schemaState.nodes = nodes;
      schemaState.edges = edges;
    }
  });

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
        // Refresh the code view to show the new JSDoc coordinates
        schemaState.rawCode = await readTextFile(schemaState.filePath);
      } catch (err) {
        console.error("Failed to save position:", err);
      }
    }
  }

  function handleSave() {
    console.log("Explicit sync triggered");
  }

  async function openFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "TypeScript", extensions: ["ts"] }],
      });

      if (selected && typeof selected === "string") {
        schemaState.filePath = selected;
        schemaState.rawCode = await readTextFile(selected);
        // $effect will trigger parseSchema
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans">
  <PaneGroup direction="horizontal" autoSaveId="strata-forge-main-layout">
    <!-- Workspace: Diagram Pane -->
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
            <span class="text-[10px] font-mono opacity-60">
              {schemaState.filePath?.split("/").pop() || "No File Selected"}
            </span>
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
            <button
              class="btn btn-ghost btn-sm btn-square"
              title="Search nodes"
            >
              <Search class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          class="bg-base-100/90 backdrop-blur-xl border border-base-300 shadow-xl p-1.5 rounded-2xl flex flex-col gap-1 w-fit"
        >
          <button class="btn btn-primary btn-sm btn-square">
            <MousePointer2 class="w-4 h-4" />
          </button>
          <button class="btn btn-ghost btn-sm btn-square">
            <Grid3X3 class="w-4 h-4" />
          </button>
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
          fitView
          snapGrid={[15, 15]}
          colorMode="light"
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
    </Pane>

    <!-- Resizer -->
    <PaneResizer
      class="relative w-1.5 bg-base-300/50 hover:bg-primary/40 transition-all duration-300 cursor-col-resize group"
    >
      <div
        class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-base-300 group-hover:bg-primary/60"
      ></div>
    </PaneResizer>

    <!-- Code Pane (Right Side) -->
    <Pane defaultSize={35} minSize={20} class="flex flex-col bg-base-100 z-20">
      <!-- Code Header -->
      <div
        class="h-14 flex items-center justify-between px-6 border-b border-base-300 bg-base-50/50"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-2 h-2 rounded-full {schemaState.filePath
              ? 'bg-success'
              : 'bg-base-300'} animate-pulse"
          ></div>
          <span
            class="font-bold text-[10px] uppercase tracking-widest opacity-70"
            >Schema Editor</span
          >
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-ghost btn-sm btn-square"
            title="Revert to last commit"
          >
            <Undo2 class="w-4 h-4" />
          </button>
          <button
            class="btn btn-primary btn-sm px-4 shadow-lg shadow-primary/20"
            onclick={handleSave}
            disabled={!schemaState.filePath}
          >
            <Save class="w-4 h-4 mr-2" />
            Sync
          </button>
        </div>
      </div>

      <!-- Editor Canvas -->
      <div class="grow relative flex flex-col">
        <div
          class="flex items-center gap-2 px-4 py-1.5 bg-base-200/50 border-b border-base-300"
        >
          <FileCode class="w-3 h-3 opacity-50" />
          <span class="text-[9px] font-mono opacity-50"
            >{schemaState.filePath || "untitled.ts"}</span
          >
        </div>
        <textarea
          class="grow p-6 font-mono text-[13px] leading-relaxed bg-base-100 outline-none resize-none focus:bg-base-50 transition-colors"
          spellcheck="false"
          placeholder="// Drizzle Schema will appear here..."
          bind:value={schemaState.rawCode}
        ></textarea>
      </div>

      <!-- Stats Footer -->
      <div
        class="h-8 flex items-center px-4 bg-base-200 border-t border-base-300"
      >
        <span
          class="text-[9px] font-mono opacity-40 uppercase tracking-tighter"
        >
          Tables: {schemaState.nodes.length} | Relations: {schemaState.edges
            .length}
        </span>
      </div>
    </Pane>
  </PaneGroup>
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
