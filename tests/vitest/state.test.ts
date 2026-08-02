import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from '$lib/state';

// Mock localStorage globally
const mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { for (const k in mockStorage) delete mockStorage[k]; }),
    length: 0,
    key: vi.fn(() => null),
  },
  writable: true,
  configurable: true,
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('SchemaState FSM & Reactivity', () => {
  beforeEach(() => {
    schemaState.reset();
    vi.resetAllMocks();
    for (const key in mockStorage) delete mockStorage[key];
  });

  it('should initialize with default EMPTY state and empty structures', () => {
    expect(schemaState.machine.current).toBe('EMPTY');
    expect(schemaState.nodes).toEqual([]);
    expect(schemaState.edges).toEqual([]);
    expect(schemaState.filePath).toBeNull();
    expect(schemaState.isValid).toBe(true);
    expect(schemaState.error).toBeNull();
  });

  it('should update reactive properties and send state transitions', () => {
    schemaState.filePath = '/mock/path/schema.ts';
    expect(schemaState.filePath).toBe('/mock/path/schema.ts');

    schemaState.machine.send('OPEN');
    expect(schemaState.machine.current).toBe('BUSY');

    schemaState.machine.send('SUCCESS');
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should parse raw code and populate nodes/edges correctly', async () => {
    const rawDrizzle = `
      import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

      /** @strata { "target": "d1", "x": 100, "y": 100 } */
      export const users = sqliteTable("users", {
        id: integer("id").primaryKey(),
        name: text("name").notNull(),
      });

      /** @strata { "target": "d1", "x": 400, "y": 100 } */
      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        author_id: integer("author_id").references(() => users.id),
      });
    `;

    vi.mocked(invoke).mockResolvedValue(rawDrizzle);

    schemaState.filePath = '/mock/path/schema.ts';
    await schemaState.syncWithFile();

    expect(schemaState.nodes).toHaveLength(2);
    expect(schemaState.edges).toHaveLength(1);
    expect(schemaState.isValid).toBe(true);
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should handle sync failures gracefully', async () => {
    const readSpy = vi.spyOn(PlatformService, 'readText').mockImplementation(async () => {
      throw new Error('Read error');
    });

    schemaState.filePath = '/mock/path/schema.ts';
    schemaState.recentFiles = [];
    schemaState.rawCode = 'OLD_UNMATCHED_CODE';
    schemaState.machine.send('OPEN');
    await schemaState.syncWithFile();

    expect(schemaState.isValid).toBe(false);
    expect(schemaState.error).toBe('Read error');
    expect(schemaState.machine.current).toBe('ERROR');

    readSpy.mockRestore();
  });

  it('should set errorType to disk when saveToFile fails', async () => {
    schemaState.filePath = '/mock/path/schema.ts';
    schemaState.rawCode = 'export const users = sqliteTable("users", {});';
    schemaState.machine.send('OPEN');
    schemaState.machine.send('SUCCESS');

    const writeSpy = vi.spyOn(PlatformService, 'writeText').mockRejectedValue(new Error('Write error'));

    await schemaState.saveToFile();

    expect(schemaState.errorType).toBe('disk');
    expect(schemaState.machine.current).toBe('ERROR');

    writeSpy.mockRestore();
  });

  it('should track active inspector node selections', () => {
    schemaState.activeInspectorNodeId = 'users';
    expect(schemaState.activeInspectorNodeId).toBe('users');

    expect(schemaState.activeInspectorNode).toBeUndefined(); // No node exists yet with id 'users'

    schemaState.nodes = [
      { id: 'users', type: 'table', data: { label: 'users' }, position: { x: 0, y: 0 } }
    ];

    expect(schemaState.activeInspectorNode?.id).toBe('users');
  });

  it('should toggle ui view settings (compactMode)', () => {
    expect(schemaState.compactMode).toBe(false);
    schemaState.compactMode = true;
    expect(schemaState.compactMode).toBe(true);
  });

  it('should manage external node positions in localStorage independently of schema.ts', async () => {
    const rawDrizzle = `
      import { user } from "./external-auth";
      import { sqliteTable, integer } from "drizzle-orm/sqlite-core";

      export const posts = sqliteTable("posts", {
        id: integer("id").primaryKey(),
        author_id: integer("author_id").references(() => user.id)
      });
    `;

    const externalContent = `
      import { sqliteTable, text } from "drizzle-orm/sqlite-core";
      export const user = sqliteTable("user", { id: text("id").primaryKey() });
    `;

    // Mock file reads
    vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/mock/schema.ts') return rawDrizzle;
        if (args.path.endsWith('external-auth.ts')) return externalContent;
      }
      return '';
    });

    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();

    // Now update position of the external node
    schemaState.nodes = schemaState.nodes.map(n => {
      if (n.id === 'user') {
        return { ...n, position: { x: 500, y: 600 } };
      }
      return n;
    });

    // Save to file
    await schemaState.saveToFile();

    // Verify localStorage has the position saved
    const key = `strata_ext_pos_/mock/schema.ts_user`;
    expect(mockStorage[key]).toBe(JSON.stringify({ x: 500, y: 600 }));
  });

  it('should append a schema path to recent files list on successful sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", {});');
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();

    expect(schemaState.recentFiles).toContain('/mock/schema.ts');
    expect(mockStorage['strata_recent_files']).toBe(JSON.stringify(['/mock/schema.ts']));
  });

  it('should handle missing file read failure by removing it from recent files and resetting', async () => {
    mockStorage['strata_recent_files'] = JSON.stringify(['/mock/missing.ts']);

    vi.mocked(invoke).mockRejectedValue(new Error('Read error'));

    schemaState.filePath = '/mock/missing.ts';
    schemaState.recentFiles = ['/mock/missing.ts'];
    
    await schemaState.syncWithFile();

    expect(schemaState.recentFiles).not.toContain('/mock/missing.ts');
    expect(schemaState.filePath).toBeNull();
    expect(schemaState.machine.current).toBe('EMPTY');
  });

  it('should update project configuration via updateProjectConfig', async () => {
    const rawDrizzle = `
      /** @strata { "target": "project", "wranglerPath": "./wrangler.toml" } */
      import { sqliteTable } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {});
    `;
    vi.mocked(invoke).mockResolvedValue(rawDrizzle);
    schemaState.filePath = '/project/schema.ts';
    await schemaState.syncWithFile();

    vi.spyOn(PlatformService, 'writeText').mockResolvedValue(undefined);
    await schemaState.updateProjectConfig('./custom-wrangler.jsonc');
    expect(schemaState.wranglerPath).toBe('./custom-wrangler.jsonc');
  });
});

