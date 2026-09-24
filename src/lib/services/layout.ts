/**
 * layout.ts
 *
 * Summary: Orchestrates the automatic layout algorithm of ERD nodes using elkjs.
 * Expects: Array of Svelte Flow nodes and edges.
 * Output: Positioned nodes with updated x/y coordinates.
 */
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/svelte';
import { schemaState } from '#lib/state';

const elk = new ELK();

/**
 * Computes an organized, overlap-free layout for schema tables using the ELK layered algorithm.
 * Adapts node heights and widths dynamically depending on table names, columns, and Compact Mode.
 */
export async function arrangeLayout<T extends Node>(nodes: T[], edges: Edge[]): Promise<T[]> {
  if (nodes.length === 0) return [];

  const isCompact = schemaState.compactMode;
  const children = nodes.map(node => {
    // 0. Prefer actual measured DOM dimensions if already rendered
    const measuredW = (node as any).measured?.width || (node as any).width;
    const measuredH = (node as any).measured?.height || (node as any).height;
    if (measuredW && measuredH && measuredW > 0 && measuredH > 0) {
      return {
        id: node.id,
        width: Math.round(measuredW),
        height: Math.round(measuredH)
      };
    }

    if (node.type === 'identity') {
      return {
        id: node.id,
        width: 270,
        height: 180
      };
    }

    if (node.type === 'do') {
      const methods = (node.data?.methods as any[]) || (node.data?.columns as any[]) || [];
      const hasPath = Boolean((node.data?.strata as any)?.path);
      const height = Math.max(140, 44 + 32 + 24 + Math.max(1, methods.length) * 32 + (hasPath ? 30 : 0) + 16);
      return {
        id: node.id,
        width: 270,
        height
      };
    }

    if (node.type === 'kv') {
      const patterns = (node.data?.patterns as any[]) || (node.data?.columns as any[]) || [];
      const height = Math.max(130, 44 + 24 + Math.max(1, patterns.length) * 32 + 30 + 16);
      return {
        id: node.id,
        width: 260,
        height
      };
    }

    if (node.type === 'r2') {
      const folders = (node.data?.folders as any[]) || (node.data?.columns as any[]) || [];
      const height = Math.max(130, 44 + 32 + 24 + Math.max(1, folders.length) * 32 + 30 + 16);
      return {
        id: node.id,
        width: 260,
        height
      };
    }

    const columns = (node.data?.columns as any[]) || [];
    const hasModuleBadge = Boolean(node.data?.moduleInfo && !(node.data?.moduleInfo as any)?.isRootFile);
    
    // 1. Calculate estimated header width:
    const headerBaseWidth = 110 + (hasModuleBadge ? 60 : 0);
    const headerTextWidth = node.id.length * 8.5;
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
      
      const rowBaseWidth = 100;
      const nameWidth = (col.name?.length || 0) * 8.0;
      const typeWidth = typeStr.length * 6;
      const rowWidth = rowBaseWidth + nameWidth + typeWidth;
      
      if (rowWidth > maxEstimatedWidth) {
        maxEstimatedWidth = rowWidth;
      }
    }
    
    const width = Math.max(220, Math.round(maxEstimatedWidth) + 20);
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
      'org.eclipse.elk.separateConnectedComponents': 'true',
      'elk.spacing.componentSpacing': '70',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.padding': '[top=50,left=50,bottom=50,right=50]',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.thoroughness': '7'
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
