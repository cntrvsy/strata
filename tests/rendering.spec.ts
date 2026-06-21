import { test, expect } from './fixtures';

test.describe('Strata UI Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render the titlebar branding', async ({ page }) => {
    const brand = page.locator('[data-testid="titlebar"]').getByText('Strata', { exact: true });
    await expect(brand).toBeVisible();
  });

  test('should render the main canvas area after loading a file', async ({ page }) => {
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });

    const flowContainer = page.locator('.svelte-flow');
    await expect(flowContainer).toBeVisible();
  });

  test('should show the "Open Schema" button on start', async ({ page }) => {
    const openBtn = page.getByRole('button', { name: /open schema/i });
    await expect(openBtn).toBeVisible();
  });
});
