/**
 * platform.ts
 *
 * Summary: Platform Service Adapter Pattern. Isolates Tauri-specific filesystem and dialog APIs.
 * Expects: File paths or write content.
 * Output: Raw file text or Tauri shell trigger actions.
 */

export class PlatformService {
	static isTauri(): boolean {
		if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
			return true;
		}
		return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
	}

	static async readText(path: string): Promise<string> {
		if (!this.isTauri()) throw new Error("Tauri API unavailable in web browser");
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke("read_schema_file", { path });
	}

	static async writeText(path: string, content: string): Promise<void> {
		if (!this.isTauri()) throw new Error("Tauri API unavailable in web browser");
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke("write_schema_file", { path, content });
	}

	static async mutateWranglerConfig(
		configPath: string,
		action: "add" | "remove",
		bindingType: "kv" | "do" | "r2",
		bindingName: string,
		extra: any = {}
	): Promise<void> {
		if (!this.isTauri()) throw new Error("Tauri API unavailable in web browser");
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke("mutate_wrangler_config", {
			configPath,
			action,
			bindingType,
			bindingName,
			extra
		});
	}

	static async selectFile(extensions: string[], defaultPath?: string, filterName: string = "TypeScript"): Promise<string | null> {
		if (!this.isTauri()) return null;
		const { open } = await import("@tauri-apps/plugin-dialog");
		const selected = await open({
			multiple: false,
			filters: [{ name: filterName, extensions }],
			defaultPath
		});
		return typeof selected === "string" ? selected : null;
	}

	static async watchFile(path: string, callback: () => void): Promise<() => void> {
		if (!this.isTauri()) return () => {};
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			await invoke("watch_file", { path });
		} catch (err) {
			console.warn("[Strata] Watcher failed to init:", err);
		}

		const { listen } = await import("@tauri-apps/api/event");
		const unlisten = await listen("file-changed", () => {
			callback();
		});

		return unlisten;
	}

	static async listenEvent(eventName: string, callback: (event: any) => void): Promise<() => void> {
		if (!this.isTauri()) return () => {};
		const { listen } = await import("@tauri-apps/api/event");
		return listen(eventName, callback);
	}

	static async minimizeWindow(): Promise<void> {
		if (!this.isTauri()) return;
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().minimize();
	}

	static async toggleMaximizeWindow(): Promise<void> {
		if (!this.isTauri()) return;
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().toggleMaximize();
	}

	static async closeWindow(): Promise<void> {
		if (!this.isTauri()) return;
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().close();
	}

	private static cachedChannel: "store" | "standalone" | null = null;

	static async getDistributionChannel(): Promise<"store" | "standalone"> {
		if (this.cachedChannel) return this.cachedChannel;
		if (!this.isTauri()) {
			this.cachedChannel = "standalone";
			return "standalone";
		}
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const channel = await invoke<string>("get_distribution_channel");
			this.cachedChannel = channel === "store" ? "store" : "standalone";
			return this.cachedChannel;
		} catch (err) {
			console.warn("[Strata] Failed to get distribution channel:", err);
			this.cachedChannel = "standalone";
			return "standalone";
		}
	}

	static async isStore(): Promise<boolean> {
		return (await this.getDistributionChannel()) === "store";
	}

	static async openExternal(url: string): Promise<void> {
		if (!this.isTauri()) {
			if (typeof window !== "undefined") {
				window.open(url, "_blank");
			}
			return;
		}
		try {
			const { openUrl } = await import("@tauri-apps/plugin-opener");
			await openUrl(url);
		} catch (err) {
			console.warn("[Strata] Failed to open external URL:", url, err);
		}
	}

	static async checkForUpdate(): Promise<{
		available: boolean;
		isStore?: boolean;
		version?: string;
		body?: string;
		date?: string;
		rawUpdate?: any;
	} | null> {
		if (!this.isTauri()) return null;
		if (await this.isStore()) {
			return { available: false, isStore: true };
		}
		try {
			const { check } = await import("@tauri-apps/plugin-updater");
			const update = await check();
			if (!update) {
				return { available: false };
			}
			return {
				available: true,
				version: update.version,
				body: update.body,
				date: update.date,
				rawUpdate: update
			};
		} catch (err) {
			console.warn("[Strata] Updater check failed:", err);
			throw err;
		}
	}

	static async downloadAndInstallUpdate(
		rawUpdate: any,
		onProgress?: (downloaded: number, contentLength?: number) => void
	): Promise<void> {
		if (!this.isTauri() || !rawUpdate || (await this.isStore())) return;
		let downloadedBytes = 0;
		await rawUpdate.downloadAndInstall((event: any) => {
			if (event.event === "Started") {
				onProgress?.(0, event.data.contentLength);
			} else if (event.event === "Progress") {
				downloadedBytes += event.data.chunkLength;
				onProgress?.(downloadedBytes);
			} else if (event.event === "Finished") {
				onProgress?.(downloadedBytes);
			}
		});
	}

	static async relaunchApp(): Promise<void> {
		if (!this.isTauri()) return;
		try {
			const { relaunch } = await import("@tauri-apps/plugin-process");
			await relaunch();
		} catch (err) {
			console.error("[Strata] Relaunch failed:", err);
		}
	}
}
