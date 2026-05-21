import { test, expect } from '@playwright/test';

test.describe('Strata UI Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should render the navbar branding', async ({ page }) => {
    const brand = page.locator('[data-testid="navbar"]').getByText('Strata', { exact: true });
    await expect(brand).toBeVisible();
  });

  test('should render the main canvas area', async ({ page }) => {
    // Svelte Flow usually has a container with this class
    const flowContainer = page.locator('.svelte-flow');
    await expect(flowContainer).toBeVisible();
  });

  test('should show the "Open Schema" button on start', async ({ page }) => {
    const openBtn = page.getByRole('button', { name: /open schema/i });
    await expect(openBtn).toBeVisible();
  });
});
