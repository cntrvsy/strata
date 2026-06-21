import { describe, it, expect } from 'vitest';
import { arrangeLayout } from '$lib/services/layout';
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
});
