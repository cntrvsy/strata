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

import { resolveRelativePath } from "../parser";
import { uiState } from "./uiStore.svelte";

/**
 * State-machine JSONC parser.
 * Strips line comments (//) and block comments (/* *\/) while preserving string literals (e.g. URLs).
 */
function parseCleanJson(text: string): any {
	let out = '';
	let inString = false;
	let quoteChar = '';
	let i = 0;
	while (i < text.length) {
		const char = text[i];
		const nextChar = text[i + 1];
		if (inString) {
			out += char;
			if (char === '\\') {
				out += nextChar || '';
				i += 2;
				continue;
			}
			if (char === quoteChar) {
				inString = false;
			}
			i++;
			continue;
		}
		if (char === '"' || char === "'") {
			inString = true;
			quoteChar = char;
			out += char;
			i++;
			continue;
		}
		if (char === '/' && nextChar === '/') {
			i += 2;
			while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++;
			continue;
		}
		if (char === '/' && nextChar === '*') {
			i += 2;
			while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
			i += 2;
			continue;
		}
		out += char;
		i++;
	}
	const cleanCommas = out.replace(/,(\s*[}\]])/g, '$1');
	return JSON.parse(cleanCommas);
}

/**
 * Dynamically resolves tsconfig paths from the workspace by walking up directories.
 * Resolves extended configurations as well (e.g. SvelteKit extends).
 */
async function loadTsconfigPaths(basePath: string): Promise<{ paths: Record<string, string[]>; path: string } | null> {
	let currentDir = basePath.replace(/\\/g, '/').split('/');
	currentDir.pop(); // Remove filename
	
	let tsconfigPath = '';
	let tsconfig: any = null;
	while (currentDir.length > 0) {
		const checkPath = currentDir.join('/') + '/tsconfig.json';
		try {
			const content = await PlatformService.readText(checkPath);
			tsconfig = parseCleanJson(content);
			tsconfigPath = checkPath;
			break;
		} catch {
			currentDir.pop();
		}
	}
	
	if (!tsconfig) return null;
	
	let mergedPaths: Record<string, string[]> = {};
	if (tsconfig.compilerOptions?.paths) {
		mergedPaths = { ...tsconfig.compilerOptions.paths };
	}
	
	let currentConfig = tsconfig;
	let currentConfigPath = tsconfigPath;
	while (currentConfig.extends) {
		try {
			const extendsPath = resolveRelativePath(currentConfigPath, currentConfig.extends);
			const content = await PlatformService.readText(extendsPath);
			currentConfig = parseCleanJson(content);
			currentConfigPath = extendsPath;
			if (currentConfig.compilerOptions?.paths) {
				mergedPaths = { ...currentConfig.compilerOptions.paths, ...mergedPaths };
			}
		} catch {
			break;
		}
	}
	
	return { paths: mergedPaths, path: tsconfigPath };
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

function parseJsonBindings(jsonContent: string): { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] {
	const bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] = [];
	try {
		const data = parseCleanJson(jsonContent);

		if (Array.isArray(data.kv_namespaces)) {
			for (const kv of data.kv_namespaces) {
				if (kv && kv.binding) {
					bindings.push({ type: 'kv', name: kv.binding, extra: {} });
				}
			}
		}
		if (data.durable_objects && Array.isArray(data.durable_objects.bindings)) {
			for (const dobj of data.durable_objects.bindings) {
				if (dobj && dobj.name) {
					bindings.push({ type: 'do', name: dobj.name, extra: { class: dobj.class_name } });
				}
			}
		}
		if (Array.isArray(data.r2_buckets)) {
			for (const r2 of data.r2_buckets) {
				if (r2 && r2.binding) {
					bindings.push({ type: 'r2', name: r2.binding, extra: {} });
				}
			}
		}
	} catch (e) {
		console.warn("[Strata] Failed to parse JSON/JSONC wrangler config:", e);
	}
	return bindings;
}

function parseWranglerContent(fileName: string, content: string): { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] {
	if (fileName.endsWith('.json') || fileName.endsWith('.jsonc')) {
		return parseJsonBindings(content);
	}
	return parseWranglerBindings(content);
}

