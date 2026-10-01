import { test, expect } from './fixtures';

test.describe('Modal Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('can open and close the Project Settings modal', async ({ page }) => {
    // 1. Transition state to IDLE with a mock file path so Project Settings is enabled
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });

    // 2. Open Settings & Help dropdown
    const helpDropdown = page.getByRole('button', { name: 'Settings & Help' });
    await expect(helpDropdown).toBeVisible();
    await helpDropdown.click();

    // 3. Click Project Settings button
    const settingsButton = page.getByRole('button', { name: 'Project Settings' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // 4. Modal should be visible
    const settingsModal = page.getByTestId('project-settings-modal');
    await expect(settingsModal).toBeVisible();

    // 5. Close modal by clicking the X button in its header
    await settingsModal.locator('button.btn-circle').click();

    // 6. Modal should be hidden
    await expect(settingsModal).not.toBeVisible();
  });

  test('can open and close the Help Modal', async ({ page }) => {
    // 1. Help Modal is accessible from the settings & help dropdown
    const helpDropdown = page.getByRole('button', { name: 'Settings & Help' });
    await expect(helpDropdown).toBeVisible();
    await helpDropdown.click();

    const helpButton = page.getByRole('button', { name: 'Help & Shortcuts' });
    await expect(helpButton).toBeVisible();
    await helpButton.click();

    const helpModal = page.getByTestId('help-modal');
    await expect(helpModal).toBeVisible();

    await page.getByText('Acknowledge & Close').click();
    await expect(helpModal).not.toBeVisible();
  });
});
