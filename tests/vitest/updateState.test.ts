import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateState, UpdateState } from '#lib/state/updateState.svelte';
import { PlatformService } from '#lib/services/platform';

vi.mock('#lib/services/platform', () => ({
	PlatformService: {
		isTauri: vi.fn(() => true),
		listenEvent: vi.fn(async (event: string, cb: any) => () => {}),
		checkForUpdate: vi.fn(),
		downloadAndInstallUpdate: vi.fn(),
		relaunchApp: vi.fn(),
	}
}));

describe('UpdateState Unit Tests', () => {
	let store: UpdateState;

	beforeEach(() => {
		vi.clearAllMocks();
		store = new UpdateState();
	});

	it('should initialize with default idle state', () => {
		expect(store.status).toBe('idle');
		expect(store.showModal).toBe(false);
		expect(store.updateInfo).toBeNull();
		expect(store.errorMessage).toBeNull();
		expect(store.hasUnseenUpdate).toBe(false);
	});

	it('should open and close modal and trigger check when idle', async () => {
		vi.mocked(PlatformService.checkForUpdate).mockResolvedValueOnce({ available: false });

		store.openModal();
		expect(store.showModal).toBe(true);
		expect(store.hasUnseenUpdate).toBe(false);
		expect(PlatformService.checkForUpdate).toHaveBeenCalledTimes(1);

		store.closeModal();
		expect(store.showModal).toBe(false);
	});

	it('should set status to up-to-date when no update is available', async () => {
		vi.mocked(PlatformService.checkForUpdate).mockResolvedValueOnce({ available: false });

		await store.check();

		expect(store.status).toBe('up-to-date');
		expect(store.updateInfo).toBeNull();
		expect(store.hasUnseenUpdate).toBe(false);
	});

	it('should set status to up-to-date when checkForUpdate returns null (e.g., non-Tauri web env)', async () => {
		vi.mocked(PlatformService.checkForUpdate).mockResolvedValueOnce(null as any);

		await store.check();

		expect(store.status).toBe('up-to-date');
		expect(store.updateInfo).toBeNull();
	});

	it('should set status to available when update is found', async () => {
		const mockUpdate = {
			available: true,
			version: 'v3.1.1',
			body: 'Bug fixes and performance improvements.',
			rawUpdate: { downloadAndInstall: vi.fn() }
		};
		vi.mocked(PlatformService.checkForUpdate).mockResolvedValueOnce(mockUpdate);

		await store.check();

		expect(store.status).toBe('available');
		expect(store.updateInfo?.version).toBe('v3.1.1');
		expect(store.updateInfo?.body).toBe('Bug fixes and performance improvements.');
		expect(store.hasUnseenUpdate).toBe(true);
	});

	it('should handle generic error when check fails', async () => {
		vi.mocked(PlatformService.checkForUpdate).mockRejectedValueOnce(new Error('Network offline'));

		await store.check();

		expect(store.status).toBe('error');
		expect(store.errorMessage).toBe('Network offline');
	});

	it('should map 404 errors to CrabNebula CDN message', async () => {
		vi.mocked(PlatformService.checkForUpdate).mockRejectedValueOnce(new Error('HTTP 404 Not Found'));

		await store.check();

		expect(store.status).toBe('error');
		expect(store.errorMessage).toBe(
			'No published update manifest found for this release version on CrabNebula CDN (404 Not Found).'
		);
	});

	it('should do nothing on downloadAndInstall if updateInfo is null', async () => {
		store.updateInfo = null;
		await store.downloadAndInstall();
		expect(store.status).toBe('idle');
		expect(PlatformService.downloadAndInstallUpdate).not.toHaveBeenCalled();
	});

	it('should download and install update with progress', async () => {
		store.updateInfo = {
			version: 'v3.1.1',
			rawUpdate: {}
		};

		vi.mocked(PlatformService.downloadAndInstallUpdate).mockImplementationOnce(async (raw, onProgress) => {
			onProgress?.(50, 100);
			onProgress?.(100, 100);
		});

		await store.downloadAndInstall();

		expect(store.status).toBe('ready');
		expect(store.progress.percent).toBe(100);
	});

	it('should handle error when downloadAndInstall fails', async () => {
		store.updateInfo = {
			version: 'v3.1.1',
			rawUpdate: {}
		};

		vi.mocked(PlatformService.downloadAndInstallUpdate).mockRejectedValueOnce(new Error('Download corrupt'));

		await store.downloadAndInstall();

		expect(store.status).toBe('error');
		expect(store.errorMessage).toBe('Download corrupt');
	});

	it('should invoke relaunchApp on relaunch()', async () => {
		await store.relaunch();
		expect(PlatformService.relaunchApp).toHaveBeenCalled();
	});

	it('should reset state on reset()', () => {
		store.status = 'available';
		store.updateInfo = { version: 'v3.1.1' };
		store.errorMessage = 'Some error';
		store.progress = { downloaded: 50, total: 100, percent: 50 };

		store.reset();

		expect(store.status).toBe('idle');
		expect(store.updateInfo).toBeNull();
		expect(store.errorMessage).toBeNull();
		expect(store.progress).toEqual({ downloaded: 0, total: 0, percent: 0 });
	});

	it('should handle background update-available listener events', () => {
		let eventCallback: any;
		vi.mocked(PlatformService.listenEvent).mockImplementationOnce(async (event, cb) => {
			if (event === 'update-available') {
				eventCallback = cb;
			}
			return () => {};
		});

		const newStore = new UpdateState();
		expect(eventCallback).toBeDefined();

		eventCallback({ payload: { version: 'v3.2.0', body: 'New feature release' } });

		expect(newStore.status).toBe('available');
		expect(newStore.updateInfo?.version).toBe('v3.2.0');
		expect(newStore.hasUnseenUpdate).toBe(true);
	});
});
