import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from './state.svelte';

// Mock Tauri Plugins
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('SchemaState FSM & Reactivity', () => {
  beforeEach(() => {
    schemaState.reset();
    vi.clearAllMocks();
  });

  it('should initialize in EMPTY state', () => {
    expect(schemaState.machine.current).toBe('EMPTY');
  });

  it('should transition to IDLE after successful sync', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id") });');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('IDLE');
    expect(schemaState.nodes).toHaveLength(1);
    expect(schemaState.isValid).toBe(true);
  });

  it('should transition to ERROR state on parse failure', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('invalid code');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.isValid).toBe(false);
    expect(schemaState.error).toBeDefined();
  });

  it('should track DIRTY state when editing', () => {
    schemaState.machine.send("SYNC"); // Put in LOADING
    schemaState.machine.send("LOAD_SUCCESS"); // Put in IDLE
    
    schemaState.machine.send("EDIT");
    expect(schemaState.machine.current).toBe('DIRTY');
    expect(schemaState.hasUnsavedChanges).toBe(true);
  });

  it('should handle SAVE flow correctly', async () => {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    schemaState.filePath = '/mock/schema.ts';
    
    schemaState.machine.send("SYNC");
    schemaState.machine.send("LOAD_SUCCESS"); // IDLE
    schemaState.machine.send("EDIT"); // DIRTY
    
    // Setup mock for syncWithFile's subsequent read
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('export const someTable = sqliteTable("someTable", { id: integer("id") });');

    await schemaState.deleteTable('someTable'); // This calls SAVE internally
    
    expect(vi.mocked(writeTextFile)).toHaveBeenCalled();
  });

  it('should not duplicate nodes when syncing multiple times', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id") });');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    await schemaState.syncWithFile();
    
    expect(schemaState.nodes).toHaveLength(1);
  });
});
