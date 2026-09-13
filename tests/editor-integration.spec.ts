import { test, expect } from './fixtures';

test.describe('External Editor Integration & Schema Preview', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Inject schema state with open file and active table
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.rawCode = 'export const users = sqliteTable("users", { id: integer("id").primaryKey() });';
      state.isValid = true;
      state.nodes = [
        {
          id: 'users',
          type: 'table',
          position: { x: 100, y: 100 },
          data: {
            label: 'users',
            target: 'd1',
            columns: [{ name: 'id', definition: 'integer', isPk: true }]
          }
        }
      ];
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });

    // 3. Wait for navbar to render
    await page.waitForSelector('[data-testid="navbar"]');
  });

  test('should display active file badge and open-in-editor button in titlebar', async ({ page }) => {
    const titlebar = page.locator('[data-testid="titlebar"]');
    await expect(titlebar).toBeVisible();
    await expect(titlebar).toContainText('schema.ts');

    const editorBtn = page.locator('[data-testid="titlebar-quick-open-in-editor"]');
    await expect(editorBtn).toBeVisible();
  });

  test('should show contextual Drizzle snippet and open-in-editor button in inspector', async ({ page }) => {
    // Select the table node to open Inspector
    await page.evaluate(() => {
      const state = (window as any).schemaState;
      state.activeInspectorNodeId = 'users';
    });

    const inspector = page.locator('[data-testid="inspector-panel"]');
    await expect(inspector).toBeVisible();

    const openInEditorBtn = page.locator('[data-testid="inspector-open-in-editor"]');
    await expect(openInEditorBtn).toBeVisible();

    const copyBtn = page.locator('[data-testid="inspector-copy-snippet"]');
    await expect(copyBtn).toBeVisible();
    await expect(inspector).toContainText('sqliteTable("users"');
  });
});
