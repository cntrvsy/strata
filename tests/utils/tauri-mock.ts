
/**
 * Mocking utility for Tauri APIs in Playwright tests.
 * This script is intended to be injected via page.addInitScript().
 */
export function setupTauriMocks() {
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
        case 'watch_file':
          return null;
        default:
          return {};
      }
    }
  };

  // Mock individual plugins that the app might import dynamically
  // Since we can't easily intercept dynamic imports in all environments,
  // we provide global mocks that some plugins might check, or we mock the IPC layer.
  
  // Tauri 2.0 IPC
  (window as any).__TAURI_INTERNALS__ = {
    invoke: (window as any).__TAURI__.invoke,
    metadata: {
      package: { version: '0.1.0' },
      app: { name: 'strata' }
    }
  };

  // Mock specific plugin behaviors
  (window as any).__TAURI_PLUGIN_FS__ = {
    readTextFile: async (path: string) => {
      console.log('[MOCK TAURI FS] readTextFile:', path);
      if (vfs[path]) return vfs[path];
      throw new Error(`File not found: ${path}`);
    },
    writeTextFile: async (path: string, content: string) => {
      console.log('[MOCK TAURI FS] writeTextFile:', path);
      vfs[path] = content;
      // Trigger file-changed event
      if (listeners['file-changed']) {
        listeners['file-changed'].forEach(fn => fn({ payload: { path } }));
      }
      return null;
    }
  };

  (window as any).__TAURI_PLUGIN_DIALOG__ = {
    open: async (options: any) => {
      console.log('[MOCK TAURI DIALOG] open:', options);
      return '/mock/schema.ts';
    }
  };

  (window as any).__TAURI_EVENT__ = {
    listen: async (event: string, handler: Function) => {
      console.log('[MOCK TAURI EVENT] listen:', event);
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return () => {
        listeners[event] = listeners[event].filter(h => h !== handler);
      };
    }
  };
}
