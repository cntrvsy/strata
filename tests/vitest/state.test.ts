import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from '$lib/state';
import { invoke } from '@tauri-apps/api/core';

// Mock localStorage globally to prevent Node 22+ Experimental Warning/Error conflicts in jsdom
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


// Mock Tauri Plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('SchemaState FSM & Reactivity', () => {
  beforeEach(() => {
    schemaState.reset();
    schemaState.recentFiles = [];
    vi.resetAllMocks();
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  });

  // ==========================================
  // 1. General FSM & File Initialization
  // ==========================================

  it('should initialize in EMPTY state', () => {
    expect(schemaState.machine.current).toBe('EMPTY');
  });

  it('should track DIRTY state when editing', () => {
    schemaState.machine.send("SYNC"); // Put in BUSY
    schemaState.machine.send("SUCCESS"); // Put in IDLE
    
    schemaState.machine.send("EDIT");
    expect(schemaState.machine.current).toBe('DIRTY');
    expect(schemaState.hasUnsavedChanges).toBe(true);
  });

  it('should open a new file via dialog', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(open).mockResolvedValue('/new/path.ts');
    
    // Mock syncWithFile to avoid actual FS calls
    const syncSpy = vi.spyOn(schemaState, 'syncWithFile').mockResolvedValue(undefined);
    
    await schemaState.openNewFile();
    
    expect(schemaState.filePath).toBe('/new/path.ts');
    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  // ==========================================
  // 2. Syncing & General File Save Flows
  // ==========================================

  it('should transition to IDLE after successful sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id") });');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('IDLE');
    expect(schemaState.nodes).toHaveLength(1);
    expect(schemaState.isValid).toBe(true);
  });

  it('should transition to ERROR state on parse failure', async () => {
    vi.mocked(invoke).mockResolvedValue('invalid code');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.isValid).toBe(false);
    expect(schemaState.error).toBeDefined();
  });

  it('should handle SAVE flow correctly', async () => {
    schemaState.filePath = '/mock/schema.ts';
    
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS"); // IDLE
    schemaState.machine.send("EDIT"); // DIRTY
    
    // Setup mock for subsequent read and write
    vi.mocked(invoke).mockResolvedValue('export const someTable = sqliteTable("someTable", { id: integer("id") });');

    await schemaState.deleteTable('someTable'); // This calls SAVE internally
    
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
  });

  it('should not duplicate nodes when syncing multiple times', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id") });');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    await schemaState.syncWithFile();
    
    expect(schemaState.nodes).toHaveLength(1);
  });

  it('should handle sync failures gracefully', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Read error'));
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.error).toBe('Read error');
  });

  it('should call async_syncWithFile', async () => {
    const syncSpy = vi.spyOn(schemaState, 'syncWithFile').mockResolvedValue(undefined);
    await schemaState.async_syncWithFile();
    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  it('should set errorType to disk when saveToFile fails', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
      if (cmd === 'write_schema_file') {
        throw new Error('Write error');
      }
      return 'export const t = sqliteTable("t", { id: integer("id") });';
    });
    
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS"); // Transition to IDLE

    await schemaState.saveToFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.errorType).toBe('disk');
    expect(schemaState.error).toBe('Write error');
  });

  it('should set errorType to parse when sync fails to parse code', async () => {
    vi.mocked(invoke).mockResolvedValue('invalid code here');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.errorType).toBe('parse');
  });

  it('should track lastWriteTime and hasUnsavedChanges correctly', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", {});');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", {});';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS"); // Transition to IDLE

    expect(schemaState.hasUnsavedChanges).toBe(false);

    schemaState.machine.send("EDIT"); // Transition to DIRTY
    expect(schemaState.hasUnsavedChanges).toBe(true);

    const oldWriteTime = schemaState.lastWriteTime;
    await schemaState.saveToFile();

    expect(schemaState.lastWriteTime).toBeGreaterThanOrEqual(oldWriteTime);
    expect(schemaState.hasUnsavedChanges).toBe(false);
  });

  // ==========================================
  // 3. Mutation Operations (Inspector.svelte Actions)
  // ==========================================

  // --- Table Operations ---

  it('should add a table and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", {});\nexport const t2 = sqliteTable("t2", {});');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", {});';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.addTable('t2', 'd1');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should rename a table and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const customers = sqliteTable("customers", { id: integer("id") });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.activeInspectorNodeId = 't';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.renameTable('t', 'customers');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
    expect(schemaState.activeInspectorNodeId).toBe('customers');
  });

  it('should delete a table and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const another = sqliteTable("another", {});');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", {});\nexport const another = sqliteTable("another", {});';
    schemaState.activeInspectorNodeId = 't';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.deleteTable('t');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
    expect(schemaState.activeInspectorNodeId).toBeNull();
  });

  // --- Column Operations ---

  it('should add a column and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id"), name: text("name") });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.addColumn('t', 'name', 'text');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should rename a column and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", { new_id: integer("new_id") });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.renameColumn('t', 'id', 'new_id');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should update column modifiers and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id").primaryKey().notNull() });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.updateColumnModifiers('t', 'id', { isPk: true, notNull: true });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should delete a column and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", {});');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.deleteColumn('t', 'id');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  // --- Relationship / Connection Operations ---

  it('should add a relation and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", {});\nexport const t_relations = relations(t, ({ one }) => ({}));');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", {});';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.addRelation('t', 't2');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should delete a relation and sync', async () => {
    vi.mocked(invoke).mockResolvedValue('export const t = sqliteTable("t", {});');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", {});\nexport const t_relations = relations(t, ({ one }) => ({}));';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.deleteRelation('t', 't2');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
  });

  // ==========================================
  // 4. External Imports & Read-Only Tables
  // ==========================================

  it('should sync schema with external imports and load their contents asynchronously', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/mock/schema.ts') {
          return 'import { user } from "./auth.schema";\nexport const sessions = sqliteTable("sessions", { userId: integer("user_id").references(() => user.id) });';
        }
        if (args.path === '/mock/auth.schema.ts') {
          return 'export const user = sqliteTable("user", { id: text("id").primaryKey() });';
        }
      }
      return '';
    });

    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();

    expect(schemaState.nodes).toHaveLength(2);
    const userNode = schemaState.nodes.find(n => n.id === 'user');
    expect(userNode).toBeDefined();
    expect(userNode?.data.isExternal).toBe(true);
  });

  it('should persist external node positions to localStorage and not update schema file for them', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd, args: any) => {
      if (cmd === 'read_schema_file') {
        if (args.path === '/mock/schema.ts') {
          return 'import { user } from "./auth.schema";\nexport const sessions = sqliteTable("sessions", { userId: integer("user_id").references(() => user.id) });';
        }
        if (args.path === '/mock/auth.schema.ts') {
          return 'export const user = sqliteTable("user", { id: text("id").primaryKey() });';
        }
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

  // ==========================================
  // 5. Recent Files & Native Loading Experience
  // ==========================================

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

    // Remove DO binding
    const removedDo = mutateTomlConfig(mutated, 'remove', { type: 'do', name: 'MY_DO' });
    expect(removedDo).not.toContain('MY_DO');
    expect(removedDo).toContain('NEW_KV');
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

    // Remove KV namespace
    const removed = mutateJsonConfig(mutated, 'remove', { type: 'kv', name: 'EXISTING_KV' });
    const parsedRemove = JSON.parse(removed);
    expect(parsedRemove.kv_namespaces).toHaveLength(1);
    expect(parsedRemove.kv_namespaces[0].binding).toBe('NEW_KV');
  });

  it('should call PlatformService.writeText when mutate operations trigger syncToWranglerConfig', async () => {
    const tomlContent = `name = "project"`;
    const readSpy = vi.spyOn(PlatformService, 'readText').mockResolvedValue(tomlContent);
    const writeSpy = vi.spyOn(PlatformService, 'writeText').mockResolvedValue(undefined);

    schemaState.wranglerConfigFilePath = '/project/wrangler.toml';
    schemaState.filePath = '/project/schema.ts';

    // Mock active nodes so we can test rename/delete targets
    schemaState.nodes = [
      { id: 'my_kv', type: 'table', data: { label: 'my_kv', target: 'kv' }, position: { x: 0, y: 0 } }
    ];

    // Trigger table delete
    vi.mocked(invoke).mockResolvedValue('export const dummy = 1;'); // Schema mutation mock success
    await schemaState.deleteTable('my_kv');

    expect(readSpy).toHaveBeenCalledWith('/project/wrangler.toml');
    expect(writeSpy).toHaveBeenCalled();
    
    // Clean up spies
    readSpy.mockRestore();
    writeSpy.mockRestore();
  });
});

