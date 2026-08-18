import { describe, it, expect } from 'vitest';
import { arrangeLayout } from '$lib/services/layout';
import { schemaState } from '$lib/state';
import type { Node, Edge } from '@xyflow/svelte';

describe('Layout Service', () => {
  it('should return empty array when nodes are empty', async () => {
    const result = await arrangeLayout([], []);
    expect(result).toEqual([]);
  });

  it('should arrange nodes and update their coordinates', async () => {
    const nodes: Node[] = [
      { id: 'users', type: 'table', data: { label: 'users', columns: [] }, position: { x: 0, y: 0 } },
      { id: 'posts', type: 'table', data: { label: 'posts', columns: [] }, position: { x: 0, y: 0 } }
    ];
    const edges: Edge[] = [
      { id: 'e-posts-users', source: 'posts', target: 'users' }
    ];

    const result = await arrangeLayout(nodes, edges);

    expect(result).toHaveLength(2);
    const usersNode = result.find(n => n.id === 'users');
    const postsNode = result.find(n => n.id === 'posts');

    expect(usersNode?.position.x).toBeDefined();
    expect(usersNode?.position.y).toBeDefined();
    expect(postsNode?.position.x).toBeDefined();
    expect(postsNode?.position.y).toBeDefined();
  });

  it('should calculate dimensions accurately for compact mode and external nodes with columns', async () => {
    schemaState.compactMode = true;
    const nodes: Node[] = [
      {
        id: 'very_long_table_name_external_node',
        type: 'table',
        data: {
          label: 'very_long_table_name_external_node',
          isExternal: true,
          columns: [
            { name: 'id', definition: 'integer().primaryKey()', isPk: true, isReferences: false },
            { name: 'bio', definition: 'text()', isPk: false, isReferences: false },
            { name: 'author_id', definition: 'integer().references(() => users.id)', isPk: false, isReferences: true }
          ]
        },
        position: { x: 0, y: 0 }
      }
    ];

    const result = await arrangeLayout(nodes, []);
    expect(result).toHaveLength(1);
    schemaState.compactMode = false;
  });

  it('should handle cyclic relationship graphs without crashing', async () => {
    const nodes: Node[] = [
      { id: 'nodeA', type: 'table', data: { label: 'nodeA', columns: [] }, position: { x: 0, y: 0 } },
      { id: 'nodeB', type: 'table', data: { label: 'nodeB', columns: [] }, position: { x: 0, y: 0 } }
    ];
    const edges: Edge[] = [
      { id: 'e-a-b', source: 'nodeA', target: 'nodeB' },
      { id: 'e-b-a', source: 'nodeB', target: 'nodeA' }
    ];

    const result = await arrangeLayout(nodes, edges);
    expect(result).toHaveLength(2);
    expect(typeof result[0].position.x).toBe('number');
    expect(typeof result[0].position.y).toBe('number');
    expect(typeof result[1].position.x).toBe('number');
    expect(typeof result[1].position.y).toBe('number');
  });

  it('should handle disconnected subgraphs with multiple isolated node groups', async () => {
    const nodes: Node[] = [
      { id: 'group1_a', type: 'table', data: { label: 'group1_a', columns: [] }, position: { x: 0, y: 0 } },
      { id: 'group1_b', type: 'table', data: { label: 'group1_b', columns: [] }, position: { x: 0, y: 0 } },
      { id: 'isolated_node', type: 'table', data: { label: 'isolated_node', columns: [] }, position: { x: 0, y: 0 } }
    ];
    const edges: Edge[] = [
      { id: 'e-g1', source: 'group1_a', target: 'group1_b' }
    ];

    const result = await arrangeLayout(nodes, edges);
    expect(result).toHaveLength(3);
  });
});
