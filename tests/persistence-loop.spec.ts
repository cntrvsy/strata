import { test, expect } from './fixtures';

test.describe('Persistence Loop (Mocked Tauri)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show inspector and action buttons when a node is selected', async ({ page }) => {
    // 1. Wait for schemaState to be available and manually inject a node
    await page.waitForFunction(() => (window as any).schemaState);
    await page.evaluate(() => {
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.nodes = [{
        id: 'users',
        type: 'table',
        position: { x: 100, y: 100 },
        data: { label: 'users', target: 'd1', columns: [] },
        selected: true
      }];
      state.activeInspectorNodeId = 'users';
      state.machine.send("OPEN");
      state.machine.send("LOAD_SUCCESS");
    });

    // 2. The Inspector panel should now be visible
    const inspector = page.getByTestId('inspector-panel');
    await expect(inspector).toBeVisible();

    // 3. Action buttons should be present
    await expect(page.getByTestId('add-field-button')).toBeVisible();
    await expect(page.getByTestId('add-relation-button')).toBeVisible();
  });
});
