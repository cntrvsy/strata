import { type Node, type Edge } from '@xyflow/svelte';
import { FiniteStateMachine } from "runed";

/**
 * Valid states for the SchemaState machine.
 */
type States = "EMPTY" | "LOADING" | "IDLE" | "DIRTY" | "SAVING" | "ERROR";

/**
 * Valid events that trigger state transitions.
 */
type Events = 
	| "SYNC" 
	| "OPEN" 
	| "LOAD_SUCCESS" 
	| "LOAD_ERROR" 
	| "EDIT" 
	| "SAVE" 
	| "SAVE_SUCCESS" 
	| "SAVE_ERROR"
	| "RESET";

/**
 * Global application state for Strata Forge.
 * Manages schema synchronization, file persistence, and UI modes.
 */
class SchemaState {
	// --- Visual State ---
	/** The current set of Svelte Flow nodes (tables/entities) */
	nodes = $state.raw([] as Node[]);
	/** The current set of Svelte Flow edges (relationships) */
	edges = $state.raw([] as Edge[]);
	/** Whether the schema is currently valid (parsed successfully) */
	isValid = $state(true);
	/** Any error message from the last parse attempt */
	error = $state<string | null>(null);

	// --- File State ---
	/** Absolute path to the currently open schema.ts file */
	filePath = $state<string | null>(null);
	/** HTML-wrapped code preview of the schema.ts file */
	rawCode = $state('');
	
	// --- FSM State ---
	/** 
	 * Formalized Finite State Machine for Strata.
	 * Prevents "Impossible States" and ensures logical transitions.
	 */
	machine = new FiniteStateMachine<States, Events>(
		this.filePath ? "LOADING" : "EMPTY", 
		{
			EMPTY: {
				SYNC: "LOADING",
				OPEN: "LOADING",
				RESET: "EMPTY",
			},
			LOADING: {
				LOAD_SUCCESS: "IDLE",
				LOAD_ERROR: "ERROR",
				SYNC: "LOADING",
				RESET: "EMPTY",
			},
			IDLE: {
				EDIT: "DIRTY",
				SYNC: "LOADING",
				OPEN: "LOADING",
				RESET: "EMPTY",
				LOAD_SUCCESS: "IDLE",
				SAVE_SUCCESS: "IDLE",
			},
			DIRTY: {
				SAVE: "SAVING",
				SYNC: "LOADING",
				OPEN: "LOADING",
				EDIT: "DIRTY",
				RESET: "EMPTY",
			},
			SAVING: {
				SAVE_SUCCESS: "IDLE",
				SAVE_ERROR: "ERROR",
				SYNC: "LOADING",
				RESET: "EMPTY",
			},
			ERROR: {
				SYNC: "LOADING",
				OPEN: "LOADING",
				RESET: "EMPTY"
			}
		}
	);

	// --- Derived IO States (Legacy Support) ---
	/** True if a write operation to disk is currently in progress */
	get isSaving() { return this.machine.current === "SAVING"; }
	/** True if the diagram is currently being re-parsed or updated from disk */
	get isSyncing() { return this.machine.current === "LOADING"; }
	/** True if the user has moved nodes but hasn't saved the layout to disk (Ctrl+S) */
	get hasUnsavedChanges() { return this.machine.current === "DIRTY"; }
	
	/** True momentarily after a successful save operation */
	isRecentlySaved = $state(false);

	// --- UI State ---
	/** Active filter for storage target (d1, do, kv) */
	activeFilter = $state<'d1' | 'do' | 'kv' | null>(null);
	/** Whether the 'New Table' modal is currently visible */
	showNewTableModal = $state(false);

	/**
	 * Force-syncs the UI state with the current file on disk.
	 * This is the definitive "Ground Truth" sync that bypasses local HTML previews.
	 */
	async async_syncWithFile() {
		await this.syncWithFile();
	}

	async syncWithFile() {
		if (!this.filePath) return;
		
		this.machine.send("SYNC");
		this.error = null;
		
		try {
			// Dynamic imports to avoid SSR issues or circular dependencies
			const { readTextFile } = await import("@tauri-apps/plugin-fs");
			const { invoke } = await import("@tauri-apps/api/core");
			const { parseSchema, wrapCode } = await import("./parser");
			
			const raw = await readTextFile(this.filePath);
			const result = parseSchema(raw);
			
			if (result.success) {
				// Initialize/Reset the OS-level file watcher
				try {
					await invoke("watch_file", { path: this.filePath });
				} catch (err) {
					console.warn("[Strata] Watcher failed to init:", err);
				}

				// Preserve selection state
				const selectedNodeIds = new Set(this.nodes.filter(n => n.selected).map(n => n.id));
				
				this.nodes = result.nodes.map(n => ({
					...n,
					selected: selectedNodeIds.has(n.id)
				}));
				
				this.edges = result.edges;
				this.rawCode = raw;
				this.isValid = true;
				this.error = null;
				
				this.machine.send("LOAD_SUCCESS");
			} else {
				this.isValid = false;
				this.error = result.error || "Parse Error";
				this.machine.send("LOAD_ERROR");
			}
		} catch (e: any) {
			console.error("[Strata] Sync failed:", e);
			this.error = e.message;
			this.machine.send("LOAD_ERROR");
		}
	}

	/**
	 * Opens a native file dialog to select a Drizzle schema file and syncs it.
	 */
	async openNewFile() {
		try {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const selected = await open({
				multiple: false,
				filters: [{ name: "TypeScript", extensions: ["ts"] }],
			});
			if (selected && typeof selected === "string") {
				this.filePath = selected;
				this.machine.send("OPEN");
				await this.syncWithFile();
			}
		} catch (err) {
			console.error("[Strata] File open failed:", err);
		}
	}

	/**
	 * Deletes a column from a table in the schema and syncs to disk.
	 */
	async deleteColumn(tableName: string, colName: string) {
		if (!this.filePath) return;
		this.machine.send("SAVE");
		try {
			const { writeTextFile } = await import("@tauri-apps/plugin-fs");
			const { removeColumnFromSchema } = await import("./parser");
			
			const newCode = removeColumnFromSchema(this.rawCode, tableName, colName);
			
			await writeTextFile(this.filePath, newCode);
			await this.syncWithFile();
			this.machine.send("SAVE_SUCCESS");
		} catch (e: any) {
			console.error("[Strata] Column delete failed:", e);
			this.machine.send("SAVE_ERROR");
			this.error = e.message;
		}
	}

	/**
	 * Deletes an entire table/entity from the schema and syncs to disk.
	 */
	async deleteTable(tableName: string) {
		if (!this.filePath) return;
		this.machine.send("SAVE");
		try {
			const { writeTextFile } = await import("@tauri-apps/plugin-fs");
			const { removeTableFromSchema } = await import("./parser");
			
			const newCode = removeTableFromSchema(this.rawCode, tableName);
			
			await writeTextFile(this.filePath, newCode);
			await this.syncWithFile();
			this.machine.send("SAVE_SUCCESS");
		} catch (e: any) {
			console.error("[Strata] Table delete failed:", e);
			this.machine.send("SAVE_ERROR");
			this.error = e.message;
		}
	}

	/**
	 * Resets the entire application state to its initial empty state.
	 * Primarily used for testing and starting a fresh session.
	 */
	reset() {
		this.nodes = [];
		this.edges = [];
		this.filePath = null;
		this.rawCode = '';
		this.isValid = true;
		this.error = null;
		this.machine.send("RESET");
	}

	constructor() {
		// Initialization logic if needed
	}
}

/**
 * Singleton instance of the application state.
 */
export const schemaState = new SchemaState();

