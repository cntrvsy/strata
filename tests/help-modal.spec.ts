import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('can open and close the help modal', async ({ page }) => {
    // 1. Initially, the modal should not be visible
    const modal = page.getByTestId('help-modal');
    await expect(modal).not.toBeVisible();

    // 2. Click the help button in the navbar
    const helpButton = page.getByTestId('help-button');
    await helpButton.click();

    // 3. The modal should now be visible
    await expect(modal).toBeVisible();
    await expect(page.getByText('Strata Guide')).toBeVisible();

    // 4. Click the "Acknowledge & Close" button to close
    const closeButton = page.getByText('Acknowledge & Close');
    await closeButton.click();

    // 5. Modal should be gone
    await expect(modal).not.toBeVisible();
  });
});
