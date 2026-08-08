/**
 * updateState.svelte.ts
 *
 * Summary: Reactive global state store using Svelte 5 Runes to manage application software update checks,
 * download progress, modal visibility, and app relaunch.
 */
import { PlatformService } from "$lib/services/platform";

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';

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

export class UpdateState {
	status = $state<UpdateStatus>('idle');
	showModal = $state(false);
	updateInfo = $state<UpdateInfo | null>(null);
	progress = $state<DownloadProgress>({ downloaded: 0, total: 0, percent: 0 });
	errorMessage = $state<string | null>(null);
	hasUnseenUpdate = $state(false);
	autoCheckOnStartup = $state(true);

	constructor() {
		// Listen for background update-available event from Rust backend
		if (typeof window !== "undefined") {
			PlatformService.listenEvent("update-available", (event: any) => {
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
		this.progress = { downloaded: 0, total: 0, percent: 0 };

		try {
			const result = await PlatformService.checkForUpdate();
			if (!result) {
				// Running in web browser or mock environment
				this.status = 'up-to-date';
				this.updateInfo = null;
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
		if (!this.updateInfo) return;
		this.status = 'downloading';
		this.errorMessage = null;
		this.progress = { downloaded: 0, total: 0, percent: 0 };

		try {
			await PlatformService.downloadAndInstallUpdate(
				this.updateInfo.rawUpdate,
				(downloaded, total) => {
					const totalBytes = total || 1;
					const pct = Math.min(100, Math.round((downloaded / totalBytes) * 100));
					this.progress = {
						downloaded,
						total: totalBytes,
						percent: pct,
					};
				}
			);
			this.status = 'ready';
		} catch (err: any) {
			this.status = 'error';
			this.errorMessage = err?.message || "Failed to download update.";
		}
	}

	async relaunch() {
		await PlatformService.relaunchApp();
	}

	reset() {
		this.status = 'idle';
		this.updateInfo = null;
		this.errorMessage = null;
		this.progress = { downloaded: 0, total: 0, percent: 0 };
	}
}

export const updateState = new UpdateState();
