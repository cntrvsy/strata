import { test, expect } from './fixtures';

test.describe('Inspector UI CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should perform full Inspector CRUD flow in Sandbox Mode', async ({ page }) => {
    // 1. Enter Sandbox Mode
    const sandboxButton = page.getByRole('button', { name: /Sandbox/i });
    if (await sandboxButton.isVisible()) {
      await sandboxButton.click();
    } else {
      // Fallback: trigger loadSandboxDemo directly on schemaState
      await page.evaluate(async () => {
        while (!(window as any).schemaState) {
          await new Promise(r => setTimeout(r, 50));
        }
        await (window as any).schemaState.loadSandboxDemo('fullstack');
      });
    }

    // Wait for nodes to load
    await page.waitForFunction(() => (window as any).schemaState?.nodes?.length > 0);

    // Select the first node to open Inspector
    await page.evaluate(() => {
      const state = (window as any).schemaState;
      if (state.nodes.length > 0) {
        state.activeInspectorNodeId = state.nodes[0].id;
      }
    });

    const inspector = page.getByTestId('inspector-panel');
    await expect(inspector).toBeVisible();

    const selectedId = await page.evaluate(() => (window as any).schemaState.activeInspectorNodeId);
    expect(selectedId).toBeTruthy();

    // 2. Add Field via AddFieldForm
    const addFieldBtn = page.getByTestId('add-field-button');
    await expect(addFieldBtn).toBeVisible();
    await addFieldBtn.click();

    const nameInput = page.locator('input[placeholder*="e.g. id"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('phone_number');

    const submitFieldBtn = page.getByRole('button', { name: /Create Field|Add Field/i });
    await submitFieldBtn.click();

    // Verify field appears in Inspector
    await expect(page.getByTestId('field-row-phone_number')).toBeVisible();

    // 3. Rename Field
    const renameFieldBtn = page.getByTestId('field-rename-btn-phone_number');
    await expect(renameFieldBtn).toBeVisible();
    await renameFieldBtn.click({ force: true });

    const renameFieldInput = page.getByTestId('field-rename-input-phone_number');
    await expect(renameFieldInput).toBeVisible();
    await renameFieldInput.fill('contact_phone');
    await page.getByTestId('field-rename-submit-phone_number').click();

    // Verify field renamed
    await expect(page.getByTestId('field-row-contact_phone')).toBeVisible();

    // 4. Delete Field
    const deleteFieldBtn = page.getByTestId('field-delete-btn-contact_phone');
    await deleteFieldBtn.click({ force: true });
    await expect(page.getByTestId('field-row-contact_phone')).not.toBeVisible();

    // 5. Rename Entity / Table
    const renameTableBtn = page.getByTestId('inspector-rename-table-btn');
    await renameTableBtn.click({ force: true });

    const renameTableInput = page.getByTestId('inspector-rename-table-input');
    await expect(renameTableInput).toBeVisible();
    await renameTableInput.fill(selectedId + '_renamed');
    await page.getByTestId('inspector-rename-table-submit').click();

    // Verify entity title updated
    const updatedTitle = selectedId + '_renamed';
    await expect(page.getByTestId('inspector-title')).toHaveText(updatedTitle);

    // 6. Delete Entity / Table
    const deleteEntityBtn = page.getByTestId('delete-entity-button');
    await deleteEntityBtn.click();

    const confirmDeleteBtn = page.getByTestId('confirm-delete-entity-button');
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // Verify entity removed and Inspector dismissed
    await expect(inspector).not.toBeVisible();
  });

  test('should perform Inspector CRUD operations in File Mode', async ({ page }) => {
    // 1. Initialize file mode with mock schema from fixtures
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      await state.openFileDirectly('/mock/schema.ts');
      state.activeInspectorNodeId = 'users';
    });

    const inspector = page.getByTestId('inspector-panel');
    await expect(inspector).toBeVisible();

    // Check existing field row
    await expect(page.getByTestId('field-row-id')).toBeVisible();

    // Add new column via form
    await page.getByTestId('add-field-button').click();
    const nameInput = page.locator('input[placeholder*="e.g. id"]');
    await nameInput.fill('bio');
    await page.getByRole('button', { name: /Create Field|Add Field/i }).click();

    // Verify field appears in Inspector
    await expect(page.getByTestId('field-row-bio')).toBeVisible();
  });
});
