import { test, expect } from './fixtures';

test.describe('Code Mirror Component', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Directly inject the state and wait for it to take effect
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.rawCode = 'export const users = sqliteTable("users", { id: integer("id") });';
      state.isValid = true;
      state.nodes = [{ id: 'users', type: 'table', position: { x: 0, y: 0 }, data: { label: 'users', columns: [] } }];
    });

    // 3. Wait for the toggle to appear in the UI
    await page.waitForSelector('[data-testid="code-mode-button"]');
  });

  test('should switch to code view and show schema mirror', async ({ page }) => {
    // 1. Click the "Code" toggle
    await page.getByTestId('code-mode-button').click();

    // 2. Verify CodeEditor toolbar elements
    await expect(page.getByText('Schema Mirror')).toBeVisible();
    // Scope search to main to avoid Navbar conflict
    await expect(page.locator('main').getByText('schema.ts')).toBeVisible();
    await expect(page.getByText('Read Only Mode')).toBeVisible();

    // 3. Verify CodeMirror content exists
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('export const users');
  });

  test('should update code mirror when diagram is modified', async ({ page }) => {
    // 1. Go to code view
    await page.getByTestId('code-mode-button').click();
    const editor = page.locator('.cm-content');
    await expect(editor).not.toContainText('posts');

    // 2. Switch back to diagram
    await page.getByTestId('diagram-mode-button').click();

    // 3. Update the state directly to simulate a successful re-parse/sync
    await page.evaluate(async () => {
      const state = (window as any).schemaState;
      state.rawCode = 'export const users = sqliteTable("users", { id: integer("id") });\nexport const posts = sqliteTable("posts", { id: integer("id") });';
      state.isValid = true;
    });

    // 4. Switch back to code and check for update
    await page.getByTestId('code-mode-button').click();
    await expect(editor).toContainText('export const posts');
  });

  test('should handle parsing errors gracefully', async ({ page }) => {
    // 1. Inject a syntax error state directly
    await page.evaluate(async () => {
      const state = (window as any).schemaState;
      state.isValid = false;
      state.error = 'Syntax Error: Unexpected token';
      state.errorLoc = { line: 1, column: 10 };
    });

    // 2. Go to code view
    await page.getByTestId('code-mode-button').click();

    // 3. Check for error indicators in the footer
    await expect(page.getByText('Parsing Error Detected')).toBeVisible();
    await expect(page.getByText('To edit this code, use your external IDE')).toBeVisible();
  });
});
