/**
 * updateState.svelte.ts
 *
 * Summary: Reactive global state store using Svelte 5 Runes to manage application software update checks,
 * download progress, stages (downloading, installing, ready), modal visibility, and app relaunch.
 */
import { PlatformService } from "#lib/services/platform";

export type UpdateStatus =
	| 'idle'
	| 'checking'
	| 'up-to-date'
	| 'store-managed'
	| 'available'
	| 'downloading'
	| 'installing'
	| 'ready'
	| 'error';

export interface UpdateInfo {
	version: string;
	body?: string;
	date?: string;
	rawUpdate?: any;
}

export interface DownloadProgress {
	downloaded: number;
	total: number;
	percent: number;
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export class UpdateState {
	status = $state<UpdateStatus>('idle');
	showModal = $state(false);
	updateInfo = $state<UpdateInfo | null>(null);
	errorMessage = $state<string | null>(null);
	hasUnseenUpdate = $state(false);
	autoCheckOnStartup = $state(true);
	isStore = $state(false);

	// Raw progress state
	downloadedBytes = $state(0);
	contentLength = $state<number | null>(null);

	// Svelte 5 Runes ($derived)
	percent = $derived.by(() => {
		if (!this.contentLength || this.contentLength <= 0) return null;
		return Math.min(100, Math.round((this.downloadedBytes / this.contentLength) * 100));
	});

	isIndeterminate = $derived(this.status === 'downloading' && this.percent === null);
	formattedDownloaded = $derived(formatBytes(this.downloadedBytes));
	formattedTotal = $derived(this.contentLength ? formatBytes(this.contentLength) : null);
	isBusy = $derived(this.status === 'checking' || this.status === 'downloading' || this.status === 'installing');

	// Backward-compatible progress getter & setter
	get progress(): DownloadProgress {
		return {
			downloaded: this.downloadedBytes,
			total: this.contentLength ?? 0,
			percent: this.percent ?? (this.status === 'ready' ? 100 : 0),
		};
	}
	set progress(val: DownloadProgress) {
		this.downloadedBytes = val.downloaded;
		this.contentLength = val.total;
	}

	constructor() {
		// Detect if running inside Microsoft Store package
		if (typeof window !== "undefined") {
			PlatformService.isStore().then((store) => {
				this.isStore = store;
			}).catch(() => {});

			// Listen for background update-available event from Rust backend (standalone only)
			PlatformService.listenEvent("update-available", (event: any) => {
				if (this.isStore) return;
				const data = event.payload || event;
				if (data && data.version) {
					this.updateInfo = {
						version: data.version,
						body: data.body,
						date: data.date,
					};
					this.status = 'available';
					this.hasUnseenUpdate = true;
				}
			});
		}
	}

	openModal() {
		this.showModal = true;
		this.hasUnseenUpdate = false;
		if (this.status === 'idle' || this.status === 'error') {
			this.check();
		}
	}

	closeModal() {
		this.showModal = false;
	}

	async check() {
		this.status = 'checking';
		this.errorMessage = null;
		this.downloadedBytes = 0;
		this.contentLength = null;

		try {
			const result = await PlatformService.checkForUpdate();
			if (!result) {
				// Running in web browser or mock environment
				this.status = 'up-to-date';
				this.updateInfo = null;
				return;
			}

			if (result.isStore) {
				this.isStore = true;
				this.status = 'store-managed';
				this.updateInfo = null;
				this.hasUnseenUpdate = false;
				return;
			}

			if (result.available && result.version) {
				this.updateInfo = {
					version: result.version,
					body: result.body,
					date: result.date,
					rawUpdate: result.rawUpdate,
				};
				this.status = 'available';
				this.hasUnseenUpdate = true;
			} else {
				this.status = 'up-to-date';
				this.updateInfo = null;
				this.hasUnseenUpdate = false;
			}
		} catch (err: any) {
			this.status = 'error';
			const rawMsg = err?.message || String(err);
			if (
				rawMsg.includes("404") ||
				rawMsg.toLowerCase().includes("not found") ||
				rawMsg.toLowerCase().includes("could not fetch") ||
				rawMsg.toLowerCase().includes("failed to parse")
			) {
				this.errorMessage = "No published update manifest found for this release version on CrabNebula CDN (404 Not Found).";
			} else {
				this.errorMessage = rawMsg || "Failed to connect to update server.";
			}
		}
	}

	async downloadAndInstall() {
		if (this.isStore || !this.updateInfo) return;
		this.status = 'downloading';
		this.errorMessage = null;
		this.downloadedBytes = 0;
		this.contentLength = null;

		try {
			let knownTotal: number | null = null;
			await PlatformService.downloadAndInstallUpdate(
				this.updateInfo.rawUpdate,
				(downloaded, total) => {
					this.downloadedBytes = downloaded;
					if (total !== undefined && total > 0) {
						knownTotal = total;
						this.contentLength = total;
					} else if (knownTotal !== null) {
						this.contentLength = knownTotal;
					}
				},
				(stage) => {
					this.status = stage;
				}
			);
			this.status = 'ready';
		} catch (err: any) {
			this.status = 'error';
			this.errorMessage = err?.message || "Failed to download update.";
		}
	}

	async openStore(url = "ms-windows-store://updates") {
		await PlatformService.openExternal(url);
	}

	async relaunch() {
		await PlatformService.relaunchApp();
	}

	reset() {
		this.status = 'idle';
		this.updateInfo = null;
		this.errorMessage = null;
		this.downloadedBytes = 0;
		this.contentLength = null;
	}
}

export const updateState = new UpdateState();
