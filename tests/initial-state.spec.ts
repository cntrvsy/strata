import { test, expect } from './fixtures';

test.describe('Initial State & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows empty state when no file is loaded', async ({ page }) => {
    // 1. Check for the "Ready?" heading in the overlay
    await expect(page.getByRole('heading', { name: /ready/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Drag & drop your Drizzle')).toBeVisible();

    // 2. Export button should NOT be visible when nodes are empty
    const exportButton = page.getByRole('button', { name: 'Export' });
    await expect(exportButton).not.toBeVisible();
    
    // 3. New Table button should NOT be visible when no file path is set
    const newTableButton = page.getByRole('button', { name: 'New Table' });
    await expect(newTableButton).not.toBeVisible();
  });

  test('navbar reflects empty state', async ({ page }) => {
    await expect(page.getByTestId('titlebar').getByText('No Schema')).toBeVisible();
  });
});
