/**
 * platform.ts
 *
 * Summary: Platform Service Adapter Pattern. Isolates Tauri-specific filesystem and dialog APIs.
 * Expects: File paths or write content.
 * Output: Raw file text or Tauri shell trigger actions.
 */

export interface StructuredPlatformError extends Error {
	kind: 'file_not_found' | 'permission_denied' | 'file_locked' | 'io' | 'wrangler_config' | 'unknown';
	path?: string;
	raw?: any;
}

export function normalizePlatformError(err: unknown, contextPath?: string): StructuredPlatformError {
	if (err && typeof err === 'object' && (err as any).kind && (err as any).message && typeof (err as any).message === 'string' && (err as any).message !== '[object Object]') {
		return err as StructuredPlatformError;
	}

	let kind: StructuredPlatformError['kind'] = 'unknown';
	let rawMessage = '';
	let targetPath = contextPath;

	if (typeof err === 'string') {
		rawMessage = err;
	} else if (err && typeof err === 'object') {
		const obj = err as Record<string, any>;
		if (obj.type === 'FileNotFound' || 'FileNotFound' in obj) {
			kind = 'file_not_found';
			targetPath = obj.message || obj.FileNotFound || contextPath;
			rawMessage = `File not found: ${targetPath}`;
		} else if (obj.type === 'Io' || 'Io' in obj) {
			rawMessage = obj.message || obj.Io || '';
			if (/permission denied|access is denied/i.test(rawMessage)) {
				kind = 'permission_denied';
			} else if (/locked|used by another process|resource busy/i.test(rawMessage)) {
				kind = 'file_locked';
			} else if (/no such file|not found/i.test(rawMessage)) {
				kind = 'file_not_found';
			} else {
				kind = 'io';
			}
		} else if (obj.type === 'WranglerConfig' || 'WranglerConfig' in obj) {
			kind = 'wrangler_config';
			rawMessage = obj.message || obj.WranglerConfig || '';
		} else if ('message' in obj && typeof obj.message === 'string') {
			rawMessage = obj.message;
			if (/no such file|not found/i.test(rawMessage)) {
				kind = 'file_not_found';
			} else if (/permission denied/i.test(rawMessage)) {
				kind = 'permission_denied';
			}
		} else {
			try {
				rawMessage = JSON.stringify(obj);
			} catch {
				rawMessage = String(obj);
			}
		}
	} else {
		rawMessage = String(err);
	}

	// Craft human-friendly, guiding message based on kind
	let userMessage = rawMessage;
	const displayPath = targetPath ? targetPath.split(/[/\\]/).pop() || targetPath : '';

	if (kind === 'file_not_found') {
		userMessage = targetPath 
			? `Could not find schema file "${displayPath}" (${targetPath}). Verify the file exists and hasn't been moved or renamed.`
			: `The specified file could not be found.`;
	} else if (kind === 'permission_denied') {
		userMessage = targetPath
			? `Permission denied accessing "${displayPath}". Please verify read/write permissions or check if the file is write-protected.`
			: `Permission denied accessing file. Check read/write permissions.`;
	} else if (kind === 'file_locked') {
		userMessage = targetPath
			? `File "${displayPath}" is currently locked by another process or editor. Close conflicting programs and try again.`
			: `File is locked by another process or editor.`;
	} else if (kind === 'wrangler_config') {
		userMessage = `Wrangler config update failed: ${rawMessage}. You can manually configure this binding in your wrangler file.`;
	} else if (!rawMessage || rawMessage === '[object Object]') {
		userMessage = targetPath
			? `An unexpected I/O error occurred while accessing "${displayPath}".`
			: `An unexpected filesystem error occurred.`;
	}

	const error = new Error(userMessage) as StructuredPlatformError;
	error.kind = kind;
	error.path = targetPath;
	error.raw = err;
	return error;
}

export class PlatformService {
	static isTauri(): boolean {
		if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
			return true;
		}
		return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
	}

	static async readText(path: string): Promise<string> {
		if (!this.isTauri()) throw new Error("Tauri API unavailable in web browser");
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			return await invoke("read_schema_file", { path });
		} catch (err) {
			throw normalizePlatformError(err, path);
		}
	}

	static async writeText(path: string, content: string): Promise<void> {
		if (!this.isTauri()) throw new Error("Tauri API unavailable in web browser");
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			await invoke("write_schema_file", { path, content });
		} catch (err) {
			throw normalizePlatformError(err, path);
		}
	}

	static async mutateWranglerConfig(
		configPath: string,
		action: "add" | "remove",
		bindingType: "kv" | "do" | "r2",
		bindingName: string,
		extra: any = {}
	): Promise<void> {
		if (!this.isTauri()) throw new Error("Tauri API unavailable in web browser");
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			await invoke("mutate_wrangler_config", {
				configPath,
				action,
				bindingType,
				bindingName,
				extra
			});
		} catch (err) {
			throw normalizePlatformError(err, configPath);
		}
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

	static async selectDirectory(defaultPath?: string): Promise<string | null> {
		if (!this.isTauri()) return null;
		const { open } = await import("@tauri-apps/plugin-dialog");
		const selected = await open({
			multiple: false,
			directory: true,
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

	static async unwatchFile(): Promise<void> {
		if (!this.isTauri()) return;
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			await invoke("unwatch_file");
		} catch (err) {
			console.warn("[Strata] Failed to unwatch file:", err);
		}
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
				const targetUrl = url.startsWith("ms-windows-store:")
					? "https://apps.microsoft.com/"
					: url;
				window.open(targetUrl, "_blank", "noopener,noreferrer");
			}
			return;
		}
		try {
			const { openUrl } = await import("@tauri-apps/plugin-opener");
			await openUrl(url);
		} catch (err) {
			console.warn("[Strata] Failed to open external URL via plugin-opener, falling back to browser window:", url, err);
			if (typeof window !== "undefined") {
				const fallbackUrl = url.startsWith("ms-windows-store:")
					? "https://apps.microsoft.com/"
					: url;
				window.open(fallbackUrl, "_blank", "noopener,noreferrer");
			}
		}
	}

	static async openInEditor(filePath: string, line?: number): Promise<void> {
		if (!filePath) return;
		const targetUrl = `vscode://file/${filePath}${line ? `:${line}` : ''}`;
		await this.openExternal(targetUrl);
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
