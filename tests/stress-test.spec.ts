
import { test, expect } from './fixtures';

test.describe('Performance Stress Test', () => {
  test('should remain responsive with 100 tables', async ({ page }) => {
    await page.goto('/');

    // 1. Wait for schemaState and generate 100 nodes and edges
    await page.waitForFunction(() => (window as any).schemaState);
    await page.evaluate(() => {
      const state = (window as any).schemaState;
      if (!state) return;

      const nodes = [];
      const edges = [];
      const tableCount = 100;

      for (let i = 0; i < tableCount; i++) {
        const id = `table_${i}`;
        nodes.push({
          id,
          type: 'table',
          position: { 
            x: (i % 10) * 300, 
            y: Math.floor(i / 10) * 400 
          },
          data: {
            label: id,
            target: 'd1',
            columns: [
              { name: 'id', definition: 'integer("id").primaryKey()', isPk: true },
              { name: 'name', definition: 'text("name")' },
              { name: 'created_at', definition: 'integer("created_at")' },
              { name: 'updated_at', definition: 'integer("updated_at")' },
            ]
          }
        });

        if (i > 0) {
          edges.push({
            id: `e-table_${i-1}-table_${i}`,
            source: `table_${i-1}`,
            target: `table_${i}`,
            type: 'relation'
          });
        }
      }

      state.nodes = nodes;
      state.edges = edges;
      state.filePath = '/mock/large_schema.ts';
      state.machine.send("OPEN");
      state.machine.send("LOAD_SUCCESS");
    });

    // 2. Check if all nodes are rendered
    const nodes = page.getByTestId('table-node');
    // We expect some to be in the DOM (Svelte Flow might virtualize or just render all)
    // Actually xyflow/svelte usually renders all unless configured otherwise
    // Let's check for a few specific ones
    await expect(page.getByText('table_0')).toBeVisible();
    await expect(page.getByText('table_99')).toBeVisible();

    // 3. Measure interaction (e.g. double clicking a node)
    const startTime = Date.now();
    await page.getByText('table_50').dblclick();
    const endTime = Date.now();

    console.log(`Click interaction took ${endTime - startTime}ms`);
    expect(endTime - startTime).toBeLessThan(500); // Loosened for CI runners

    // 4. Check if Inspector opened
    await expect(page.getByTestId('inspector-panel')).toBeVisible();
    await expect(page.getByText('table_50').nth(1)).toBeVisible(); // One in canvas, one in inspector
  });
});
