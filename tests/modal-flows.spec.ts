import { test, expect } from './fixtures';

test.describe('Modal Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('can open and close the New Table modal', async ({ page }) => {
    // 1. New Table button is only visible when a file is open.
    // Since we start EMPTY, it shouldn't be there.
    const newTableButton = page.getByTestId('new-table-button');
    await expect(newTableButton).not.toBeVisible();

    // 2. We mock a file path and transition state to IDLE to see the button
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });

    // 3. The New Table button should now be visible
    await expect(newTableButton).toBeVisible();

    // 4. Click it to open the New Table Modal
    await newTableButton.click();

    // 5. The modal should be visible
    const newTableModal = page.getByTestId('new-table-modal');
    await expect(newTableModal).toBeVisible();

    // 6. Close the modal by clicking the X button in its header
    await newTableModal.locator('button.btn-circle').click();

    // 7. Modal should be hidden
    await expect(newTableModal).not.toBeVisible();
  });

  test('can open and close the Help Modal', async ({ page }) => {
    // 1. Help Modal is always accessible from the help button
    const helpButton = page.getByTestId('help-button');
    await expect(helpButton).toBeVisible();

    await helpButton.click();

    const helpModal = page.getByTestId('help-modal');
    await expect(helpModal).toBeVisible();

    await page.getByText('Acknowledge & Close').click();
    await expect(helpModal).not.toBeVisible();
  });
});
