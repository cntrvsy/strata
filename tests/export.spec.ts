import { test, expect } from './fixtures';

test.describe('Diagram PNG Export', () => {
  test('should show the Export Successful toast when clicking export', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/');

    // 2. Directly inject a populated state and transition the state machine to IDLE
    await page.evaluate(async () => {
      while (!(window as any).schemaState) {
        await new Promise(r => setTimeout(r, 50));
      }
      const state = (window as any).schemaState;
      state.filePath = '/mock/schema.ts';
      state.rawCode = 'export const users = sqliteTable("users", { id: integer("id") });';
      state.isValid = true;
      state.nodes = [
        {
          id: 'users',
          type: 'table',
          position: { x: 100, y: 150 },
          data: { label: 'users', columns: [] }
        }
      ];
      // Properly transition state machine: EMPTY -> LOADING -> IDLE
      state.machine.send("OPEN");
      state.machine.send("SUCCESS");
    });

    // 3. Wait for the Export button to become visible and click it
    const exportBtn = page.getByRole('button', { name: 'Export', exact: true });
    await expect(exportBtn).toBeVisible({ timeout: 15000 });
    
    // 4. Click the export button
    await exportBtn.click();

    // 5. Verify the "Export Successful" toast is displayed
    const toast = page.getByText('Export Successful');
    await expect(toast).toBeVisible();
    await expect(page.getByText('Check your Downloads folder for the PNG')).toBeVisible();
  });
});
