/**
 * platform.ts
 * 
 * Platform Service Adapter Pattern.
 * Isolates Tauri-specific APIs to enable easier unit testing and headless environments.
 */

export class PlatformService {
	static async readText(path: string): Promise<string> {
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke("read_schema_file", { path });
	}

	static async writeText(path: string, content: string): Promise<void> {
		const { invoke } = await import("@tauri-apps/api/core");
		return invoke("write_schema_file", { path, content });
	}

	static async selectFile(extensions: string[]): Promise<string | null> {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const selected = await open({
			multiple: false,
			filters: [{ name: "TypeScript", extensions }],
		});
		return typeof selected === "string" ? selected : null;
	}

	static async watchFile(path: string, callback: () => void): Promise<() => void> {
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
		const { listen } = await import("@tauri-apps/api/event");
		return listen(eventName, callback);
	}

	static async minimizeWindow(): Promise<void> {
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().minimize();
	}

	static async toggleMaximizeWindow(): Promise<void> {
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().toggleMaximize();
	}

	static async closeWindow(): Promise<void> {
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().close();
	}
}
