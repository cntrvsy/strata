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
});
