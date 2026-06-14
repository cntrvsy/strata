import { type Node, type Edge } from '@xyflow/svelte';
import { FiniteStateMachine } from "runed";
import { PlatformService } from "./services/platform";

/**
 * Valid states for the SchemaState machine.
 */
type States = "EMPTY" | "BUSY" | "IDLE" | "DIRTY" | "ERROR";

/**
 * Valid events that trigger state transitions.
 */
type Events = 
	| "SYNC" 
	| "OPEN" 
	| "EDIT" 
	| "SAVE" 
	| "SUCCESS" 
	| "FAIL"
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
	/** Flag to ignore the next file change event if triggered by our own write */
	ignoreNextWatch = false;
	/** Whether the schema is currently valid (parsed successfully) */
	isValid = $state(true);
	/** Any error message from the last parse attempt */
	error = $state<string | null>(null);
	/** Exact location of the last parse error for inline linting */
	errorLoc = $state<{ line: number, column: number } | null>(null);
	/** Differentiates between parsing errors and disk write errors */
	errorType = $state<'parse' | 'disk' | null>(null);
	/** The ID of the node currently displayed in the inspector panel */
	activeInspectorNodeId = $state<string | null>(null);
	/** Selection coordinates of the currently active/dragged node */
	activeCoordinates = $state<{ x: number; y: number } | null>(null);

	// --- File State ---
	/** Absolute path to the currently open schema.ts file */
	filePath = $state<string | null>(null);
	/** HTML-wrapped code preview of the schema.ts file */
	rawCode = $state('');
	
	// --- Sequential Task Queue ---
	private operationQueue = Promise.resolve();
	private async enqueue(op: () => Promise<void>): Promise<void> {
		this.operationQueue = this.operationQueue.then(op).catch(err => {
			console.error("[Strata] Queue operation failed:", err);
		});
		return this.operationQueue;
	}

	// --- FSM State ---
	/** 
	 * Formalized Finite State Machine for Strata.
	 * Prevents "Impossible States" and ensures logical transitions.
	 */
	machine = new FiniteStateMachine<States, Events>(
		this.filePath ? "BUSY" : "EMPTY", 
		{
			EMPTY: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				RESET: "EMPTY",
			},
			BUSY: {
				SYNC: "BUSY",
				EDIT: "BUSY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				FAIL: "ERROR",
				RESET: "EMPTY",
			},
			IDLE: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				EDIT: "DIRTY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				RESET: "EMPTY",
			},
			DIRTY: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				EDIT: "DIRTY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				RESET: "EMPTY",
			},
			ERROR: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				EDIT: "DIRTY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				FAIL: "ERROR",
				RESET: "EMPTY"
			}
		}
	);

	// --- Derived IO States (Legacy Support) ---
	/** True if a write operation to disk is currently in progress */
	get isSaving() { return this.machine.current === "BUSY"; }
	/** True if the diagram is currently being re-parsed or updated from disk */
	get isSyncing() { return this.machine.current === "BUSY"; }
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
		await this.enqueue(async () => {
			if (!this.filePath) return;
			
			this.machine.send("SYNC");
			this.error = null;
			this.errorType = null;
			
			try {
				// Dynamic imports to avoid SSR issues or circular dependencies
				const { parseSchema } = await import("./parser");
				
				const raw = await PlatformService.readText(this.filePath);
				if (raw === this.rawCode && this.isValid) {
					// Prevent duplicate syncing/parsing if code matches local rawCode
					this.machine.send("SUCCESS");
					return;
				}
				
				const result = parseSchema(raw);
				
				if (result.success) {
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
					
					this.machine.send("SUCCESS");
				} else {
					this.isValid = false;
					this.error = result.error || "Parse Error";
					this.errorLoc = result.errorLoc || null;
					this.errorType = 'parse';
					this.machine.send("FAIL");
				}
			} catch (e: any) {
				console.error("[Strata] Sync failed:", e);
				this.error = e.message;
				this.errorType = 'parse';
				this.machine.send("FAIL");
			}
		});
	}

	/**
	 * Opens a native file dialog to select a Drizzle schema file and syncs it.
	 */
	async openNewFile() {
		try {
			const selected = await PlatformService.selectFile(["ts"]);
			if (selected) {
				this.filePath = selected;
				this.machine.send("OPEN");
				await this.syncWithFile();
			}
		} catch (err) {
			console.error("[Strata] File open failed:", err);
		}
	}

	/**
	 * Safely executes a schema-changing write operation with unified FSM state management and file writing.
	 */
	private async executeSchemaMutation(
		operationName: string,
		mutateFn: (code: string) => string | Promise<string>
	): Promise<void> {
		await this.enqueue(async () => {
			if (!this.filePath) return;
			this.machine.send("SAVE");
			try {
				const newCode = await mutateFn(this.rawCode);
				this.ignoreNextWatch = true;
				await PlatformService.writeText(this.filePath, newCode);
				
				const { parseSchema } = await import("./parser");
				const result = parseSchema(newCode);
				
				if (result.success) {
					const selectedNodeIds = new Set(this.nodes.filter(n => n.selected).map(n => n.id));
					this.nodes = result.nodes.map(n => ({
						...n,
						selected: selectedNodeIds.has(n.id)
					}));
					this.edges = result.edges;
					this.rawCode = newCode;
					this.isValid = true;
					this.error = null;
					this.errorLoc = null;
					this.errorType = null;
					this.machine.send("SUCCESS");
				} else {
					this.isValid = false;
					this.error = result.error || "Parse Error";
					this.errorLoc = result.errorLoc || null;
					this.errorType = 'parse';
					this.machine.send("FAIL");
				}
			} catch (e: any) {
				console.error(`[Strata] ${operationName} failed:`, e);
				this.error = e.message;
				this.errorType = 'disk';
				this.machine.send("FAIL");
			}
		});
	}

	/**
	 * Updates column modifiers (primary key, nullability, default) and syncs to disk.
	 */
	async updateColumnModifiers(
		tableName: string,
		columnName: string,
		modifiers: { isPk?: boolean; notNull?: boolean; defaultVal?: string | null }
	) {
		const { updateColumnModifiersInSchema } = await import("./parser");
		await this.executeSchemaMutation("Column modifier update", (code) => 
			updateColumnModifiersInSchema(code, tableName, columnName, modifiers)
		);
	}

	/**
	 * Deletes a column from a table in the schema and syncs to disk.
	 */
	async deleteColumn(tableName: string, colName: string) {
		const { removeColumnFromSchema } = await import("./parser");
		await this.executeSchemaMutation("Column delete", (code) => 
			removeColumnFromSchema(code, tableName, colName)
		);
	}

	/**
	 * Deletes an entire table/entity from the schema and syncs to disk.
	 */
	async deleteTable(tableName: string) {
		const { removeTableFromSchema } = await import("./parser");
		await this.executeSchemaMutation("Table delete", (code) => 
			removeTableFromSchema(code, tableName)
		);
		if (this.activeInspectorNodeId === tableName) {
			this.activeInspectorNodeId = null;
		}
	}

	/**
	 * Deletes a relationship/edge from the schema and syncs to disk.
	 */
	async deleteRelation(source: string, target: string, name?: string) {
		const { removeEdgeFromSchema } = await import("./parser");
		await this.executeSchemaMutation("Relation delete", (code) => 
			removeEdgeFromSchema(code, source, target, name)
		);
	}

	/**
	 * Persists the current rawCode to disk, including any pending node position updates.
	 */
	async saveToFile() {
		if (!this.filePath || this.machine.current === "BUSY") return;
		
		await this.executeSchemaMutation("Save", async (code) => {
			let currentCode = code;
			if (this.viewMode === 'diagram') {
				const { updateAllNodePositionsInSchema } = await import("./parser");
				currentCode = updateAllNodePositionsInSchema(currentCode, this.nodes);
			}
			return currentCode;
		});

		this.isRecentlySaved = true;
		setTimeout(() => (this.isRecentlySaved = false), 1500);
	}

	/**
	 * Renames a table in the schema and syncs to disk.
	 */
	async renameTable(oldName: string, newName: string) {
		const { renameTableInSchema } = await import("./parser");
		await this.executeSchemaMutation("Table rename", (code) => 
			renameTableInSchema(code, oldName, newName)
		);
		if (this.activeInspectorNodeId === oldName) {
			this.activeInspectorNodeId = newName;
		}
	}

	/**
	 * Renames a specific column in the schema and syncs to disk.
	 */
	async renameColumn(tableName: string, oldColName: string, newColName: string) {
		const { renameColumnInSchema } = await import("./parser");
		await this.executeSchemaMutation("Column rename", (code) => 
			renameColumnInSchema(code, tableName, oldColName, newColName)
		);
	}

	/**
	 * Adds a new table to the schema and syncs to disk.
	 */
	async addTable(name: string, target: 'd1' | 'do' | 'kv') {
		const { addTableToSchema } = await import("./parser");
		await this.executeSchemaMutation("Table add", (code) => 
			addTableToSchema(code, name, target)
		);
	}

	/**
	 * Adds a column to a table and syncs to disk.
	 */
	async addColumn(
		tableName: string, 
		columnName: string, 
		type: string = 'text',
		referencesTable?: string,
		referencesColumn?: string
	) {
		const { addColumnToSchema } = await import("./parser");
		await this.executeSchemaMutation("Column add", (code) => 
			addColumnToSchema(code, tableName, columnName, type, referencesTable, referencesColumn)
		);
	}

	/**
	 * Adds a relation/edge to the schema and syncs to disk.
	 */
	async addRelation(source: string, target: string) {
		const { addEdgeToSchema } = await import("./parser");
		await this.executeSchemaMutation("Relation add", (code) => 
			addEdgeToSchema(code, source, target)
		);
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
		this.activeInspectorNodeId = null;
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

