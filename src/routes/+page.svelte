<script lang="ts">
  /**
   * Strata: The Drizzle Design Companion
   *
   * This is the root page component that assembles the visual editor.
   * It handles global keyboard shortcuts, drag-and-drop relationship forging,
   * and coordinates the synchronization between UI events and AST persistence.
   */
  import { addEdge, SvelteFlowProvider } from "@xyflow/svelte";
  import type { Connection } from "@xyflow/svelte";
  import { onMount } from "svelte";
  import { Splitpanes, Pane } from "svelte-splitpanes";
  import { schemaState } from "$lib/state.svelte";
  import { addEdgeToSchema } from "$lib/parser";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { listen } from "@tauri-apps/api/event";
  import { Debounced } from "runed";

  // --- Components ---
  import DiagramCanvas from "$lib/components/DiagramCanvas.svelte";
  import Inspector from "$lib/components/Inspector.svelte";
  import Overlays from "$lib/components/Overlays.svelte";
  import SchemaStats from "$lib/components/SchemaStats.svelte";
  import NewTableForm from "$lib/components/NewTableForm.svelte";
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
        style: "stroke: var(--color-primary); stroke-width: 2; opacity: 0.6;",
        type: "smoothstep",
      },
      schemaState.edges,
    );

    if (schemaState.filePath) {
      schemaState.machine.send("SAVE");
      try {
        const newCode = addEdgeToSchema(
          schemaState.rawCode,
          connection.source,
          connection.target,
        );
        await writeTextFile(schemaState.filePath, newCode);
        await schemaState.syncWithFile();
        schemaState.machine.send("SAVE_SUCCESS");
      } catch (err: any) {
        schemaState.error = err.message || "Write failure";
        schemaState.errorType = "disk";
        schemaState.machine.send("SAVE_ERROR");
        console.error("[Strata] Connection save failed:", err);
      }
    }
  }

  let triggerSave = $state(0);
  const debouncedSave = new Debounced(() => triggerSave, 1000);

  $effect(() => {
    if (debouncedSave.current > 0) {
      schemaState.saveToFile();
    }
  });

  async function onnodedragstop() {
    schemaState.nodes = [...schemaState.nodes];
    schemaState.machine.send("EDIT");
    triggerSave += 1;
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
      // Listen for external file changes (e.g. edits made in VS Code)
      try {
        unlistenFn = await listen("file-changed", async () => {
          if (schemaState.filePath && !schemaState.isSyncing && schemaState.machine.current !== "SAVING") {
            console.log("[Strata] External file change detected, syncing...");
            await schemaState.syncWithFile();
          }
        });
      } catch (e) {
        console.warn("[Strata] Tauri events not available");
      }

      // Listen for external file drag and drop
      try {
        unlistenDragDrop = await listen("tauri://drag-drop", async (event: any) => {
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
        });
      } catch (e) {
        console.warn("[Strata] Drag-and-drop listener not available");
      }
    };

    init();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unlistenFn) unlistenFn();
      if (unlistenDragDrop) unlistenDragDrop();
    };
  });
</script>

<div class="h-full w-full relative overflow-hidden flex bg-base-200">
  {#if !schemaState.filePath}
    <Overlays />
  {:else}
    <Splitpanes theme="modern" class="w-full h-full">
      <Pane minSize={20} size={40}>
        <CodeEditor />
      </Pane>
      <Pane minSize={20} size={60}>
        <Splitpanes horizontal={false}>
          {#if schemaState.nodes.some(n => n.selected)}
            <Pane minSize={15} size={25}>
              <Inspector />
            </Pane>
          {/if}
          <Pane>
            <SvelteFlowProvider>
              <DiagramCanvas {onconnect} {onnodedragstop} />
              <Overlays />
              <SchemaStats />
            </SvelteFlowProvider>
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>
  {/if}
</div>

{#if schemaState.showNewTableModal}
  <NewTableForm />
{/if}
