<script lang="ts">
  /**
   * Strata Forge: The Drizzle Design Companion
   * 
   * This is the root page component that assembles the visual editor.
   * It handles global keyboard shortcuts, drag-and-drop relationship forging,
   * and coordinates the synchronization between UI events and AST persistence.
   */
  import { addEdge } from "@xyflow/svelte";
  import type { Connection } from "@xyflow/svelte";
  import { onMount } from "svelte";
  import { schemaState } from "$lib/state.svelte";
  import {
    addEdgeToSchema,
    updateNodePositionInSchema,
    stripHtml,
  } from "$lib/parser";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { listen } from "@tauri-apps/api/event";

  // --- Components ---
  import Navbar from "$lib/components/Navbar.svelte";
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
        const newCode = addEdgeToSchema(schemaState.rawCode, connection.source, connection.target);
        await writeTextFile(schemaState.filePath, newCode);
        await schemaState.syncWithFile();
        schemaState.machine.send("SAVE_SUCCESS");
      } catch (err) {
        schemaState.machine.send("SAVE_ERROR");
        console.error("[Strata] Connection save failed:", err);
      }
    }
  }

  /**
   * Marks the diagram as having unsaved layout changes (node positions).
   */
  async function onnodedragstop() {
    schemaState.machine.send("EDIT");
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
    const init = async () => {
      // Listen for external file changes (e.g. edits made in VS Code)
      try {
        unlistenFn = await listen("file-changed", async () => {
          if (schemaState.filePath && !schemaState.isSyncing) {
            console.log("[Strata] External file change detected, syncing...");
            await schemaState.syncWithFile();
          }
        });
      } catch (e) {
        console.warn("[Strata] Tauri events not available");
      }

    };

    init();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unlistenFn) unlistenFn();
    };
  });
</script>

{#if schemaState.viewMode === 'diagram'}
  <DiagramCanvas {onconnect} {onnodedragstop} />
  <Overlays />
  <SchemaStats />
  <Inspector />
{:else}
  <CodeEditor />
{/if}

{#if schemaState.showNewTableModal}
  <NewTableForm />
{/if}
