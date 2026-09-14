<!--
  DiagramCanvas.svelte

  Summary: Main Svelte Flow diagram editor canvas rendering tables, columns, relations, minimap, and controls.
  Expects: None (shares global schemaState).
  Output: Interactivity triggers for dragging, connection forging, and context menus.
-->
<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    ConnectionMode,
    useSvelteFlow,
  } from "@xyflow/svelte";
  import { schemaState } from "#lib/state";
  import TableNode from "#lib/components/diagram/TableNode.svelte";
  import IdentityNode from "#lib/components/diagram/IdentityNode.svelte";
  import RelationEdge from "#lib/components/diagram/RelationEdge.svelte";
  import ContextMenu from "#lib/components/diagram/ContextMenu.svelte";
  import { PlatformService } from "#lib/services/platform";
  import { toast } from "svelte-sonner";

  const { onconnect, onnodedragstop } = $props<{
    onconnect: (connection: any) => void;
    onnodedragstop: (event: any) => void;
  }>();

  const nodeTypes = {
    table: TableNode,
    identity: IdentityNode,
  };

  const edgeTypes = {
    relation: RelationEdge,
  };

  const { fitView } = useSvelteFlow();

  let contextMenu = $state<{
    x: number;
    y: number;
    type: "canvas" | "node";
    targetId?: string;
    nodeType?: string;
    nodeData?: any;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    type: "canvas",
    visible: false,
  });

  function handleNodeContextMenu(event: MouseEvent, node: any) {
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      type: "node",
      targetId: node.id,
      nodeType: node.type,
      nodeData: node.data,
      visible: true,
    };
  }

  function handlePaneContextMenu(event: MouseEvent) {
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      type: "canvas",
      visible: true,
    };
  }

  function handleContextMenuAction(action: string, targetId?: string) {
    if (action === "new_table") {
      schemaState.showNewTableModal = true;
    } else if (action === "fit_view") {
      fitView();
    } else if (action === "inspect_node" && targetId) {
      schemaState.activeInspectorNodeId = targetId;
      schemaState.nodes = schemaState.nodes.map(n => ({
        ...n,
        selected: n.id === targetId
      }));
    } else if (action === "copy_mirror_snippet" && targetId) {
      const node = schemaState.nodes.find(n => n.id === targetId);
      const provider = (node?.data as any)?.provider;
      const isClerk = provider === 'clerk';
      const mirrorName = isClerk ? 'clerkUsers' : 'workosUsers';
      const snippet = isClerk
        ? `// Recommended D1 Webhook User Mirror\nexport const clerkUsers = sqliteTable("clerkUsers", {\n  id: text("id").primaryKey(),\n  clerkUserId: text("clerk_user_id").notNull().unique(),\n  email: text("email").notNull(),\n  firstName: text("first_name"),\n  lastName: text("last_name"),\n  imageUrl: text("image_url"),\n  createdAt: integer("created_at", { mode: "timestamp" }),\n  updatedAt: integer("updated_at", { mode: "timestamp" })\n});`
        : `// Recommended D1 WorkOS Users Mirror\nexport const workosUsers = sqliteTable("workosUsers", {\n  id: text("id").primaryKey(),\n  workosUserId: text("workos_user_id").notNull().unique(),\n  workosOrgId: text("workos_org_id"),\n  email: text("email").notNull(),\n  firstName: text("first_name"),\n  lastName: text("last_name"),\n  createdAt: integer("created_at", { mode: "timestamp" }),\n  updatedAt: integer("updated_at", { mode: "timestamp" })\n});`;
      navigator.clipboard.writeText(snippet);
      toast.success(`Copied ${mirrorName} Schema Snippet`, {
        description: "Paste into your schema file in VS Code or Cursor."
      });
    } else if (action === "open_blueprint_guide") {
      schemaState.openHelpTopic("identity-auth");
    } else if (action === "open_docs") {
      const provider = contextMenu.nodeData?.provider;
      const url = provider === 'clerk'
        ? "https://clerk.com/docs/integrations/webhooks/sync-data"
        : "https://workos.com/docs/events";
      PlatformService.openExternal(url);
    } else if ((action === "inspect_node" || action === "add_field") && targetId) {
      schemaState.activeInspectorNodeId = targetId;
      schemaState.nodes = schemaState.nodes.map(n => ({
        ...n,
        selected: n.id === targetId
      }));
    } else if (action === "open_in_editor" && targetId) {
      const node = schemaState.nodes.find(n => n.id === targetId);
      const targetFile = schemaState.getTargetFilePath(targetId) || schemaState.filePath;
      const line = (node?.data as any)?.line;
      if (targetFile) {
        PlatformService.openInEditor(targetFile, line);
      }
    } else if (action === "copy_drizzle_code" && targetId) {
      const snippet = schemaState.getTableDefinitionSnippet(targetId);
      if (snippet) {
        navigator.clipboard.writeText(snippet);
        toast.success(`Copied "${targetId}" Drizzle Schema`, {
          description: "Paste directly into your schema file."
        });
      }
    }
  }
