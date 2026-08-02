import { test, expect } from './fixtures';

test.describe('Help Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Mock loading a schema file so the settings/help dropdown is rendered
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });
  });

  test('can open and close the help modal', async ({ page }) => {
    // 1. Initially, the modal should not be visible
    const modal = page.getByTestId('help-modal');
    await expect(modal).not.toBeVisible();

    // 2. Click the help button in the navbar dropdown
    const helpDropdown = page.getByRole('button', { name: 'Settings & Help' });
    await expect(helpDropdown).toBeVisible();
    await helpDropdown.click();

    const helpButton = page.getByRole('button', { name: 'Help & Shortcuts' });
    await expect(helpButton).toBeVisible();
    await helpButton.click();

    // 3. The modal should now be visible
    await expect(modal).toBeVisible();
    await expect(page.getByText('Developer Help Center')).toBeVisible();

    // 4. Click the "Acknowledge & Close" button to close
    const closeButton = page.getByText('Acknowledge & Close');
    await closeButton.click();

    // 5. Modal should be gone
    await expect(modal).not.toBeVisible();
  });
});
