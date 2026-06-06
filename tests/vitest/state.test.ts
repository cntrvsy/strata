import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from '$lib/state.svelte';

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
    vi.resetAllMocks();
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

  it('should delete a column and sync', async () => {
    const { writeTextFile, readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('export const t = sqliteTable("t", {});');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("LOAD_SUCCESS");

    await schemaState.deleteColumn('t', 'id');
    expect(vi.mocked(writeTextFile)).toHaveBeenCalled();
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should handle sync failures gracefully', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockRejectedValue(new Error('Read error'));
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.error).toBe('Read error');
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

  it('should call async_syncWithFile', async () => {
    const syncSpy = vi.spyOn(schemaState, 'syncWithFile').mockResolvedValue(undefined);
    await schemaState.async_syncWithFile();
    expect(syncSpy).toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  it('should rename a table and sync', async () => {
    const { writeTextFile, readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('export const customers = sqliteTable("customers", { id: integer("id") });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("LOAD_SUCCESS");

    await schemaState.renameTable('t', 'customers');
    expect(vi.mocked(writeTextFile)).toHaveBeenCalled();
    expect(schemaState.machine.current).toBe('IDLE');
  });

  it('should set errorType to disk when saveToFile fails', async () => {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(writeTextFile).mockRejectedValue(new Error('Write error'));
    
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("LOAD_SUCCESS"); // Transition to IDLE

    await schemaState.saveToFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.errorType).toBe('disk');
    expect(schemaState.error).toBe('Write error');
  });

  it('should set errorType to parse when sync fails to parse code', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('invalid code here');
    
    schemaState.filePath = '/mock/schema.ts';
    await schemaState.syncWithFile();
    
    expect(schemaState.machine.current).toBe('ERROR');
    expect(schemaState.errorType).toBe('parse');
  });

  it('should update column modifiers and sync', async () => {
    const { writeTextFile, readTextFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(readTextFile).mockResolvedValue('export const t = sqliteTable("t", { id: integer("id").primaryKey().notNull() });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("LOAD_SUCCESS");

    await schemaState.updateColumnModifiers('t', 'id', { isPk: true, notNull: true });
    expect(vi.mocked(writeTextFile)).toHaveBeenCalled();
    expect(schemaState.machine.current).toBe('IDLE');
  });

});
