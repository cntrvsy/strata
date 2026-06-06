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
 * Global application state for Strata.
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
	/** Exact location of the last parse error for inline linting */
	errorLoc = $state<{ line: number, column: number } | null>(null);
	/** Differentiates between parsing errors and disk write errors */
	errorType = $state<'parse' | 'disk' | null>(null);

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
				SAVE: "SAVING",
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
	/** Whether the 'Export Successful' toast is visible */
	showExportToast = $state(false);

	// --- UI State ---
	/** Active filter for storage target (d1, do, kv) */
	activeFilter = $state<'d1' | 'do' | 'kv' | null>(null);
	/** Whether the 'New Table' modal is currently visible */
	showNewTableModal = $state(false);
	/** The current UI view mode: diagram canvas or code editor */
	viewMode = $state<'diagram' | 'code'>('diagram');

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
		this.errorType = null;
		
		try {
			// Dynamic imports to avoid SSR issues or circular dependencies
			const { readTextFile } = await import("@tauri-apps/plugin-fs");
			const { invoke } = await import("@tauri-apps/api/core");
			const { parseSchema, wrapCode } = await import("./parser");
			
			const raw = await readTextFile(this.filePath);
			if (raw === this.rawCode && this.isValid) {
				// Prevent duplicate syncing/parsing if code matches local rawCode
				this.machine.send("LOAD_SUCCESS");
				return;
			}
			
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
				this.errorLoc = null;
				this.errorType = null;
				
				this.machine.send("LOAD_SUCCESS");
			} else {
				this.isValid = false;
				this.error = result.error || "Parse Error";
				this.errorLoc = result.errorLoc || null;
				this.errorType = 'parse';
				this.machine.send("LOAD_ERROR");
			}
		} catch (e: any) {
			console.error("[Strata] Sync failed:", e);
			this.error = e.message;
			this.errorType = 'parse';
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
	 * Updates column modifiers (primary key, nullability, default) and syncs to disk.
	 */
	async updateColumnModifiers(
		tableName: string,
		columnName: string,
		modifiers: { isPk?: boolean; notNull?: boolean; defaultVal?: string | null }
	) {
		if (!this.filePath) return;
		this.machine.send("SAVE");
		try {
			const { writeTextFile } = await import("@tauri-apps/plugin-fs");
			const { updateColumnModifiersInSchema } = await import("./parser");

			const newCode = updateColumnModifiersInSchema(this.rawCode, tableName, columnName, modifiers);

			await writeTextFile(this.filePath, newCode);
			await this.syncWithFile();
			this.machine.send("SAVE_SUCCESS");
		} catch (e: any) {
			console.error("[Strata] Column modifier update failed:", e);
			this.error = e.message;
			this.errorType = 'disk';
			this.machine.send("SAVE_ERROR");
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
			this.error = e.message;
			this.errorType = 'disk';
			this.machine.send("SAVE_ERROR");
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
			this.error = e.message;
			this.errorType = 'disk';
			this.machine.send("SAVE_ERROR");
		}
	}

	/**
	 * Persists the current rawCode to disk, including any pending node position updates.
	 */
	async saveToFile() {
		if (!this.filePath || this.machine.current === "SAVING") return;
		
		this.machine.send("SAVE");
		try {
			const { writeTextFile } = await import("@tauri-apps/plugin-fs");
			const { updateNodePositionInSchema } = await import("./parser");
			
			let currentCode = this.rawCode;
			
			// If we are in diagram mode, ensure positions are synced
			if (this.viewMode === 'diagram') {
				for (const node of this.nodes) {
					currentCode = updateNodePositionInSchema(currentCode, node.id, node.position.x, node.position.y);
				}
			}
			
			await writeTextFile(this.filePath, currentCode);
			await this.syncWithFile();
			this.machine.send("SAVE_SUCCESS");
			
			this.isRecentlySaved = true;
			setTimeout(() => (this.isRecentlySaved = false), 1500);
		} catch (e: any) {
			console.error("[Strata] Save failed:", e);
			this.error = e.message;
			this.errorType = 'disk';
			this.machine.send("SAVE_ERROR");
		}
	}

	/**
	 * Renames a table in the schema and syncs to disk.
	 */
	async renameTable(oldName: string, newName: string) {
		if (!this.filePath) return;
		this.machine.send("SAVE");
		try {
			const { writeTextFile } = await import("@tauri-apps/plugin-fs");
			const { renameTableInSchema } = await import("./parser");
			
			const newCode = renameTableInSchema(this.rawCode, oldName, newName);
			
			await writeTextFile(this.filePath, newCode);
			await this.syncWithFile();
			this.machine.send("SAVE_SUCCESS");
		} catch (e: any) {
			console.error("[Strata] Table rename failed:", e);
			this.error = e.message;
			this.errorType = 'disk';
			this.machine.send("SAVE_ERROR");
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

// Expose to window for E2E testing
if (typeof window !== 'undefined' && import.meta.env.DEV) {
	(window as any).schemaState = schemaState;
}

