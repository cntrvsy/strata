<script lang="ts">
  /**
   * Strata: The Drizzle Design Companion
   *
   * This is the root page component that assembles the visual editor.
   * It handles global keyboard shortcuts, drag-and-drop relationship creation,
   * and coordinates the synchronization between UI events and AST persistence.
   */
  import { addEdge, SvelteFlowProvider } from "@xyflow/svelte";
  import type { Connection } from "@xyflow/svelte";
  import { onMount } from "svelte";
  import { PaneGroup, Pane, PaneResizer } from "paneforge";
  import { schemaState } from "$lib/state";
  import { PlatformService } from "$lib/services/platform";
  import { ChevronLeft, ChevronRight } from "lucide-svelte";

  let codePane = $state<ReturnType<typeof Pane>>();
  let diagramPane = $state<ReturnType<typeof Pane>>();

  function resetLayout() {
    codePane?.resize(45);
    diagramPane?.resize(55);
  }

  $effect(() => {
    schemaState.toggleCodePane = () => {
      if (schemaState.isCodeCollapsed) {
        codePane?.resize(45);
      } else {
        codePane?.collapse();
      }
    };
    schemaState.toggleDiagramPane = () => {
      if (schemaState.isDiagramCollapsed) {
        diagramPane?.resize(55);
      } else {
        diagramPane?.collapse();
      }
    };
  });
 
  // --- Components ---
  import DiagramCanvas from "$lib/components/DiagramCanvas.svelte";
  import Inspector from "$lib/components/Inspector.svelte";
  import Overlays from "$lib/components/Overlays.svelte";
  import SchemaStats from "$lib/components/SchemaStats.svelte";
  import NewEntityForm from "$lib/components/forms/NewEntityForm.svelte";
  import CodeEditor from "$lib/components/CodeEditor.svelte";

  /**
   * Handles Svelte Flow connection events (dragging a line between nodes).
   * Persists the new relationship as either a Drizzle relation() or a synthetic JSDoc relation.
   */
  async function onconnect(connection: Connection) {
    if (!connection.source || !connection.target) return;

    // Optimistic UI update for immediate feedback
    schemaState.edges = addEdge(
      {
        ...connection,
        animated: true,
        style: "stroke: var(--color-primary); stroke-width: 2.25; opacity: 0.95;",
        type: "smoothstep",
      },
      schemaState.edges,
    );

    await schemaState.addRelation(connection.source, connection.target);
  }

  let saveTimeout: any;

  // Register the file with the Rust-side watcher when the path changes
  $effect(() => {
    if (schemaState.filePath) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("watch_file", { path: schemaState.filePath }).catch((err) =>
          console.warn("[Strata] Watcher path register failed:", err),
        );
      });
    }
  });

  async function onnodedragstop() {
    schemaState.nodes = [...schemaState.nodes];
    schemaState.machine.send("EDIT");

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      schemaState.saveToFile();
    }, 1500);
  }

  /**
   * Persists all changes back to the schema file.
   * Triggered by Ctrl+S or manual save actions.
   */
  async function saveDiagramChanges() {
    await schemaState.saveToFile();
  }

  /**
   * Global Keyboard Shortcut Handler.
   */
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveDiagramChanges();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);

    let unlistenFn: () => void;
    let unlistenDragDrop: () => void;

    const init = async () => {
      // Listen for external file changes globally
      try {
        unlistenFn = await PlatformService.listenEvent(
          "file-changed",
          async () => {
            if (schemaState.ignoreNextWatch) {
              schemaState.ignoreNextWatch = false;
              return;
            }
            if (Date.now() - schemaState.lastWriteTime < 800) {
              console.log("[Strata] Ignoring file watch event: recently written by UI");
              return;
            }
            if (
              schemaState.filePath &&
              (schemaState.machine.current === "IDLE" ||
                schemaState.machine.current === "DIRTY")
            ) {
              console.log("[Strata] External file change detected, syncing...");
              await schemaState.syncWithFile();
            }
          },
        );
      } catch (e) {
        console.warn("[Strata] File watcher not available:", e);
      }

      // Listen for external file drag and drop
      try {
        unlistenDragDrop = await PlatformService.listenEvent(
          "tauri://drag-drop",
          async (event: any) => {
            const paths = event.payload?.paths;
            if (paths && paths.length > 0) {
              const droppedPath = paths[0];
              if (droppedPath.endsWith(".ts")) {
                console.log("[Strata] File dropped, opening:", droppedPath);
                schemaState.filePath = droppedPath;
                schemaState.machine.send("OPEN");
                await schemaState.syncWithFile();
              }
            }
          },
        );
      } catch (e) {
        console.warn("[Strata] Drag-and-drop listener not available:", e);
      }
    };

    init();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unlistenFn) unlistenFn();
      if (unlistenDragDrop) unlistenDragDrop();
      clearTimeout(saveTimeout);
    };
  });
