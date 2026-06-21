import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/svelte';
import { schemaState } from '$lib/state.svelte';

const elk = new ELK();

/**
 * Computes an organized, overlap-free layout for schema tables using the ELK layered algorithm.
 * Adapts node heights dynamically depending on Compact Mode.
 */
export async function arrangeLayout(nodes: Node[], edges: Edge[]): Promise<Node[]> {
  if (nodes.length === 0) return [];

  const isCompact = schemaState.compactMode;
  const children = nodes.map(node => {
    const columns = (node.data?.columns as any[]) || [];
    const colCount = isCompact 
      ? columns.filter(c => c.isPk || c.isReferences).length
      : columns.length;
    
    // Header (approx 44px) + column padding + fields + collapse indicator
    const height = Math.max(100, 44 + colCount * 38 + (isCompact ? 36 : 0));
    return {
      id: node.id,
      width: 240,
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
      'elk.spacing.nodeNode': '70',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]'
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
