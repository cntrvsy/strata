import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateState, UpdateState } from '$lib/state/updateState.svelte';
import { PlatformService } from '$lib/services/platform';

vi.mock('$lib/services/platform', () => ({
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

	it('should open and close modal', () => {
		store.openModal();
		expect(store.showModal).toBe(true);
		expect(store.hasUnseenUpdate).toBe(false);

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

	it('should set status to available when update is found', async () => {
		const mockUpdate = {
			available: true,
			version: 'v3.1.0',
			body: 'Bug fixes and performance improvements.',
			rawUpdate: { downloadAndInstall: vi.fn() }
		};
		vi.mocked(PlatformService.checkForUpdate).mockResolvedValueOnce(mockUpdate);

		await store.check();

		expect(store.status).toBe('available');
		expect(store.updateInfo?.version).toBe('v3.1.0');
		expect(store.updateInfo?.body).toBe('Bug fixes and performance improvements.');
		expect(store.hasUnseenUpdate).toBe(true);
	});

	it('should handle error when check fails', async () => {
		vi.mocked(PlatformService.checkForUpdate).mockRejectedValueOnce(new Error('Network offline'));

		await store.check();

		expect(store.status).toBe('error');
		expect(store.errorMessage).toBe('Network offline');
	});

	it('should download and install update with progress', async () => {
		store.updateInfo = {
			version: 'v3.1.0',
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

	it('should invoke relaunchApp on relaunch()', async () => {
		await store.relaunch();
		expect(PlatformService.relaunchApp).toHaveBeenCalled();
	});
});