</script>

<div class="h-full w-full relative overflow-hidden flex bg-base-200">
  {#if !schemaState.filePath}
    <Overlays />
  {:else}
    <!-- Floating expand triggers when panes are collapsed -->
    {#if schemaState.isCodeCollapsed}
      <button
        onclick={() => codePane?.resize(45)}
        class="absolute left-3 top-1/2 -translate-y-1/2 z-40 btn btn-circle btn-primary btn-sm shadow-md animate-in slide-in-from-left-2 duration-300"
        title="Show Code Editor"
      >
        <ChevronRight class="w-4 h-4 text-primary-content" />
      </button>
    {/if}
    {#if schemaState.isDiagramCollapsed}
      <button
        onclick={() => diagramPane?.resize(55)}
        class="absolute right-3 top-1/2 -translate-y-1/2 z-40 btn btn-circle btn-primary btn-sm shadow-md animate-in slide-in-from-right-2 duration-300"
        title="Show Diagram Canvas"
      >
        <ChevronLeft class="w-4 h-4 text-primary-content" />
      </button>
    {/if}

    <PaneGroup direction="horizontal" class="w-full h-full">
      <Pane
        minSize={15}
        defaultSize={45}
        order={0}
        collapsible={true}
        collapsedSize={0}
        bind:this={codePane}
        onCollapse={() => (schemaState.isCodeCollapsed = true)}
        onExpand={() => (schemaState.isCodeCollapsed = false)}
      >
        <div class="h-full w-full flex flex-col min-h-0 overflow-hidden relative">
          <CodeEditor />
        </div>
      </Pane>
      <PaneResizer 
        class="w-[3px] bg-base-300 hover:bg-primary/50 active:bg-primary transition-colors cursor-col-resize z-10" 
        ondblclick={resetLayout}
      />
      <Pane
        minSize={20}
        defaultSize={55}
        order={1}
        collapsible={true}
        collapsedSize={0}
        bind:this={diagramPane}
        onCollapse={() => (schemaState.isDiagramCollapsed = true)}
        onExpand={() => (schemaState.isDiagramCollapsed = false)}
      >
        <PaneGroup direction="horizontal" class="w-full h-full">
          {#if schemaState.activeInspectorNodeId}
            <Pane minSize={15} defaultSize={25} order={0}>
              <div class="h-full w-full flex flex-col min-h-0 overflow-hidden relative">
                <Inspector />
              </div>
            </Pane>
            <PaneResizer class="w-[3px] bg-base-300 hover:bg-primary/50 active:bg-primary transition-colors cursor-col-resize z-10" />
          {/if}
          <Pane order={1}>
            <div class="h-full w-full flex flex-col min-h-0 overflow-hidden relative">
              <SvelteFlowProvider>
                <DiagramCanvas {onconnect} {onnodedragstop} />
                <Overlays />
                <SchemaStats />
              </SvelteFlowProvider>
            </div>
          </Pane>
        </PaneGroup>
      </Pane>
    </PaneGroup>
  {/if}
</div>

{#if schemaState.showNewTableModal}
  <NewEntityForm />
{/if}
