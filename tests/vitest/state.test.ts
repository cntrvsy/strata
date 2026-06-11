import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from '$lib/state.svelte';
import { invoke } from '@tauri-apps/api/core';

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
    vi.resetAllMocks();
  });

  it('should initialize in EMPTY state', () => {
    expect(schemaState.machine.current).toBe('EMPTY');
  });

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

  it('should track DIRTY state when editing', () => {
    schemaState.machine.send("SYNC"); // Put in BUSY
    schemaState.machine.send("SUCCESS"); // Put in IDLE
    
    schemaState.machine.send("EDIT");
    expect(schemaState.machine.current).toBe('DIRTY');
    expect(schemaState.hasUnsavedChanges).toBe(true);
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

  it('should handle sync failures gracefully', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Read error'));
    
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
    vi.mocked(invoke).mockResolvedValue('export const customers = sqliteTable("customers", { id: integer("id") });');
    schemaState.filePath = '/mock/schema.ts';
    schemaState.rawCode = 'export const t = sqliteTable("t", { id: integer("id") });';
    schemaState.machine.send("SYNC");
    schemaState.machine.send("SUCCESS");

    await schemaState.renameTable('t', 'customers');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_schema_file', expect.any(Object));
    expect(schemaState.machine.current).toBe('IDLE');
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

});
