import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformService } from '#lib/services/platform';

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

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(async () => {}),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(async () => null),
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
    (PlatformService as any).cachedChannel = null;
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

  it('should handle dialog cancellation (returning null)', async () => {
    const dialog = await import('@tauri-apps/plugin-dialog');
    vi.mocked(dialog.open).mockResolvedValueOnce(null as any);
    const path = await PlatformService.selectFile(['ts']);
    expect(path).toBeNull();
  });

  it('should recover gracefully when watch_file invoke fails', async () => {
    const core = await import('@tauri-apps/api/core');
    vi.mocked(core.invoke).mockRejectedValueOnce(new Error('Watcher backend failed'));

    const cb = vi.fn();
    const unlisten = await PlatformService.watchFile('/tmp/schema.ts', cb);
    expect(typeof unlisten).toBe('function');
  });

  it('should calculate download progress correctly across Started, Progress, Finished events', async () => {
    const onProgress = vi.fn();
    const mockRawUpdate = {
      downloadAndInstall: vi.fn(async (cb: (event: any) => void) => {
        cb({ event: 'Started', data: { contentLength: 1000 } });
        cb({ event: 'Progress', data: { chunkLength: 400 } });
        cb({ event: 'Progress', data: { chunkLength: 600 } });
        cb({ event: 'Finished' });
      })
    };

    await PlatformService.downloadAndInstallUpdate(mockRawUpdate, onProgress);
    expect(onProgress).toHaveBeenCalledWith(0, 1000);
    expect(onProgress).toHaveBeenCalledWith(400);
    expect(onProgress).toHaveBeenCalledWith(1000);
  });

  it('should query getDistributionChannel and cache result', async () => {
    const core = await import('@tauri-apps/api/core');
    vi.mocked(core.invoke).mockResolvedValueOnce('store');

    const channel1 = await PlatformService.getDistributionChannel();
    expect(channel1).toBe('store');
    expect(await PlatformService.isStore()).toBe(true);

    // Second call should return cached value without invoking core again
    const channel2 = await PlatformService.getDistributionChannel();
    expect(channel2).toBe('store');
    expect(core.invoke).toHaveBeenCalledWith('get_distribution_channel');
  });

  it('should open external URL via plugin-opener', async () => {
    const opener = await import('@tauri-apps/plugin-opener');
    await PlatformService.openExternal('ms-windows-store://updates');
    expect(opener.openUrl).toHaveBeenCalledWith('ms-windows-store://updates');
  });

  it('should return isStore in checkForUpdate when running in store environment', async () => {
    vi.spyOn(PlatformService, 'isStore').mockResolvedValueOnce(true);
    const result = await PlatformService.checkForUpdate();
    expect(result).toEqual({ available: false, isStore: true });
  });

  it('should block downloadAndInstallUpdate when running in store environment', async () => {
    vi.spyOn(PlatformService, 'isStore').mockResolvedValueOnce(true);
    const mockUpdate = { downloadAndInstall: vi.fn() };
    await PlatformService.downloadAndInstallUpdate(mockUpdate);
    expect(mockUpdate.downloadAndInstall).not.toHaveBeenCalled();
  });

  describe('Non-Tauri Browser Fallback Behavior', () => {
    beforeEach(() => {
      vi.spyOn(PlatformService, 'isTauri').mockReturnValue(false);
    });

    it('should throw error when calling readText or writeText in web browser', async () => {
      await expect(PlatformService.readText('/tmp/schema.ts')).rejects.toThrow('Tauri API unavailable in web browser');
      await expect(PlatformService.writeText('/tmp/schema.ts', 'code')).rejects.toThrow('Tauri API unavailable in web browser');
      await expect(PlatformService.mutateWranglerConfig('/tmp/wrangler.toml', 'add', 'kv', 'MY_KV')).rejects.toThrow('Tauri API unavailable in web browser');
    });

    it('should return null or no-op functions for window/file operations in web browser', async () => {
      expect(await PlatformService.selectFile(['ts'])).toBeNull();
      expect(await PlatformService.checkForUpdate()).toBeNull();

      const unlistenWatch = await PlatformService.watchFile('/tmp/schema.ts', () => {});
      expect(typeof unlistenWatch).toBe('function');

      const unlistenEvent = await PlatformService.listenEvent('test', () => {});
      expect(typeof unlistenEvent).toBe('function');

      await expect(PlatformService.minimizeWindow()).resolves.toBeUndefined();
      await expect(PlatformService.toggleMaximizeWindow()).resolves.toBeUndefined();
      await expect(PlatformService.closeWindow()).resolves.toBeUndefined();
      await expect(PlatformService.relaunchApp()).resolves.toBeUndefined();
      await expect(PlatformService.downloadAndInstallUpdate({}, () => {})).resolves.toBeUndefined();
    });
  });
});