import { mutateTomlConfig, mutateJsonConfig } from '$lib/state/store.svelte';
import { PlatformService } from '$lib/services/platform';

describe('Wrangler Configuration Sync', () => {
  it('should correctly add/remove KV, R2, DO to TOML configuration', () => {
    const originalToml = `name = "my-worker"\n\n[[kv_namespaces]]\nbinding = "EXISTING_KV"\nid = "123"`;

    // Add KV namespace
    let mutated = mutateTomlConfig(originalToml, 'add', { type: 'kv', name: 'NEW_KV' });
    expect(mutated).toContain('binding = "NEW_KV"');
    expect(mutated).toContain('binding = "EXISTING_KV"');

    // Add R2 bucket
    mutated = mutateTomlConfig(mutated, 'add', { type: 'r2', name: 'MY_R2' });
    expect(mutated).toContain('[[r2_buckets]]');
    expect(mutated).toContain('bucket_name = "MY_R2"');

    // Add DO binding
    mutated = mutateTomlConfig(mutated, 'add', { type: 'do', name: 'MY_DO', extra: { class: 'MyDOClass' } });
    expect(mutated).toContain('[[durable_objects.bindings]]');
    expect(mutated).toContain('class_name = "MyDOClass"');

    // Add existing DO binding (should be idempotent)
    const idempotent = mutateTomlConfig(mutated, 'add', { type: 'do', name: 'MY_DO', extra: { class: 'MyDOClass' } });
    expect(idempotent).toBe(mutated);

    // Remove KV namespace
    const removedKv = mutateTomlConfig(mutated, 'remove', { type: 'kv', name: 'EXISTING_KV' });
    expect(removedKv).not.toContain('binding = "EXISTING_KV"');
    expect(removedKv).toContain('binding = "NEW_KV"');

    // Remove R2 bucket
    const removedR2 = mutateTomlConfig(mutated, 'remove', { type: 'r2', name: 'MY_R2' });
    expect(removedR2).not.toContain('MY_R2');

    // Remove DO binding
    const removedDo = mutateTomlConfig(mutated, 'remove', { type: 'do', name: 'MY_DO' });
    expect(removedDo).not.toContain('MY_DO');
  });

  it('should correctly add/remove KV, R2, DO to JSON configuration', () => {
    const originalJson = `{\n  "name": "my-worker",\n  "kv_namespaces": [\n    { "binding": "EXISTING_KV" }\n  ]\n}`;

    // Add KV namespace
    let mutated = mutateJsonConfig(originalJson, 'add', { type: 'kv', name: 'NEW_KV' });
    const parsedAdd = JSON.parse(mutated);
    expect(parsedAdd.kv_namespaces).toHaveLength(2);
    expect(parsedAdd.kv_namespaces[1].binding).toBe('NEW_KV');

    // Add R2 binding
    mutated = mutateJsonConfig(mutated, 'add', { type: 'r2', name: 'MY_R2' });
    const parsedR2 = JSON.parse(mutated);
    expect(parsedR2.r2_buckets).toHaveLength(1);
    expect(parsedR2.r2_buckets[0].binding).toBe('MY_R2');

    // Add DO binding
    mutated = mutateJsonConfig(mutated, 'add', { type: 'do', name: 'MY_DO', extra: { class: 'MyClass' } });
    const parsedDO = JSON.parse(mutated);
    expect(parsedDO.durable_objects.bindings[0].name).toBe('MY_DO');

    // Remove KV namespace
    const removedKv = mutateJsonConfig(mutated, 'remove', { type: 'kv', name: 'EXISTING_KV' });
    const parsedRemoveKv = JSON.parse(removedKv);
    expect(parsedRemoveKv.kv_namespaces).toHaveLength(1);

    // Remove R2 binding
    const removedR2 = mutateJsonConfig(mutated, 'remove', { type: 'r2', name: 'MY_R2' });
    const parsedRemoveR2 = JSON.parse(removedR2);
    expect(parsedRemoveR2.r2_buckets).toHaveLength(0);

    // Remove DO binding
    const removedDo = mutateJsonConfig(mutated, 'remove', { type: 'do', name: 'MY_DO' });
    const parsedRemoveDo = JSON.parse(removedDo);
    expect(parsedRemoveDo.durable_objects.bindings).toHaveLength(0);
  });

  it('should handle syncMissingWranglerBindings in sandbox and configured modes', async () => {
    await schemaState.loadSandboxDemo('fullstack');
    await schemaState.syncMissingWranglerBindings();

    schemaState.isSandboxMode = false;
    schemaState.wranglerConfigFilePath = null;
    await schemaState.syncMissingWranglerBindings();

    schemaState.wranglerConfigFilePath = '/project/wrangler.toml';
    schemaState.wranglerBindings = [];
    schemaState.nodes = [
      { id: 'MY_KV', type: 'table', data: { label: 'MY_KV', target: 'kv' }, position: { x: 0, y: 0 } }
    ];

    const mutateSpy = vi.spyOn(PlatformService, 'mutateWranglerConfig').mockResolvedValue(undefined);
    await schemaState.syncMissingWranglerBindings();
    expect(mutateSpy).toHaveBeenCalled();
    mutateSpy.mockRestore();
  });
});
