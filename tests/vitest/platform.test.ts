import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformService } from '$lib/services/platform';

// Mock Tauri modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args: any) => {
    if (cmd === 'read_schema_file') return 'export const test = sqliteTable("test", {});';
    if (cmd === 'write_schema_file') return;
    if (cmd === 'mutate_wrangler_config') return;
    if (cmd === 'watch_file') return;
    return;
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, cb: any) => {
    cb({ payload: 'test' });
    return () => {}; // unlisten fn
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => '/path/to/schema.ts'),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: vi.fn(async () => {}),
    toggleMaximize: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  })),
}));

describe('PlatformService Adapter Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should identify environment via isTauri()', () => {
    expect(PlatformService.isTauri()).toBe(true);
  });

  it('should call readText and writeText via Tauri invoke', async () => {
    const text = await PlatformService.readText('/tmp/schema.ts');
    expect(text).toContain('sqliteTable');

    await expect(PlatformService.writeText('/tmp/schema.ts', 'code')).resolves.not.toThrow();
  });

  it('should call mutateWranglerConfig via Tauri invoke', async () => {
    await expect(
      PlatformService.mutateWranglerConfig('/tmp/wrangler.toml', 'add', 'kv', 'MY_KV')
    ).resolves.not.toThrow();
  });

  it('should call selectFile dialog picker', async () => {
    const path = await PlatformService.selectFile(['ts']);
    expect(path).toBe('/path/to/schema.ts');
  });

  it('should register file watcher and unlisten function', async () => {
    const cb = vi.fn();
    const unlisten = await PlatformService.watchFile('/tmp/schema.ts', cb);
    expect(typeof unlisten).toBe('function');
    unlisten();
  });

  it('should listen to custom Tauri window events', async () => {
    const cb = vi.fn();
    const unlisten = await PlatformService.listenEvent('schema-updated', cb);
    expect(cb).toHaveBeenCalled();
    expect(typeof unlisten).toBe('function');
  });

  it('should control native window state (minimize, maximize, close)', async () => {
    await expect(PlatformService.minimizeWindow()).resolves.not.toThrow();
    await expect(PlatformService.toggleMaximizeWindow()).resolves.not.toThrow();
    await expect(PlatformService.closeWindow()).resolves.not.toThrow();
  });
});
