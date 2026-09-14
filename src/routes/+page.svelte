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
  import { schemaState } from "#lib/state";
  import { PlatformService } from "#lib/services/platform";

  // --- Components ---
  import DiagramCanvas from "#lib/components/diagram/DiagramCanvas.svelte";
  import Inspector from "#lib/components/inspector/Inspector.svelte";
  import WelcomeLauncher from "#lib/components/layout/WelcomeLauncher.svelte";
  import LoadingOverlay from "#lib/components/layout/LoadingOverlay.svelte";
  import PackageWrapperEmptyState from "#lib/components/layout/PackageWrapperEmptyState.svelte";
  import GlobalModals from "#lib/components/modals/GlobalModals.svelte";
  import CanvasSearchPalette from "#lib/components/diagram/CanvasSearchPalette.svelte";

  let showSearchPalette = $state(false);

  /**
   * Handles Svelte Flow connection events (dragging a line between nodes).
   */
  async function onconnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    // Duplicate Edge Guard
    const exists = schemaState.edges.some(
      (e) =>
        (e.source === connection.source && e.target === connection.target) ||
        (e.source === connection.target && e.target === connection.source)
    );
    if (exists) {
      const { toast } = await import("svelte-sonner");
      toast.info("Relationship Already Exists", {
        description: `A connection between "${connection.source}" and "${connection.target}" is already present.`
      });
      return;
    }

    const sourceNode = schemaState.nodes.find((n) => n.id === connection.source);
    const targetNode = schemaState.nodes.find((n) => n.id === connection.target);
    const sourceType = (sourceNode?.data as any)?.target || "d1";
    const targetType = (targetNode?.data as any)?.target || "d1";

    const isCrossStorage = sourceType !== "d1" || targetType !== "d1";

    if (isCrossStorage) {
      // Connect as an architectural edge in @strata-layout (preserves Git-clean domain files)
      await schemaState.addRelation(connection.source, connection.target);
      const { toast } = await import("svelte-sonner");
      toast.success("Architectural Binding Linked", {
        description: `Connected "${connection.source}" to "${connection.target}" in Strata layout.`
      });
    } else {
      // D1 to D1: Inform the developer that relationships are code-driven
      const { toast } = await import("svelte-sonner");
      toast.info("Relationships Are Code-Driven", {
        description: `Define foreign keys via .references() or relations() in your schema. Strata will visualize them live.`
      });
    }
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
    }, 600);
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
    const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(
      (e.target as HTMLElement)?.tagName,
    );

    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveDiagramChanges();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      showSearchPalette = true;
    } else if (e.key === "?" && !isInput) {
      e.preventDefault();
      schemaState.showHelpModal = true;
    } else if (e.key === "Escape") {
      if (showSearchPalette) {
        showSearchPalette = false;
      } else if (schemaState.activeInspectorNodeId) {
        schemaState.activeInspectorNodeId = null;
      }
    } else if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
      const selectedNode = schemaState.nodes.find((n) => n.selected);
      if (selectedNode) {
        e.preventDefault();
        const targetId = selectedNode.id;
        schemaState.promptConfirm({
          title: "Delete Entity",
          message: `Are you sure you want to delete entity "${targetId}" from your schema? This will remove its column definitions and relationship declarations.`,
          confirmLabel: "Delete Entity",
          isDanger: true,
          onConfirm: () => schemaState.deleteTable(targetId),
        });
      }
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
  {#if !schemaState.filePath && !schemaState.isSandboxMode}
    <WelcomeLauncher />
  {:else}
    <PaneGroup direction="horizontal" class="w-full h-full">
      <Pane order={0}>
        <div
          class="h-full w-full flex flex-col min-h-0 overflow-hidden relative"
        >
          <SvelteFlowProvider>
            <DiagramCanvas {onconnect} {onnodedragstop} />
            <LoadingOverlay />
            <PackageWrapperEmptyState />
            <CanvasSearchPalette bind:show={showSearchPalette} />
          </SvelteFlowProvider>
        </div>
      </Pane>
      {#if schemaState.activeInspectorNodeId}
        <PaneResizer
          class="w-1.5 bg-base-300/40 hover:bg-primary/70 active:bg-primary transition-colors duration-150 cursor-col-resize z-10 flex items-center justify-center group"
        >
          <div class="w-0.5 h-5 rounded-full bg-base-content/20 group-hover:bg-primary-content transition-colors duration-150"></div>
        </PaneResizer>
        <Pane minSize={20} defaultSize={28} order={1}>
          <div
            class="h-full w-full flex flex-col min-h-0 overflow-hidden relative"
          >
            <Inspector />
          </div>
        </Pane>
      {/if}
    </PaneGroup>
  {/if}
</div>

<GlobalModals />