import { generateResolverCode } from '$lib/state/store.svelte';

describe('Resolver Code Generator', () => {
  it('should generate typed resolver helpers for KV and DO relation bindings', () => {
    const mockNodes = [
      {
        id: 'sessions',
        type: 'table',
        data: {
          label: 'sessions',
          target: 'd1',
          strata: {
            relations: [{ to: 'USERS_KV' }, { to: 'COUNTER_DO' }]
          }
        },
        position: { x: 0, y: 0 }
      },
      {
        id: 'USERS_KV',
        type: 'table',
        data: {
          label: 'USERS_KV',
          target: 'kv'
        },
        position: { x: 0, y: 0 }
      },
      {
        id: 'COUNTER_DO',
        type: 'table',
        data: {
          label: 'COUNTER_DO',
          target: 'do',
          columns: [
            { name: 'increment(by: number)', definition: 'Promise<number>' }
          ]
        },
        position: { x: 0, y: 0 }
      }
    ] as any[];

    const generated = generateResolverCode(mockNodes);
    expect(generated).toContain('export async function resolvesessionsToUSERS_KV');
    expect(generated).toContain('export function resolvesessionsToCOUNTER_DOStub');
    expect(generated).toContain('class COUNTER_DOClient');
    expect(generated).toContain('async increment(by: number): Promise<number>');
  });

  it('should execute saveToFile path resolution and clipboard writes on generateAndSaveResolvers call', async () => {
    const writeSpy = vi.spyOn(PlatformService, 'writeText').mockResolvedValue(undefined);
    
    // Mock navigator clipboard
    const clipMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: clipMock
      }
    });

    schemaState.filePath = '/project/db/schema.ts';
    schemaState.nodes = [
      {
        id: 'USERS_KV',
        type: 'table',
        data: { label: 'USERS_KV', target: 'kv' },
        position: { x: 0, y: 0 }
      }
    ] as any[];

    await schemaState.generateAndSaveResolvers();

    expect(writeSpy).toHaveBeenCalledWith('/project/db/resolvers.ts', expect.any(String));
    expect(clipMock).toHaveBeenCalled();

    writeSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('should call PlatformService.writeText when updateTableMetadata is invoked', async () => {
    const writeSpy = vi.spyOn(PlatformService, 'writeText').mockResolvedValue(undefined);

    schemaState.filePath = '/project/db/schema.ts';
    schemaState.nodes = [
      { id: 'images', type: 'table', data: { label: 'images', target: 'r2' }, position: { x: 0, y: 0 } }
    ];

    vi.mocked(invoke).mockResolvedValue('/** @strata { "target": "r2", "folders": {} } */\nexport const images = {};');
    await schemaState.updateTableMetadata('images', { public: true, customDomain: 'assets.io', cors: true });

    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});