</script>

<div class="w-full h-full bg-base-200/30 relative overflow-hidden">
  <SvelteFlow
    bind:nodes={schemaState.nodes}
    bind:edges={schemaState.edges}
    {nodeTypes}
    {edgeTypes}
    onreconnect={() => {}}
    {onnodedragstop}
    {onconnect}
    ondelete={({ nodes, edges }) => {
      if (schemaState.isSandboxMode) {
        for (const node of nodes) {
          schemaState.deleteTable(node.id);
        }
        for (const edge of edges) {
          schemaState.deleteRelation(edge.source, edge.target, edge.label);
        }
        return;
      }

      // In real disk mode, inform the user that domain code must be deleted intentionally in their editor
      if (nodes.length > 0) {
        toast.info("Delete Code in Your Editor", {
          description: "To prevent accidental code loss, delete the table declaration in your editor. Strata will update instantly."
        });
      }
    }}
    onnodecontextmenu={(e) => {
      e.event.preventDefault();
      handleNodeContextMenu(e.event, e.node);
    }}
    onpanecontextmenu={(e) => {
      e.event.preventDefault();
      handlePaneContextMenu(e.event);
    }}
    onpaneclick={() => {
      schemaState.activeInspectorNodeId = null;
    }}
    connectionMode={ConnectionMode.Loose}
    fitView
    fitViewOptions={{ padding: 0.5 }}
    initialViewport={{ x: 0, y: 0, zoom: 0.5 }}
    snapGrid={[15, 15]}
    colorMode="dark"
    minZoom={0.1}
    maxZoom={2}
    panOnScroll={true}
    zoomOnScroll={false}
    zoomOnPinch={true}
    panOnDrag={[1, 2]}
    zoomActivationKey="Control"
    onnodedrag={({ targetNode }) => {
      if (targetNode) {
        schemaState.activeCoordinates = { x: Math.round(targetNode.position.x), y: Math.round(targetNode.position.y) };
      }
    }}
    onselectionchange={({ nodes }: { nodes: any[] }) => {
      const selected = nodes.find(n => n.selected);
      if (selected) {
        schemaState.activeCoordinates = { x: Math.round(selected.position.x), y: Math.round(selected.position.y) };
      } else {
        schemaState.activeCoordinates = null;
      }
    }}
  >
    <Controls
      position="bottom-left"
      class="bg-base-100! border-base-300! shadow-lg! rounded-xl! overflow-hidden"
    />
    <Background bgColor="#282c34" patternColor="oklch(var(--bc) / 0.08)" gap={20} />
    <MiniMap
      position="bottom-right"
      class="bg-base-100! border-base-300! shadow-lg! rounded-xl!"
    />
  </SvelteFlow>

  {#if contextMenu.visible}
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      type={contextMenu.type}
      targetId={contextMenu.targetId}
      nodeType={contextMenu.nodeType}
      nodeData={contextMenu.nodeData}
      onClose={() => (contextMenu.visible = false)}
      onAction={handleContextMenuAction}
    />
  {/if}
</div>

<style>
  :global(.svelte-flow) {
    --bg-color: transparent;
    --text-color: var(--color-base-content, #fff);
    --node-border-radius: 12px;
    --node-box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  :global(.svelte-flow__controls button) {
    border-color: var(--color-base-300);
    fill: currentColor;
    transition-property: color, background-color, border-color;
    transition-duration: 150ms;
  }

  :global(.svelte-flow__controls button:hover) {
    background-color: var(--color-base-200);
  }

  :global(.svelte-flow__minimap) {
    border-color: var(--color-base-300);
    background-color: color-mix(in oklab, var(--color-base-100) 80%, transparent);
    backdrop-filter: blur(12px);
  }
</style>
