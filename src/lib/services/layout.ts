import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/svelte';
import { schemaState } from '$lib/state.svelte';

const elk = new ELK();

/**
 * Computes an organized, overlap-free layout for schema tables using the ELK layered algorithm.
 * Adapts node heights and widths dynamically depending on table names, columns, and Compact Mode.
 */
export async function arrangeLayout(nodes: Node[], edges: Edge[]): Promise<Node[]> {
  if (nodes.length === 0) return [];

  const isCompact = schemaState.compactMode;
  const children = nodes.map(node => {
    const columns = (node.data?.columns as any[]) || [];
    const isExternal = node.data?.isExternal || false;
    
    // 1. Calculate estimated header width:
    // Base padding/icon/badge width is ~110px. If external, add another 40px for "External" badge.
    const headerBaseWidth = 110 + (isExternal ? 40 : 0);
    const headerTextWidth = node.id.length * 8.5; // Increased to 8.5px per character
    let maxEstimatedWidth = headerBaseWidth + headerTextWidth;

    // 2. Calculate estimated width for each column row:
    const columnsToDisplay = isCompact
      ? columns.filter((c: any) => c.isPk || c.isReferences)
      : columns;

    for (const col of columnsToDisplay) {
      const typeStr = (col.definition || '')
        .split('(')[0]
        .replace('text', 'txt')
        .replace('integer', 'int');
      
      const rowBaseWidth = 100; // Increased base row padding width buffer
      const nameWidth = (col.name?.length || 0) * 8.0; // Increased char width to 8.0px
      const typeWidth = typeStr.length * 6;
      const rowWidth = rowBaseWidth + nameWidth + typeWidth;
      
      if (rowWidth > maxEstimatedWidth) {
        maxEstimatedWidth = rowWidth;
      }
    }
    
    // Base width is 220px. Add a 20px general safety margin.
    const width = Math.max(220, Math.round(maxEstimatedWidth) + 20);

    // Header (approx 44px) + column padding + fields + collapse indicator
    const height = Math.max(100, 44 + columnsToDisplay.length * 38 + (isCompact ? 36 : 0));
    return {
      id: node.id,
      width,
      height
    };
  });

  const elkEdges = edges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target]
  }));

  const layout = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'org.eclipse.elk.separateConnectedComponents': 'true', // Pack disconnected components separately
      'elk.spacing.componentSpacing': '80', // Space between separate layout components
      'elk.spacing.nodeNode': '105', // Vertically space nodes in the same layer
      'elk.layered.spacing.nodeNodeBetweenLayers': '160', // Horizontally space nodes between layers
      'elk.padding': '[top=50,left=50,bottom=50,right=50]',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF' // High-quality alignment strategy
    },
    children,
    edges: elkEdges
  });

  return nodes.map(node => {
    const elkNode = layout.children?.find(n => n.id === node.id);
    if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
      return {
        ...node,
        position: { 
          x: Math.round(elkNode.x), 
          y: Math.round(elkNode.y) 
        }
      };
    }
    return node;
  });
}
