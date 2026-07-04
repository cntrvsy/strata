/**
 * store.svelte.ts
 *
 * Summary: Reactive global state store using Svelte 5 Runes ($state, $derived) to manage nodes, edges, file sync, and mutation operations.
 * Expects: User events (drag, save, add column) and filesystem state changes.
 * Output: Synchronized database schema file state and Svelte Flow configurations.
 */
import { type Node, type Edge } from '@xyflow/svelte';
import { PlatformService } from "../services/platform";
import type { States, Events } from "./types";
import { createStateMachine } from "./fsm";
import { OperationQueue } from "./queue";
import { toast } from "svelte-sonner";

/**
 * Helper to resolve relative path from base file path.
 */
function resolveRelativePath(base: string, rel: string): string {
	const parts = base.split('/');
	parts.pop(); // Remove filename
	const relParts = rel.split('/');
	for (const part of relParts) {
		if (part === '.') continue;
		if (part === '..') {
			parts.pop();
		} else {
			parts.push(part);
		}
	}
	let resolved = parts.join('/');
	if (!resolved.endsWith('.ts')) {
		resolved += '.ts';
	}
	return resolved;
}

/**
 * Loads external schemas asynchronously based on import path declarations.
 */
async function loadExternalSchemas(
	basePath: string, 
	externalImports: { filePath: string }[] = [], 
	externalPaths: string[] = []
): Promise<Map<string, string>> {
	const externalFilesMap = new Map<string, string>();
	for (const imp of externalImports) {
		const resolvedPath = resolveRelativePath(basePath, imp.filePath);
		try {
			const extRaw = await PlatformService.readText(resolvedPath);
			externalFilesMap.set(imp.filePath, extRaw);
		} catch (err: any) {
			console.warn(`[Strata] Failed to read external import at ${resolvedPath}:`, err);
			toast.error(`Failed to read import: ${imp.filePath}`, {
				description: err?.message || "File not found or unreadable."
			});
		}
	}
	for (const p of externalPaths) {
		if (externalFilesMap.has(p)) continue;
		const resolvedPath = resolveRelativePath(basePath, p);
		try {
			const extRaw = await PlatformService.readText(resolvedPath);
			externalFilesMap.set(p, extRaw);
		} catch (err: any) {
			console.warn(`[Strata] Failed to read external path at ${resolvedPath}:`, err);
			toast.error(`Failed to read path: ${p}`, {
				description: err?.message || "File not found or unreadable."
			});
		}
	}
	return externalFilesMap;
}

