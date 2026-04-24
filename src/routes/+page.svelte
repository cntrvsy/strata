<script lang="ts">
  import { addEdge, type Connection } from "@xyflow/svelte";
  import { onMount } from "svelte";
  import { schemaState } from "$lib/state.svelte";
  import { parseSchema, addEdgeToSchema } from "$lib/parser";
  import { open } from "@tauri-apps/plugin-dialog";
  import { readTextFile } from "@tauri-apps/plugin-fs";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";

  // Modular Components
  import Navbar from "$lib/components/Navbar.svelte";
  import DiagramCanvas from "$lib/components/DiagramCanvas.svelte";
  import Inspector from "$lib/components/Inspector.svelte";
  import Overlays from "$lib/components/Overlays.svelte";

  let parseTimeout: any;
  let lastProcessedCode = "";
  let isSyncingFromDiagram = false;

  function getRawText(html: string) {
    if (typeof document === "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  function updateDiagram() {
    const cleanCode = getRawText(schemaState.rawCode);
    if (cleanCode === lastProcessedCode) return;
    clearTimeout(parseTimeout);
    parseTimeout = setTimeout(() => {
      if (isSyncingFromDiagram) {
        isSyncingFromDiagram = false;
        lastProcessedCode = cleanCode;
        return;
      }
      const result = parseSchema(cleanCode);
      if (result.success) {
        if (result.nodes.length > 0) {
          schemaState.nodes = result.nodes;
          schemaState.edges = result.edges;
        }
        schemaState.isValid = true;
        schemaState.error = null;
        lastProcessedCode = cleanCode;
      } else {
        schemaState.isValid = false;
        schemaState.error = result.error || "Schema Error";
      }
    }, 150);
  }

  $effect(() => {
    if (schemaState.rawCode) updateDiagram();
  });

  async function onconnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
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
      schemaState.isSaving = true;
      try {
        isSyncingFromDiagram = true;
        const cleanCode = getRawText(schemaState.rawCode);
        const newCode = addEdgeToSchema(
          cleanCode,
          connection.source,
          connection.target,
        );
        await invoke("save_file", {
          path: schemaState.filePath,
          content: newCode,
        });
        const raw = await readTextFile(schemaState.filePath);
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
      } catch (err) {
        isSyncingFromDiagram = false;
        console.error("Failed to save connection:", err);
      } finally {
        setTimeout(() => {
          schemaState.isSaving = false;
        }, 600);
      }
    }
  }

  async function onnodedragstop(event: any) {
    const { node } = event;
    if (schemaState.filePath) {
      try {
        isSyncingFromDiagram = true;
        await invoke("save_node_pos", {
          path: schemaState.filePath,
          tableName: node.id,
          x: node.position.x,
          y: node.position.y,
        });
        const raw = await readTextFile(schemaState.filePath);
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
      } catch (err) {
        isSyncingFromDiagram = false;
        console.error("Failed to save position:", err);
      }
    }
  }

  async function openFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "TypeScript", extensions: ["ts"] }],
      });
      if (selected && typeof selected === "string") {
        schemaState.filePath = selected;
        const raw = await readTextFile(selected);
        schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
        await invoke("watch_file", { path: selected });
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }

  onMount(() => {
    let unlistenFn: () => void;
    const init = async () => {
      unlistenFn = await listen("file-changed", async () => {
        if (schemaState.filePath && !isSyncingFromDiagram) {
          const raw = await readTextFile(schemaState.filePath);
          schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
        }
      });
      if (schemaState.filePath) {
        try {
          const raw = await readTextFile(schemaState.filePath);
          schemaState.rawCode = `<pre><code>${raw}</code></pre>`;
          await invoke("watch_file", { path: schemaState.filePath });
        } catch (e) {
          console.error("Restore failed:", e);
          schemaState.filePath = null;
        }
      }
    };
    init();
    return () => {
      if (unlistenFn) unlistenFn();
    };
  });
</script>

<div
  class="h-screen w-screen bg-base-100 text-base-content font-sans overflow-hidden"
>
  <Navbar onOpenFile={openFile} />

  <main class="h-full w-full relative pt-16">
    <DiagramCanvas {onconnect} {onnodedragstop} />
    <Overlays onOpenFile={openFile} />
    <Inspector />
  </main>
</div>

<style>
  @reference "./layout.css";
</style>
