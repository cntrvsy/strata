
import { test as base, expect } from '@playwright/test';

/**
 * Custom Playwright fixture that injects Tauri mocks into the page.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject Tauri mocks before each test
    await page.addInitScript(() => {
      const vfs: Record<string, string> = {
        '/mock/schema.ts': `
          import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
          export const users = sqliteTable("users", {
            id: integer("id").primaryKey(),
            name: text("name"),
          });
        `
      };

      const listeners: Record<string, Function[]> = {};

      (window as any).__TAURI__ = {
        invoke: async (cmd: string, args: any) => {
          console.log('[MOCK TAURI] invoke:', cmd, args);
          switch (cmd) {
            case 'watch_file': return null;
            default: return {};
          }
        }
      };

      (window as any).__TAURI_INTERNALS__ = {
        invoke: (window as any).__TAURI__.invoke,
        metadata: { package: { version: '0.1.0' }, app: { name: 'strata' } }
      };

      (window as any).__TAURI_PLUGIN_FS__ = {
        readTextFile: async (path: string) => {
          if (vfs[path]) return vfs[path];
          throw new Error(`File not found: ${path}`);
        },
        writeTextFile: async (path: string, content: string) => {
          vfs[path] = content;
          if (listeners['file-changed']) {
            listeners['file-changed'].forEach(fn => fn({ payload: { path } }));
          }
          return null;
        }
      };

      (window as any).__TAURI_PLUGIN_DIALOG__ = {
        open: async () => '/mock/schema.ts'
      };

      (window as any).__TAURI_EVENT__ = {
        listen: async (event: string, handler: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
          return () => {
            listeners[event] = listeners[event].filter(h => h !== handler);
          };
        }
      };
    });

    await use(page);
  },
});

export { expect };