function parseWranglerBindings(tomlContent: string): { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] {
	const bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] = [];
	const blocks = tomlContent.split(/\[\[/);
	
	for (const block of blocks) {
		const lines = block.split('\n');
		const headerLine = lines[0].trim();
		
		if (headerLine.startsWith('kv_namespaces')) {
			let name = '';
			for (const line of lines) {
				const match = line.match(/^\s*binding\s*=\s*["']([^"']+)["']/);
				if (match) {
					name = match[1];
					break;
				}
			}
			if (name) {
				bindings.push({ type: 'kv', name, extra: {} });
			}
		} else if (headerLine.startsWith('durable_objects.bindings')) {
			let name = '';
			let className = '';
			for (const line of lines) {
				const nameMatch = line.match(/^\s*name\s*=\s*["']([^"']+)["']/);
				if (nameMatch) {
					name = nameMatch[1];
				}
				const classMatch = line.match(/^\s*class_name\s*=\s*["']([^"']+)["']/);
				if (classMatch) {
					className = classMatch[1];
				}
			}
			if (name) {
				bindings.push({ type: 'do', name, extra: { class: className } });
			}
		} else if (headerLine.startsWith('r2_buckets')) {
			let name = '';
			for (const line of lines) {
				const match = line.match(/^\s*binding\s*=\s*["']([^"']+)["']/);
				if (match) {
					name = match[1];
					break;
				}
			}
			if (name) {
				bindings.push({ type: 'r2', name, extra: {} });
			}
		}
	}
	return bindings;
}

async function discoverWranglerBindings(filePath: string, customWranglerPath?: string): Promise<{ type: 'kv' | 'do' | 'r2'; name: string; extra: any }[]> {
	if (!filePath) return [];
	let dir = filePath.substring(0, filePath.lastIndexOf('/'));
	const candidatePaths: string[] = [];
	if (customWranglerPath) {
		candidatePaths.push(dir + '/' + customWranglerPath);
	}
	candidatePaths.push(
		dir + '/wrangler.toml',
		dir + '/../wrangler.toml',
		dir + '/../../wrangler.toml',
		dir + '/../../../wrangler.toml',
		dir + '/../../../../wrangler.toml'
	);
	for (const candidate of candidatePaths) {
		try {
			const toml = await PlatformService.readText(candidate);
			if (toml) {
				return parseWranglerBindings(toml);
			}
		} catch (e) {}
	}
	return [];
}

/**
 * Preserves selection state and restores positions of external nodes from localStorage.
 */
function mapNodesWithExternalPositions(nodes: Node[], filePath: string, selectedNodeIds: Set<string>, existingNodes: Node[]): Node[] {
	return nodes.map(n => {
		let position = { x: n.position.x, y: n.position.y };
		if (n.data?.isExternal) {
			const existing = existingNodes.find(ex => ex.id === n.id);
			if (existing) {
				position = { x: existing.position.x, y: existing.position.y };
			} else if (typeof window !== 'undefined' && window.localStorage) {
				const key = `strata_ext_pos_${filePath}_${n.id}`;
				const saved = window.localStorage.getItem(key);
				if (saved) {
					try {
						const pos = JSON.parse(saved);
						position = { x: pos.x, y: pos.y };
					} catch (e) {}
				}
			}
		}
		return {
			...n,
			position,
			selected: selectedNodeIds.has(n.id)
		};
	});
}

/**
 * Global application state for Strata.
 * Manages schema synchronization, file persistence, and UI modes.
 */
export class SchemaState {
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
	/** The ID of the node currently hovered */
	hoveredNodeId = $state<string | null>(null);
	/** Whether compact mode is currently active (keys only) */
	compactMode = $state(false);

	// --- File State ---
	/** Absolute path to the currently open schema.ts file */
	filePath = $state<string | null>(null);
	/** HTML-wrapped code preview of the schema.ts file */
	rawCode = $state('');
	/** Reactive list of recently opened files */
	recentFiles = $state<string[]>([]);
	/** Timestamp of the last local disk write to prevent watcher feedback loops */
	lastWriteTime = 0;
	
	// --- Sequential Task Queue ---
	private queue = new OperationQueue();

	// --- FSM State ---
	/** 
	 * Formalized Finite State Machine for Strata.
	 * Prevents "Impossible States" and ensures logical transitions.
	 */
	machine = createStateMachine(this.filePath ? "BUSY" : "EMPTY");

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

	/** Active filter for storage target (d1, do, kv, r2) */
	activeFilter = $state<'d1' | 'do' | 'kv' | 'r2' | null>(null);
	/** Whether the 'New Table' modal is currently visible */
	showNewTableModal = $state(false);
	/** The current UI view mode: diagram canvas or code editor */
	viewMode = $state<'diagram' | 'code'>('diagram');

	/** Custom relative path to wrangler.toml configured in the schema */
	wranglerPath = $state<string | undefined>(undefined);
	/** Whether the project settings modal is visible */
	showProjectSettingsModal = $state(false);

	/**
	 * Force-syncs the UI state with the current file on disk.
	 * This is the definitive "Ground Truth" sync that bypasses local HTML previews.
	 */
	async async_syncWithFile() {
		await this.syncWithFile();
	}

	private async parseAndApply(code: string): Promise<boolean> {
		const { parseSchema } = await import("../parser");
		
		// 1. Initial parse to find external imports & paths
		const initialResult = parseSchema(code);
		let externalFilesMap = new Map<string, string>();
		
		if ((initialResult.externalImports && initialResult.externalImports.length > 0) || (initialResult.externalPaths && initialResult.externalPaths.length > 0)) {
			externalFilesMap = await loadExternalSchemas(this.filePath!, initialResult.externalImports, initialResult.externalPaths);
		}

		// 2. Final parse with external file contents mapped
		const result = parseSchema(code, externalFilesMap);
		
		if (result.success) {
			this.wranglerPath = result.wranglerPath;
			// Display any warnings
			if (result.warnings && result.warnings.length > 0) {
				for (const warning of result.warnings) {
					toast.warning("Schema Parser Warning", {
						description: warning,
						duration: 5000
					});
				}
			}
			
			// Discover wrangler.toml bindings
			const wranglerBindings = await discoverWranglerBindings(this.filePath!, this.wranglerPath);
			const finalNodes = [...result.nodes];
			
			for (const binding of wranglerBindings) {
				if (!finalNodes.some(n => n.id === binding.name)) {
					finalNodes.push({
						id: binding.name,
						type: 'table',
						data: {
							label: binding.name,
							columns: binding.type === 'kv' ? [{ name: 'id', definition: 'string', isPk: false, notNull: false, isReferences: false }] : [],
							target: binding.type,
							strata: {
								target: binding.type,
								x: Math.round(Math.random() * 200),
								y: Math.round(Math.random() * 200),
								binding: binding.name,
								class: binding.extra.class
							},
							isExternal: true
						},
						position: { x: Math.round(Math.random() * 200), y: Math.round(Math.random() * 200) }
					});
				}
			}

			// Preserve selection state
			const selectedNodeIds = new Set(this.nodes.filter(n => n.selected).map(n => n.id));
			this.nodes = mapNodesWithExternalPositions(finalNodes, this.filePath!, selectedNodeIds, this.nodes);
			this.edges = result.edges;
			this.rawCode = code;
			this.isValid = true;
			this.error = null;
			this.errorLoc = null;
			this.errorType = null;
			return true;
		} else {
			this.isValid = false;
			this.error = result.error || "Parse Error";
			this.errorLoc = result.errorLoc || null;
			this.errorType = 'parse';
			return false;
		}
	}

	async syncWithFile() {
		await this.queue.enqueue(async () => {
			if (!this.filePath) return;
			
			this.machine.send("SYNC");
			this.error = null;
			this.errorType = null;
			
			try {
				const raw = await PlatformService.readText(this.filePath);
				if (raw === this.rawCode && this.isValid) {
					// Prevent duplicate syncing/parsing if code matches local rawCode
					this.machine.send("SUCCESS");
					return;
				}
				
				const success = await this.parseAndApply(raw);
				if (success) {
					// Update recent files list
					if (typeof window !== 'undefined' && window.localStorage && this.filePath) {
						let recent = [...this.recentFiles];
						recent = recent.filter(p => p !== this.filePath);
						recent.unshift(this.filePath);
						recent = recent.slice(0, 5);
						this.recentFiles = recent;
						window.localStorage.setItem('strata_recent_files', JSON.stringify(recent));
					}
					this.machine.send("SUCCESS");
				} else {
					this.machine.send("FAIL");
				}
			} catch (e: any) {
				console.error("[Strata] Sync failed:", e);
				this.error = e.message;
				this.errorType = 'parse';
				this.machine.send("FAIL");
				
				// If a file read/load fails on a recent file, clean up from history
				if (this.filePath && typeof window !== 'undefined' && window.localStorage) {
					const isReadError = e.message?.toLowerCase().includes('read') || e.message?.toLowerCase().includes('failed to read') || e.message?.toLowerCase().includes('no such file');
					if (isReadError && this.recentFiles.includes(this.filePath)) {
						const lastFile = this.filePath;
						this.recentFiles = this.recentFiles.filter(f => f !== lastFile);
						window.localStorage.setItem('strata_recent_files', JSON.stringify(this.recentFiles));
						this.reset();
					}
				}
			}
		});
	}

	/**
	 * Resolves the parent directory of the currently open or last worked on schema file.
	 * Returns undefined if no path history is available.
	 */
	private getDefaultDialogPath(): string | undefined {
		const activePath = this.filePath || (this.recentFiles.length > 0 ? this.recentFiles[0] : null);
		if (activePath) {
			const parts = activePath.split('/');
			parts.pop(); // Remove filename
			return parts.join('/');
		}
		return undefined;
	}

	/**
	 * Opens a schema file directly from recent history.
	 */
	async openFileDirectly(path: string) {
		this.filePath = path;
		this.machine.send("OPEN");
		await this.syncWithFile();
	}

	/**
	 * Opens a native file dialog to select a Drizzle schema file and syncs it.
	 */
	async openNewFile() {
		try {
			const defaultPath = this.getDefaultDialogPath();
			const selected = await PlatformService.selectFile(["ts"], defaultPath);
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
		await this.queue.enqueue(async () => {
			if (!this.filePath) return;
			this.machine.send("SAVE");
			try {
				const newCode = await mutateFn(this.rawCode);
				this.ignoreNextWatch = true;
				this.lastWriteTime = Date.now();
				await PlatformService.writeText(this.filePath, newCode);
				
				const success = await this.parseAndApply(newCode);
				if (success) {
					this.machine.send("SUCCESS");
				} else {
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
		const { updateColumnModifiersInSchema } = await import("../parser");
		await this.executeSchemaMutation("Column modifier update", (code) => 
			updateColumnModifiersInSchema(code, tableName, columnName, modifiers)
		);
	}

	/**
	 * Deletes a column from a table in the schema and syncs to disk.
	 */
	async deleteColumn(tableName: string, colName: string) {
		const { removeColumnFromSchema } = await import("../parser");
		await this.executeSchemaMutation("Column delete", (code) => 
			removeColumnFromSchema(code, tableName, colName)
		);
	}

	/**
	 * Deletes an entire table/entity from the schema and syncs to disk.
	 */
	async deleteTable(tableName: string) {
		const { removeTableFromSchema } = await import("../parser");
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
		const { removeEdgeFromSchema } = await import("../parser");
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
				const { updateAllNodePositionsInSchema } = await import("../parser");
				currentCode = updateAllNodePositionsInSchema(currentCode, this.nodes);
			}
			return currentCode;
		});

		// Save external node positions to localStorage
		if (typeof window !== 'undefined' && window.localStorage) {
			for (const node of this.nodes) {
				if (node.data?.isExternal) {
					const key = `strata_ext_pos_${this.filePath}_${node.id}`;
					window.localStorage.setItem(key, JSON.stringify({ x: Math.round(node.position.x), y: Math.round(node.position.y) }));
				}
			}
		}

		this.isRecentlySaved = true;
		setTimeout(() => (this.isRecentlySaved = false), 1500);
	}

	/**
	 * Renames a table in the schema and syncs to disk.
	 */
	async renameTable(oldName: string, newName: string) {
		const { renameTableInSchema } = await import("../parser");
		await this.executeSchemaMutation("Table rename", (code) => 
			renameTableInSchema(code, oldName, newName)
		);
		if (this.activeInspectorNodeId === oldName) {
			this.activeInspectorNodeId = newName;
		}
	}

	/**
	 * Renames a column in a table in the schema and syncs to disk.
	 */
	async renameColumn(tableName: string, oldColName: string, newColName: string) {
		const { renameColumnInSchema } = await import("../parser");
		await this.executeSchemaMutation("Column rename", (code) => 
			renameColumnInSchema(code, tableName, oldColName, newColName)
		);
	}

	/**
	 * Updates the project-level wranglerPath configuration.
	 */
	async updateProjectConfig(wranglerPath?: string) {
		const { updateProjectConfigInSchema } = await import("../parser");
		await this.executeSchemaMutation("Project Config update", (code) =>
			updateProjectConfigInSchema(code, { wranglerPath })
		);
	}

	/**
	 * Adds a new table or plain entity to the schema and syncs to disk.
	 */
	async addTable(tableName: string, target: 'd1' | 'do' | 'kv' | 'r2' = 'd1', extra?: { class?: string; path?: string }) {
		const { addTableToSchema } = await import("../parser");
		await this.executeSchemaMutation("Table add", (code) => 
			addTableToSchema(code, tableName, target, extra)
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
		const { addColumnToSchema } = await import("../parser");
		await this.executeSchemaMutation("Column add", (code) => 
			addColumnToSchema(code, tableName, columnName, type, referencesTable, referencesColumn)
		);
	}

	/**
	 * Adds a relation/edge to the schema and syncs to disk.
	 */
	async addRelation(source: string, target: string) {
		const { addEdgeToSchema } = await import("../parser");
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
		if (typeof window !== 'undefined' && window.localStorage) {
			try {
				const recentStr = window.localStorage.getItem('strata_recent_files');
				this.recentFiles = recentStr ? JSON.parse(recentStr) : [];
				
				const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST);
				if (this.recentFiles.length > 0 && !isTest) {
					const lastFile = this.recentFiles[0];
					this.filePath = lastFile;
					this.machine.send("OPEN");
					this.syncWithFile().catch(err => {
						console.error("[Strata] Auto-open failed:", err);
						this.recentFiles = this.recentFiles.filter(f => f !== lastFile);
						window.localStorage.setItem('strata_recent_files', JSON.stringify(this.recentFiles));
						this.reset();
					});
				}
			} catch (e) {}
		}
	}
}
