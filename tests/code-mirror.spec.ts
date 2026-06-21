import { test, expect } from './fixtures';

test.describe('Code Mirror Component', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Directly inject the state and transition FSM to IDLE
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.rawCode = 'export const users = sqliteTable("users", { id: integer("id") });';
      state.isValid = true;
      state.nodes = [{ id: 'users', type: 'table', position: { x: 0, y: 0 }, data: { label: 'users', columns: [] } }];
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });

    // 3. Wait for the editor to render in the UI
    await page.waitForSelector('.cm-content');
  });

  test('should render code view and show schema mirror', async ({ page }) => {
    // 1. Verify CodeEditor toolbar elements
    await expect(page.getByText('Schema Mirror')).toBeVisible();
    await expect(page.locator('main').getByText('schema.ts')).toBeVisible();

    // 2. Verify CodeMirror content exists
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('export const users');
  });

  test('should update code mirror when diagram is modified', async ({ page }) => {
    const editor = page.locator('.cm-content');
    await expect(editor).not.toContainText('posts');

    // 1. Update the state directly to simulate a successful re-parse/sync
    await page.evaluate(async () => {
      const state = (window as any).schemaState;
      state.rawCode = 'export const users = sqliteTable("users", { id: integer("id") });\nexport const posts = sqliteTable("posts", { id: integer("id") });';
      state.isValid = true;
    });

    // 2. Check for update in CodeMirror content
    await expect(editor).toContainText('export const posts');
  });

  test('should handle parsing errors gracefully', async ({ page }) => {
    // 1. Inject a syntax error state directly and transition to ERROR
    await page.evaluate(async () => {
      const state = (window as any).schemaState;
      state.isValid = false;
      state.error = 'Syntax Error: Unexpected token';
      state.errorType = 'parse';
      state.machine.send("SYNC");
      state.machine.send("FAIL");
    });

    // 2. Check for error indicators in the global overlay
    await expect(page.getByText('Sync Paused: Parse Error')).toBeVisible();
    await expect(page.getByText('Syntax Error: Unexpected token')).toBeVisible();
  });
});
