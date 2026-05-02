<script lang="ts">
  import { addEdge } from "@xyflow/svelte";
  import type { Connection } from "@xyflow/svelte";
  import { onMount } from "svelte";
  import { schemaState } from "$lib/state.svelte";
  import {
    addEdgeToSchema,
    updateNodePositionInSchema,
    stripHtml,
  } from "$lib/parser";
  import { open } from "@tauri-apps/plugin-dialog";
  import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";

  // --- Components ---
  import Navbar from "$lib/components/Navbar.svelte";
  import DiagramCanvas from "$lib/components/DiagramCanvas.svelte";
  import Inspector from "$lib/components/Inspector.svelte";
  import Overlays from "$lib/components/Overlays.svelte";
  import SchemaStats from "$lib/components/SchemaStats.svelte";
  import NewTableForm from "$lib/components/NewTableForm.svelte";


  /**
   * Handles Svelte Flow connection events (dragging a line between nodes).
   */
  async function onconnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    
    // Optimistic UI update
    schemaState.edges = addEdge(
      {
        ...connection,
        animated: true,
        style: "stroke: var(--color-primary); stroke-width: 2; opacity: 0.6;",
        type: "smoothstep",
      },
      schemaState.edges,
    );

    // Persistence logic
    if (schemaState.filePath) {
      schemaState.isSaving = true;
      try {
        schemaState.isSyncing = true;
        const cleanCode = stripHtml(schemaState.rawCode);
        const newCode = addEdgeToSchema(cleanCode, connection.source, connection.target);
        await writeTextFile(schemaState.filePath, newCode);
        await schemaState.syncWithFile();
      } catch (err) {
        schemaState.isSyncing = false;
        console.error("[Strata] Connection save failed:", err);
      } finally {
        setTimeout(() => (schemaState.isSaving = false), 600);
      }
    }
  }

  /**
   * Marks diagram as dirty when a node is moved.
   */
  async function onnodedragstop() {
    schemaState.hasUnsavedChanges = true;
  }

  /**
   * Persists node layout (positions) to @strata JSDoc metadata.
   */
  async function saveDiagramChanges() {
    if (!schemaState.filePath || !schemaState.hasUnsavedChanges) return;

    try {
      schemaState.isSyncing = true;
      let currentCode = stripHtml(schemaState.rawCode);

      // Batch update all node positions in AST
      for (const node of schemaState.nodes) {
        currentCode = updateNodePositionInSchema(currentCode, node.id, node.position.x, node.position.y);
      }

      await writeTextFile(schemaState.filePath, currentCode);
      await schemaState.syncWithFile();
      schemaState.hasUnsavedChanges = false;
      
      // Success feedback
      schemaState.isRecentlySaved = true;
      setTimeout(() => (schemaState.isRecentlySaved = false), 1500);
    } catch (err) {
      console.error("[Strata] Save failed:", err);
    } finally {
      schemaState.isSyncing = false;
    }
  }

  /**
   * Global Shortcut Handler (Ctrl+S)
   */
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveDiagramChanges();
    }
  }

  /**
   * File Picker Dialog
   */
  async function openFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "TypeScript", extensions: ["ts"] }],
      });
      if (selected && typeof selected === "string") {
        schemaState.filePath = selected;
        await schemaState.syncWithFile();
        await invoke("watch_file", { path: selected });
      }
    } catch (err) {
      console.error("[Strata] File open failed:", err);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    
    let unlistenFn: () => void;
    const init = async () => {
      // Listen for external file changes (e.g. IDE edits)
      unlistenFn = await listen("file-changed", async () => {
        if (schemaState.filePath && !schemaState.isSyncing) {
          console.log("[Strata] External file change detected, syncing...");
          await schemaState.syncWithFile();
        }
      });

      // Restore last session
      if (schemaState.filePath) {
        try {
          await schemaState.syncWithFile();
          await invoke("watch_file", { path: schemaState.filePath });
        } catch (e) {
          schemaState.filePath = null;
        }
      }
    };

    init();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unlistenFn) unlistenFn();
    };
  });
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans overflow-hidden">
  <Navbar onOpenFile={openFile} />

  <main class="h-full w-full relative pt-16">
    <DiagramCanvas {onconnect} {onnodedragstop} />
    <Overlays onOpenFile={openFile} />
    <SchemaStats />
    <Inspector />
    
    {#if schemaState.showNewTableModal}
      <NewTableForm />
    {/if}
  </main>
</div>