async function discoverWranglerBindings(filePath: string, customWranglerPath?: string): Promise<{
	bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[];
	configFilePath: string | null;
}> {
	if (!filePath) return { bindings: [], configFilePath: null };
	let dir = filePath.substring(0, filePath.lastIndexOf('/'));
	
	// If the user specified a custom path, try to resolve it first
	if (customWranglerPath) {
		const fullPath = dir + '/' + customWranglerPath;
		try {
			const content = await PlatformService.readText(fullPath);
			if (content) {
				return {
					bindings: parseWranglerContent(customWranglerPath, content),
					configFilePath: fullPath
				};
			}
		} catch (e) {}
	}

	// Dynamic upward traversal to look for wrangler files
	let currentDir = dir;
	let prefix = '';
	for (let depth = 0; depth < 12; depth++) {
		for (const name of ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json']) {
			const candidate = currentDir + '/' + name;
			try {
				const content = await PlatformService.readText(candidate);
				if (content) {
					return {
						bindings: parseWranglerContent(name, content),
						configFilePath: candidate
					};
				}
			} catch (e) {}
		}
		const lastSlash = currentDir.lastIndexOf('/');
		if (lastSlash <= 0) break;
		currentDir = currentDir.substring(0, lastSlash);
		prefix += '../';
	}
	return { bindings: [], configFilePath: null };
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
	get activeInspectorNodeId() { return uiState.activeInspectorNodeId; }
	set activeInspectorNodeId(val: string | null) { uiState.activeInspectorNodeId = val; }

	/** Selection coordinates of the currently active/dragged node */
	get activeCoordinates() { return uiState.activeCoordinates; }
	set activeCoordinates(val: { x: number; y: number } | null) { uiState.activeCoordinates = val; }

	/** The ID of the node currently hovered */
	get hoveredNodeId() { return uiState.hoveredNodeId; }
	set hoveredNodeId(val: string | null) { uiState.hoveredNodeId = val; }

	/** Whether compact mode is currently active (keys only) */
	get compactMode() { return uiState.compactMode; }
	set compactMode(val: boolean) { uiState.compactMode = val; }

	/** Collapsed status of the code panel */
	get isCodeCollapsed() { return uiState.isCodeCollapsed; }
	set isCodeCollapsed(val: boolean) { uiState.isCodeCollapsed = val; }

	/** Collapsed status of the diagram panel */
	get isDiagramCollapsed() { return uiState.isDiagramCollapsed; }
	set isDiagramCollapsed(val: boolean) { uiState.isDiagramCollapsed = val; }

	/** Toggle code panel expand/collapse */
	toggleCodePane = () => {};
	/** Toggle diagram panel expand/collapse */
	toggleDiagramPane = () => {};

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
	get showExportToast() { return uiState.showExportToast; }
	set showExportToast(val: boolean) { uiState.showExportToast = val; }

	/** Active filter for storage target (d1, do, kv, r2) */
	get activeFilter() { return uiState.activeFilter; }
	set activeFilter(val: 'd1' | 'do' | 'kv' | 'r2' | null) { uiState.activeFilter = val; }

	/** Whether the 'New Table' modal is currently visible */
	get showNewTableModal() { return uiState.showNewTableModal; }
	set showNewTableModal(val: boolean) { uiState.showNewTableModal = val; }

	/** The current UI view mode: diagram canvas or code editor */
	get viewMode() { return uiState.viewMode; }
	set viewMode(val: 'diagram' | 'code') { uiState.viewMode = val; }

	/** Custom relative path to wrangler.toml configured in the schema */
	wranglerPath = $state<string | undefined>(undefined);
	/** Absolute path to the resolved wrangler configuration file */
	wranglerConfigFilePath = $state<string | null>(null);

	/** Whether the project settings modal is visible */
	get showProjectSettingsModal() { return uiState.showProjectSettingsModal; }
	set showProjectSettingsModal(val: boolean) { uiState.showProjectSettingsModal = val; }

	/** Whether the help modal is visible */
	get showHelpModal() { return uiState.showHelpModal; }
	set showHelpModal(val: boolean) { uiState.showHelpModal = val; }

	/** The list of bindings parsed from wrangler.toml */
	wranglerBindings = $state<{ type: 'kv' | 'do' | 'r2'; name: string; extra: any }[]>([]);

	/** Warnings about configuration mismatches between schema and wrangler bindings */
	get validationWarnings() {
		const warnings: string[] = [];
		const kvNodes = this.nodes.filter(n => (n.data as any)?.target === 'kv');
		const doNodes = this.nodes.filter(n => (n.data as any)?.target === 'do');

		if (this.wranglerConfigFilePath) {
			const filename = this.wranglerConfigFilePath.substring(this.wranglerConfigFilePath.lastIndexOf('/') + 1);
			for (const kv of kvNodes) {
				if (!this.wranglerBindings.some(b => b.name === kv.id && b.type === 'kv')) {
					warnings.push(`KV Namespace "${kv.id}" is not configured in your ${filename}.`);
				}
			}
			for (const doNode of doNodes) {
				if (!this.wranglerBindings.some(b => b.name === doNode.id && b.type === 'do')) {
					warnings.push(`Durable Object "${doNode.id}" is not configured in your ${filename}.`);
				}
			}
		}

		for (const n of this.nodes) {
			const strata = (n.data as any)?.strata;
			if (strata && strata.relations && strata.relations.length > 0) {
				for (const rel of strata.relations) {
					const exists = this.nodes.some(node => node.id === rel.to) || this.wranglerBindings.some(b => b.name === rel.to);
					if (!exists) {
						warnings.push(`Table "${n.id}" points to a missing synthetic relation target "${rel.to}".`);
					}
				}
			}
		}

		return warnings;
	}


	/**
	 * Force-syncs the UI state with the current file on disk.
	 * This is the definitive "Ground Truth" sync that bypasses local HTML previews.
	 */
	async async_syncWithFile() {
		await this.syncWithFile();
	}

	private async parseAndApply(code: string): Promise<boolean> {
		const { parseSchema } = await import("../parser");
		
		const tsconfigInfo = this.filePath ? await loadTsconfigPaths(this.filePath) : null;
		const tsconfigPaths = tsconfigInfo?.paths;
		const tsconfigPath = tsconfigInfo?.path;

		// 1. Initial parse to find external imports & paths
		const initialResult = parseSchema(code, undefined, tsconfigPaths, tsconfigPath);
		let externalFilesMap = new Map<string, string>();
		
		if ((initialResult.externalImports && initialResult.externalImports.length > 0) || (initialResult.externalPaths && initialResult.externalPaths.length > 0)) {
			externalFilesMap = await loadExternalSchemas(this.filePath!, initialResult.externalImports, initialResult.externalPaths);
		}

		// 2. Final parse with external file contents mapped
		const result = parseSchema(code, externalFilesMap, tsconfigPaths, tsconfigPath);
		
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
			const { bindings: wranglerBindings, configFilePath } = await discoverWranglerBindings(this.filePath!, this.wranglerPath);
			this.wranglerBindings = wranglerBindings;
			this.wranglerConfigFilePath = configFilePath;
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
				toast.error("File synchronization failed", {
					description: e.message || String(e)
				});
				
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
				toast.error(`${operationName} failed`, {
					description: e.message || String(e)
				});
			}
		});
	}

	/**
	 * Updates column modifiers (primary key, nullability, default) and syncs to disk.
	 */
	async updateColumnModifiers(
		tableName: string,
		columnName: string,
		modifiers: { isPk?: boolean; notNull?: boolean; defaultVal?: string | null; ttl?: number | null; metadata?: string | null }
	) {
		const { updateColumnModifiersInSchema } = await import("../parser");
		await this.executeSchemaMutation("Column modifier update", (code) => 
			updateColumnModifiersInSchema(code, tableName, columnName, modifiers)
		);
	}

	/**
	 * Updates table/target JSDoc configuration metadata (e.g. public access, CORS for R2 buckets) and syncs to disk.
	 */
	async updateTableMetadata(tableName: string, metadata: { public?: boolean; customDomain?: string | null; cors?: boolean }) {
		const { updateTableMetadataInSchema } = await import("../parser");
		await this.executeSchemaMutation("Table metadata update", (code) => 
			updateTableMetadataInSchema(code, tableName, metadata)
		);
	}

	/**
	 * Deletes a column from a table in the schema and syncs to disk.
	 */
	async deleteColumn(tableName: string, colName: string) {
		const { removeColumnFromSchema } = await import("../parser");
		await this.executeSchemaMutation("Column delete", (code) => 
			removeColumnFromSchema(code, tableName, colName, this.filePath || undefined)
		);
	}

	/**
	 * Deletes an entire table/entity from the schema and syncs to disk.
	 */
	async deleteTable(tableName: string) {
		const node = this.nodes.find(n => n.id === tableName);
		const target = (node?.data as any)?.target || 'd1';

		const { removeTableFromSchema } = await import("../parser");
		await this.executeSchemaMutation("Table delete", (code) => 
			removeTableFromSchema(code, tableName)
		);
		if (this.activeInspectorNodeId === tableName) {
			this.activeInspectorNodeId = null;
		}

		if (target !== 'd1' && this.wranglerConfigFilePath) {
			await this.syncToWranglerConfig('remove', { type: target, name: tableName });
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

	async renameTable(oldName: string, newName: string) {
		const node = this.nodes.find(n => n.id === oldName);
		const target = (node?.data as any)?.target || 'd1';
		const extra = (node?.data as any)?.strata || {};

		const { renameTableInSchema } = await import("../parser");
		await this.executeSchemaMutation("Table rename", (code) => 
			renameTableInSchema(code, oldName, newName)
		);
		if (this.activeInspectorNodeId === oldName) {
			this.activeInspectorNodeId = newName;
		}

		if (target !== 'd1' && this.wranglerConfigFilePath) {
			await this.syncToWranglerConfig('remove', { type: target, name: oldName });
			await this.syncToWranglerConfig('add', { type: target, name: newName, extra });
		}
	}

	/**
	 * Renames a column in a table in the schema and syncs to disk.
	 */
	async renameColumn(tableName: string, oldColName: string, newColName: string) {
		const { renameColumnInSchema } = await import("../parser");
		await this.executeSchemaMutation("Column rename", (code) => 
			renameColumnInSchema(code, tableName, oldColName, newColName, this.filePath || undefined)
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

		if (target !== 'd1' && this.wranglerConfigFilePath) {
			await this.syncToWranglerConfig('add', { type: target, name: tableName, extra });
		}
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
			addColumnToSchema(code, tableName, columnName, type, referencesTable, referencesColumn, this.filePath || undefined)
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

	/**
	 * Synchronizes a canvas mutation (add/remove/rename) back to wrangler.toml or json config
	 */
	async syncToWranglerConfig(
		action: 'add' | 'remove',
		binding: { type: 'kv' | 'do' | 'r2'; name: string; extra?: any }
	) {
		if (!this.wranglerConfigFilePath) return;
		try {
			await PlatformService.mutateWranglerConfig(
				this.wranglerConfigFilePath,
				action,
				binding.type,
				binding.name,
				binding.extra || {}
			);
			toast.success(`Wrangler configuration synced`, {
				description: `${action === 'add' ? 'Added' : 'Removed'} ${binding.type} binding: ${binding.name}`
			});
		} catch (err: any) {
			console.error("[Strata] Failed to sync wrangler config:", err);
			toast.error(`Wrangler sync failed`, {
				description: err?.message || String(err)
			});
		}
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

/**
 * Surgically mutates TOML config string, preserving comments and format.
 */
export function mutateTomlConfig(content: string, action: 'add' | 'remove', binding: { type: 'kv' | 'do' | 'r2'; name: string; extra?: any }): string {
	const blocks = content.split(/(?=\[\[)/);
	
	if (action === 'remove') {
		const filteredBlocks = blocks.filter(block => {
			const trimmed = block.trim();
			if (!trimmed.startsWith('[[')) return true;
			
			const lines = trimmed.split('\n');
			const header = lines[0].trim();
			
			if (binding.type === 'kv' && header.startsWith('[[kv_namespaces]]')) {
				return !lines.some(line => line.match(new RegExp(`binding\\s*=\\s*["']${binding.name}["']`)));
			}
			if (binding.type === 'r2' && header.startsWith('[[r2_buckets]]')) {
				return !lines.some(line => line.match(new RegExp(`binding\\s*=\\s*["']${binding.name}["']`)));
			}
			if (binding.type === 'do' && header.startsWith('[[durable_objects.bindings]]')) {
				return !lines.some(line => line.match(new RegExp(`name\\s*=\\s*["']${binding.name}["']`)));
			}
			return true;
		});
		return filteredBlocks.join('');
	} else {
		let exists = false;
		for (const block of blocks) {
			const trimmed = block.trim();
			if (!trimmed.startsWith('[[')) continue;
			const lines = trimmed.split('\n');
			const header = lines[0].trim();
			
			if (binding.type === 'kv' && header.startsWith('[[kv_namespaces]]')) {
				if (lines.some(line => line.match(new RegExp(`binding\\s*=\\s*["']${binding.name}["']`)))) {
					exists = true;
					break;
				}
			}
			if (binding.type === 'r2' && header.startsWith('[[r2_buckets]]')) {
				if (lines.some(line => line.match(new RegExp(`binding\\s*=\\s*["']${binding.name}["']`)))) {
					exists = true;
					break;
				}
			}
			if (binding.type === 'do' && header.startsWith('[[durable_objects.bindings]]')) {
				if (lines.some(line => line.match(new RegExp(`name\\s*=\\s*["']${binding.name}["']`)))) {
					exists = true;
					break;
				}
			}
		}
		
		if (exists) return content;
		
		let appendText = '';
		if (binding.type === 'kv') {
			appendText = `\n\n[[kv_namespaces]]\nbinding = "${binding.name}"\nid = "placeholder-id"`;
		} else if (binding.type === 'r2') {
			appendText = `\n\n[[r2_buckets]]\nbinding = "${binding.name}"\nbucket_name = "${binding.name}"`;
		} else if (binding.type === 'do') {
			const className = binding.extra?.class || binding.name;
			appendText = `\n\n[[durable_objects.bindings]]\nname = "${binding.name}"\nclass_name = "${className}"`;
		}
		return content.trimEnd() + appendText + '\n';
	}
}

/**
 * Mutates JSON/JSONC config string by parsing and regenerating formatting.
 */
export function mutateJsonConfig(content: string, action: 'add' | 'remove', binding: { type: 'kv' | 'do' | 'r2'; name: string; extra?: any }): string {
	const data = parseCleanJson(content);
	
	if (action === 'remove') {
		if (binding.type === 'kv' && Array.isArray(data.kv_namespaces)) {
			data.kv_namespaces = data.kv_namespaces.filter((kv: any) => kv?.binding !== binding.name);
		} else if (binding.type === 'r2' && Array.isArray(data.r2_buckets)) {
			data.r2_buckets = data.r2_buckets.filter((r2: any) => r2?.binding !== binding.name);
		} else if (binding.type === 'do' && data.durable_objects && Array.isArray(data.durable_objects.bindings)) {
			data.durable_objects.bindings = data.durable_objects.bindings.filter((dobj: any) => dobj?.name !== binding.name);
		}
	} else {
		if (binding.type === 'kv') {
			if (!Array.isArray(data.kv_namespaces)) data.kv_namespaces = [];
			if (!data.kv_namespaces.some((kv: any) => kv?.binding === binding.name)) {
				data.kv_namespaces.push({ binding: binding.name, id: "placeholder-id" });
			}
		} else if (binding.type === 'r2') {
			if (!Array.isArray(data.r2_buckets)) data.r2_buckets = [];
			if (!data.r2_buckets.some((r2: any) => r2?.binding === binding.name)) {
				data.r2_buckets.push({ binding: binding.name, bucket_name: binding.name });
			}
		} else if (binding.type === 'do') {
			if (!data.durable_objects) data.durable_objects = {};
			if (!Array.isArray(data.durable_objects.bindings)) data.durable_objects.bindings = [];
			if (!data.durable_objects.bindings.some((dobj: any) => dobj?.name === binding.name)) {
				const className = binding.extra?.class || binding.name;
				data.durable_objects.bindings.push({ name: binding.name, class_name: className });
			}
		}
	}
	return JSON.stringify(data, null, 2);
}

export { uiState };



