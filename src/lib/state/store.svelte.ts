/**
 * store.svelte.ts
 *
 * Summary: Reactive global state store using Svelte 5 Runes ($state, $derived) to manage nodes, edges, file sync, and mutation operations.
 * Expects: User events (drag, save, add column) and filesystem state changes.
 * Output: Synchronized database schema file state and Svelte Flow configurations.
 */
import { type Node, type Edge } from '@xyflow/svelte';
import { PlatformService } from "#lib/services/platform";
import { createStateMachine } from "#lib/state/fsm";
import { OperationQueue } from "#lib/state/queue";
import { toast } from "svelte-sonner";

import { resolveRelativePath } from "#lib/parser";
import type { AuditIssue } from "#lib/parser/types";
import { uiState } from "#lib/state/uiStore.svelte";


/**
 * State-machine JSONC parser.
 * Strips line comments (//) and block comments (/* *\/) and trailing commas safely
 * while preserving string literals (e.g. URLs, description text with commas).
 */
export function parseCleanJson(text: string): any {
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

		// String boundary
		if (char === '"' || char === "'") {
			inString = true;
			quoteChar = char;
			out += char;
			i++;
			continue;
		}

		// Line comment //
		if (char === '/' && nextChar === '/') {
			i += 2;
			while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++;
			continue;
		}

		// Block comment /* */
		if (char === '/' && nextChar === '*') {
			i += 2;
			while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
			i += 2;
			continue;
		}

		// Trailing comma check outside strings: if comma is followed only by whitespace/comments before } or ], skip it
		if (char === ',') {
			let lookAhead = i + 1;
			let isTrailing = false;
			while (lookAhead < text.length) {
				const laChar = text[lookAhead];
				const laNext = text[lookAhead + 1];
				if (laChar === ' ' || laChar === '\t' || laChar === '\n' || laChar === '\r') {
					lookAhead++;
					continue;
				}
				if (laChar === '/' && laNext === '/') {
					lookAhead += 2;
					while (lookAhead < text.length && text[lookAhead] !== '\n' && text[lookAhead] !== '\r') lookAhead++;
					continue;
				}
				if (laChar === '/' && laNext === '*') {
					lookAhead += 2;
					while (lookAhead < text.length && !(text[lookAhead] === '*' && text[lookAhead + 1] === '/')) lookAhead++;
					lookAhead += 2;
					continue;
				}
				if (laChar === '}' || laChar === ']') {
					isTrailing = true;
				}
				break;
			}
			if (isTrailing) {
				i++;
				continue;
			}
		}

		out += char;
		i++;
	}

	return JSON.parse(out);
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
			externalFilesMap.set(resolvedPath, extRaw);
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
			externalFilesMap.set(resolvedPath, extRaw);
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

async function findProjectRoot(filePath: string): Promise<string> {
	const normalized = filePath.replace(/\\/g, '/');
	const lastSlash = normalized.lastIndexOf('/');
	const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : normalized;
	let currentDir = dir;
	for (let depth = 0; depth < 8; depth++) {
		for (const marker of ['package.json', 'drizzle.config.ts', 'drizzle.config.js', '.git']) {
			try {
				const exists = await PlatformService.readText(currentDir + '/' + marker);
				if (exists) return currentDir;
			} catch {}
		}
		const pSlash = currentDir.lastIndexOf('/');
		if (pSlash <= 0) break;
		currentDir = currentDir.substring(0, pSlash);
	}
	return dir;
}

async function discoverWranglerBindings(filePath: string, customWranglerPath?: string): Promise<{
	bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[];
	configFilePath: string | null;
}> {
	if (!filePath) return { bindings: [], configFilePath: null };
	const normalized = filePath.replace(/\\/g, '/');
	const lastSlash = normalized.lastIndexOf('/');
	let dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : normalized;
	
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
 * Preserves selection state and in-memory node positions across re-parses.
 */
function mapNodesWithExternalPositions(nodes: Node[], filePath: string, selectedNodeIds: Set<string>, existingNodes: Node[]): Node[] {
	return nodes.map(n => {
		const existing = existingNodes.find(ex => ex.id === n.id);
		const position = existing ? { x: existing.position.x, y: existing.position.y } : { x: n.position.x, y: n.position.y };
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

	/** Convenient getter to retrieve the active inspector node object */
	get activeInspectorNode() {
		if (!this.activeInspectorNodeId) return undefined;
		return this.nodes.find(n => n.id === this.activeInspectorNodeId);
	}

	get selectedNode() {
		return this.activeInspectorNode;
	}

	/** Selection coordinates of the currently active/dragged node */
	get activeCoordinates() { return uiState.activeCoordinates; }
	set activeCoordinates(val: { x: number; y: number } | null) { uiState.activeCoordinates = val; }

	/** The ID of the node currently hovered */
	get hoveredNodeId() { return uiState.hoveredNodeId; }
	set hoveredNodeId(val: string | null) { uiState.hoveredNodeId = val; }

	/** Whether compact mode is currently active (keys only) */
	get compactMode() { return uiState.compactMode; }
	set compactMode(val: boolean) { uiState.compactMode = val; }


	// --- File State ---
	/** Absolute path to the currently open schema.ts file */
	filePath = $state<string | null>(null);
	/** HTML-wrapped code preview of the schema.ts file */
	rawCode = $state('');
	/** Reactive list of recently opened files */
	recentFiles = $state<string[]>([]);
	/** Timestamp of the last local disk write to prevent watcher feedback loops */
	lastWriteTime = 0;
	
	/** In-memory cache of loaded external schema files for multi-file projects */
	externalFilesMap = new Map<string, string>();

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

	/** Sandbox / Playground Mode State */
	get isSandboxMode() { return uiState.isSandboxMode; }
	set isSandboxMode(val: boolean) { uiState.isSandboxMode = val; }

	get sandboxTemplateKey() { return uiState.sandboxTemplateKey; }
	set sandboxTemplateKey(val: string) { uiState.sandboxTemplateKey = val; }

	/** Rename Entity Modal State */
	get showRenameModal() { return uiState.showRenameModal; }
	set showRenameModal(val: boolean) { uiState.showRenameModal = val; }

	get renameEntityTargetId() { return uiState.renameEntityTargetId; }
	set renameEntityTargetId(val: string | null) { uiState.renameEntityTargetId = val; }

	/** Confirmation Dialog Modal State */
	get showConfirmModal() { return uiState.showConfirmModal; }
	set showConfirmModal(val: boolean) { uiState.showConfirmModal = val; }

	get confirmModalData() { return uiState.confirmModalData; }
	set confirmModalData(val: { title: string; message: string; confirmLabel: string; isDanger?: boolean; onConfirm: () => void } | null) { uiState.confirmModalData = val; }

	/** Triggers the styled Rename Entity Modal */
	promptRenameEntity(targetId: string) {
		uiState.renameEntityTargetId = targetId;
		uiState.showRenameModal = true;
	}

	/** Triggers the styled Confirmation Modal */
	promptConfirm(data: { title: string; message: string; confirmLabel: string; isDanger?: boolean; onConfirm: () => void }) {
		uiState.confirmModalData = data;
		uiState.showConfirmModal = true;
	}

	/** Whether the 'New Table' modal is currently visible */
	get showNewTableModal() { return uiState.showNewTableModal; }
	set showNewTableModal(val: boolean) { uiState.showNewTableModal = val; }

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

	/** List of JSDoc and AST audit issues */
	auditIssues = $state<AuditIssue[]>([]);

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

	/** Total count of audit issues (errors + warnings) */
	get totalAuditCount() {
		return this.auditIssues.length + this.validationWarnings.length;
	}

	/** Count of critical/error audit issues */
	get auditErrorCount() {
		return this.auditIssues.filter(i => i.severity === 'error' || i.severity === 'critical').length;
	}

	/** Count of warning audit issues */
	get auditWarningCount() {
		return this.auditIssues.filter(i => i.severity === 'warning').length + this.validationWarnings.length;
	}

	/** Whether the schema is a multi-file/modular project (e.g. schema/index.ts re-exporting domain files) */
	get isModular(): boolean {
		return this.externalFilesMap.size > 0 || this.nodes.some(n => {
			const mi = (n.data as any)?.moduleInfo;
			return mi && !mi.isRootFile;
		});
	}

	/** Returns available domain module files in the current modular project */
	get availableModules(): { name: string; filePath: string }[] {
		const modules = new Map<string, string>();
		for (const n of this.nodes) {
			const mi = (n.data as any)?.moduleInfo;
			if (mi?.sourceFilePath && !mi.isRootFile) {
				const name = mi.sourceFilePath.split('/').pop() || mi.sourceFilePath;
				modules.set(mi.sourceFilePath, name);
			}
		}
		for (const key of this.externalFilesMap.keys()) {
			if (key.startsWith('/') && key.endsWith('.ts')) {
				if (this.filePath && key === this.filePath) continue;
				const name = key.split('/').pop() || key;
				if (!modules.has(key)) {
					modules.set(key, name);
				}
			}
		}
		return Array.from(modules.entries()).map(([filePath, name]) => ({ filePath, name }));
	}

	/**
	 * Auto-repairs malformed or missing @strata JSDoc for a given node symbol.
	 */
	async repairNodeJsdoc(symbolName: string) {
		const node = this.nodes.find(n => n.id === symbolName);
		if (!node) return;
		const x = node.position.x || 100;
		const y = node.position.y || 100;
		const targetFilePath = this.getTargetFilePath(symbolName);
		const isTargetExternal = Boolean(targetFilePath && this.filePath && targetFilePath !== this.filePath);
		
		const { updateNodePositionInSchema } = await import("../parser");
		let currentCode = this.rawCode;
		if (isTargetExternal && targetFilePath) {
			currentCode = this.externalFilesMap.get(targetFilePath) || await PlatformService.readText(targetFilePath);
		}
		const updatedCode = updateNodePositionInSchema(currentCode, symbolName, x, y);
		if (targetFilePath && !this.isSandboxMode) {
			await this.queue.enqueue(async () => {
				this.lastWriteTime = Date.now();
				await PlatformService.writeText(targetFilePath, updatedCode);
				if (isTargetExternal) {
					this.externalFilesMap.set(targetFilePath, updatedCode);
					await this.parseAndApply(this.rawCode);
				} else {
					this.rawCode = updatedCode;
					await this.parseAndApply(updatedCode);
				}
			});
		} else {
			if (isTargetExternal && targetFilePath) {
				this.externalFilesMap.set(targetFilePath, updatedCode);
				await this.parseAndApply(this.rawCode);
			} else {
				this.rawCode = updatedCode;
				await this.parseAndApply(updatedCode);
			}
		}
		toast.success("JSDoc Repaired", {
			description: `Cleaned and formatted @strata metadata for "${symbolName}".`
		});
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
		
		if (this.filePath && ((initialResult.externalImports && initialResult.externalImports.length > 0) || (initialResult.externalPaths && initialResult.externalPaths.length > 0))) {
			externalFilesMap = await loadExternalSchemas(this.filePath, initialResult.externalImports, initialResult.externalPaths);
		}
		this.externalFilesMap = externalFilesMap;

		// 2. Final parse with external file contents mapped
		const result = parseSchema(code, externalFilesMap, tsconfigPaths, tsconfigPath, this.filePath || undefined);
		this.auditIssues = result.auditIssues || [];
		
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
			const { bindings: wranglerBindings, configFilePath } = this.filePath 
				? await discoverWranglerBindings(this.filePath, this.wranglerPath)
				: { bindings: [], configFilePath: null };
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
			this.nodes = mapNodesWithExternalPositions(finalNodes, this.filePath || 'sandbox', selectedNodeIds, this.nodes);
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

				// Check if any external modular file has changed on disk compared to cached contents
				let hasExternalChanges = false;
				if (this.externalFilesMap.size > 0 && this.filePath) {
					const checked = new Set<string>();
					for (const [p, cachedContent] of this.externalFilesMap.entries()) {
						const resolved = resolveRelativePath(this.filePath, p);
						if (checked.has(resolved)) continue;
						checked.add(resolved);
						try {
							const diskContent = await PlatformService.readText(resolved);
							if (diskContent !== cachedContent) {
								hasExternalChanges = true;
								break;
							}
						} catch {
							hasExternalChanges = true;
							break;
						}
					}
				}

				if (raw === this.rawCode && !hasExternalChanges && this.isValid) {
					// Prevent duplicate syncing/parsing if code and external modules match local state
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
				this.errorType = 'disk';
				this.isValid = false;
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
	 * Loads a starter schema template into zero-risk in-memory sandbox mode.
	 */
	async loadSandboxDemo(templateKey: string = 'fullstack') {
		const { SAMPLE_TEMPLATES } = await import("#lib/mock");
		const template = SAMPLE_TEMPLATES[templateKey] || SAMPLE_TEMPLATES.fullstack;

		this.isSandboxMode = true;
		this.sandboxTemplateKey = templateKey;
		this.filePath = null;
		this.machine.send("OPEN");

		const success = await this.parseAndApply(template.code);
		if (success) {
			this.machine.send("SUCCESS");
			toast.success(`Loaded ${template.name}`, {
				description: "Playground mode active: Edits run strictly in-memory."
			});
		} else {
			this.machine.send("FAIL");
		}
	}

	/**
	 * Opens a schema file directly from recent history or ingests a drizzle.config.ts.
	 */
	async openFileDirectly(path: string) {
		this.isSandboxMode = false;
		let targetPath = path;

		if (path.endsWith('drizzle.config.ts')) {
			try {
				const configContent = await PlatformService.readText(path);
				const { parseDrizzleConfigSchemaPath } = await import("../parser");
				const resolvedSchema = parseDrizzleConfigSchemaPath(configContent, path);
				if (resolvedSchema) {
					targetPath = resolvedSchema;
					toast.info("Drizzle Config Ingested", {
						description: `Resolved schema: ${targetPath}`
					});
				}
			} catch (err) {
				console.warn("[Strata] Failed to parse drizzle.config.ts schema path:", err);
			}
		}

		this.filePath = targetPath;
		this.machine.send("OPEN");
		await this.syncWithFile();
	}

	/**
	 * Opens a native file dialog to select a Drizzle schema file or drizzle.config.ts and syncs it.
	 */
	async openNewFile() {
		try {
			const defaultPath = this.getDefaultDialogPath();
			const selected = await PlatformService.selectFile(["ts"], defaultPath);
			if (selected) {
				await this.openFileDirectly(selected);
			}
		} catch (err) {
			console.error("[Strata] File open failed:", err);
		}
	}

	/**
	 * Returns the source file defining a specific table/entity, or falls back to root schema.
	 */
	private getTargetFilePath(tableName: string): string | undefined {
		const node = this.nodes.find(n => n.id === tableName);
		return (node?.data as any)?.moduleInfo?.sourceFilePath || this.filePath || undefined;
	}

	/**
	 * Safely executes a schema-changing write operation with unified FSM state management and file writing.
	 * Supports writing directly to modular domain files (e.g. users.ts, posts.ts) or the root schema.
	 */
	private async executeSchemaMutation(
		operationName: string,
		mutateFn: (code: string) => string | Promise<string>,
		targetFilePath?: string
	): Promise<void> {
		await this.queue.enqueue(async () => {
			if (!this.filePath && !this.isSandboxMode) return;
			this.machine.send("SAVE");
			try {
				const isTargetExternal = Boolean(
					targetFilePath && this.filePath && targetFilePath !== this.filePath
				);
				const fileToMutate = isTargetExternal ? targetFilePath! : this.filePath;
				let currentCode = this.rawCode;

				if (isTargetExternal) {
					let extCode = this.externalFilesMap.get(targetFilePath!);
					if (!extCode) {
						extCode = await PlatformService.readText(targetFilePath!);
					}
					currentCode = extCode;
				}

				const newCode = await mutateFn(currentCode);

				if (!this.isSandboxMode && fileToMutate) {
					this.ignoreNextWatch = true;
					this.lastWriteTime = Date.now();
					await PlatformService.writeText(fileToMutate, newCode);
				}

				if (isTargetExternal) {
					this.externalFilesMap.set(targetFilePath!, newCode);
					const success = await this.parseAndApply(this.rawCode);
					if (success) {
						this.machine.send("SUCCESS");
					} else {
						this.machine.send("FAIL");
					}
				} else {
					this.rawCode = newCode;
					const success = await this.parseAndApply(newCode);
					if (success) {
						this.machine.send("SUCCESS");
					} else {
						this.machine.send("FAIL");
					}
				}
			} catch (e: any) {
				console.error(`[Strata] ${operationName} failed:`, e);
				this.error = e.message;
				this.errorType = this.isSandboxMode ? 'parse' : 'disk';
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
		const targetFile = this.getTargetFilePath(tableName);
		const { updateColumnModifiersInSchema } = await import("../parser");
		await this.executeSchemaMutation("Column modifier update", (code) => 
			updateColumnModifiersInSchema(code, tableName, columnName, modifiers),
			targetFile
		);
	}

	/**
	 * Updates table/target JSDoc configuration metadata (e.g. public access, CORS for R2 buckets) and syncs to disk.
	 */
	async updateTableMetadata(tableName: string, metadata: { public?: boolean; customDomain?: string | null; cors?: boolean; class?: string; path?: string }) {
		const targetFile = this.getTargetFilePath(tableName);
		const { updateTableMetadataInSchema } = await import("../parser");
		await this.executeSchemaMutation("Table metadata update", (code) => 
			updateTableMetadataInSchema(code, tableName, metadata),
			targetFile
		);
	}

	/**
	 * Deletes a column from a table in the schema and syncs to disk.
	 */
	async deleteColumn(tableName: string, colName: string) {
		const targetFile = this.getTargetFilePath(tableName);
		const { removeColumnFromSchema } = await import("../parser");
		await this.executeSchemaMutation("Column delete", (code) => 
			removeColumnFromSchema(code, tableName, colName, targetFile),
			targetFile
		);
	}

	/**
	 * Deletes an entire table/entity from the schema and syncs to disk.
	 */
	async deleteTable(tableName: string) {
		const node = this.nodes.find(n => n.id === tableName);
		const target = (node?.data as any)?.target || 'd1';
		const targetFile = this.getTargetFilePath(tableName);

		const { removeTableFromSchema, removeTableFromLayoutManifest } = await import("../parser");
		await this.executeSchemaMutation("Table delete", (code) => 
			removeTableFromSchema(code, tableName),
			targetFile
		);
		if (this.filePath && targetFile !== this.filePath && this.rawCode.includes('@strata-layout')) {
			const updatedRootCode = removeTableFromLayoutManifest(this.rawCode, tableName);
			if (updatedRootCode !== this.rawCode) {
				this.rawCode = updatedRootCode;
				await PlatformService.writeText(this.filePath, updatedRootCode);
			}
		}
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
		const { removeEdgeFromSchema, resolveRelativePath } = await import("../parser");
		
		const matchingEdge = this.edges.find(e => 
			e.source === source && e.target === target && 
			(name ? (e.label === name || e.sourceHandle === name || (e.data as any)?.sourceCol === name) : true)
		);
		const isVirtual = matchingEdge?.data?.isVirtual ?? false;

		let targetFile: string | undefined;

		if (this.externalFilesMap.size > 0 && this.filePath) {
			if (isVirtual) {
				// For logical relations, find the file containing ${source}Relations
				for (const [filePath, content] of this.externalFilesMap.entries()) {
					if (content.includes(`${source}Relations`)) {
						targetFile = resolveRelativePath(this.filePath, filePath);
						break;
					}
				}
			} else {
				// For physical FK, check if source file has FK; if not, check if an external file defines relations
				const sourceFile = this.getTargetFilePath(source);
				const sourceContent = sourceFile ? this.externalFilesMap.get(sourceFile) : undefined;
				if (!sourceContent || (!sourceContent.includes(`${target}.`) && !sourceContent.includes('references('))) {
					for (const [filePath, content] of this.externalFilesMap.entries()) {
						if (content.includes(`${source}Relations`)) {
							targetFile = resolveRelativePath(this.filePath, filePath);
							break;
						}
					}
				}
			}
		}

		if (!targetFile) {
			targetFile = this.getTargetFilePath(source) || this.filePath || undefined;
		}

		await this.executeSchemaMutation("Relation delete", (code) => 
			removeEdgeFromSchema(code, source, target, name),
			targetFile
		);
	}

	/**
	 * Persists the current rawCode to disk, including any pending node position updates.
	 */
	async saveToFile() {
		if (this.isSandboxMode) {
			toast.info("Playground Sandbox Active", {
				description: "Playground edits run in-memory. Click 'Open Schema' to edit a real file on disk."
			});
			return;
		}

		if (!this.filePath || this.machine.current === "BUSY") return;
		
		await this.executeSchemaMutation("Save", async (code) => {
			let currentCode = code;
			const { updateAllNodePositionsInSchema, updateLayoutManifestInSchema } = await import("../parser");
			
			const isModular = this.externalFilesMap.size > 0 || this.nodes.some(n => {
				const info = (n.data as any)?.moduleInfo;
				return info && !info.isRootFile;
			});

			if (isModular) {
				const positionsMap: Record<string, { x: number; y: number }> = {};
				for (const node of this.nodes) {
					positionsMap[node.id] = {
						x: Math.round(node.position.x),
						y: Math.round(node.position.y)
					};
				}
				// Write consolidated layout manifest directly into root index.ts
				currentCode = updateLayoutManifestInSchema(currentCode, positionsMap, true);
				// Domain files (users.ts, posts.ts) remain 100% clean in Git diffs!
			} else {
				currentCode = updateAllNodePositionsInSchema(currentCode, this.nodes);
			}
			return currentCode;
		});

		this.isRecentlySaved = true;
		setTimeout(() => (this.isRecentlySaved = false), 1500);
	}

	async renameTable(oldName: string, newName: string) {
		const node = this.nodes.find(n => n.id === oldName);
		const target = (node?.data as any)?.target || 'd1';
		const extra = (node?.data as any)?.strata || {};
		const targetFile = this.getTargetFilePath(oldName);

		const { renameTableInSchema, renameTableInLayoutManifest } = await import("../parser");
		await this.executeSchemaMutation("Table rename", (code) => 
			renameTableInSchema(code, oldName, newName),
			targetFile
		);
		if (this.filePath && targetFile !== this.filePath && this.rawCode.includes('@strata-layout')) {
			const updatedRootCode = renameTableInLayoutManifest(this.rawCode, oldName, newName);
			if (updatedRootCode !== this.rawCode) {
				this.rawCode = updatedRootCode;
				await PlatformService.writeText(this.filePath, updatedRootCode);
			}
		}
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
		const targetFile = this.getTargetFilePath(tableName);
		const { renameColumnInSchema } = await import("../parser");
		await this.executeSchemaMutation("Column rename", (code) => 
			renameColumnInSchema(code, tableName, oldColName, newColName, targetFile),
			targetFile
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
	 * Supports targeting a new module file, an existing domain module, or the root schema.
	 */
	async addTable(
		tableName: string, 
		target: 'd1' | 'do' | 'kv' | 'r2' = 'd1', 
		extra?: { class?: string; path?: string; id?: string; bucket_name?: string },
		moduleDestination?: { mode: 'root' | 'existing' | 'new'; targetModule?: string }
	) {
		const { addTableToSchema, createD1ModuleCode, addReExportToBarrel, updateLayoutManifestInSchema } = await import("../parser");

		if (target === 'd1' && moduleDestination && moduleDestination.mode === 'new' && this.filePath) {
			const baseDir = this.filePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
			let fileName = moduleDestination.targetModule?.trim() || `${tableName}.ts`;
			if (!fileName.endsWith('.ts')) fileName += '.ts';
			const newFilePath = `${baseDir}/${fileName}`;
			const relativeSpecifier = `./${fileName.replace(/\.ts$/, '')}`;

			const newModuleCode = createD1ModuleCode(tableName);

			this.ignoreNextWatch = true;
			await PlatformService.writeText(newFilePath, newModuleCode);
			this.externalFilesMap.set(newFilePath, newModuleCode);
			this.externalFilesMap.set(relativeSpecifier, newModuleCode);

			await this.executeSchemaMutation("Add table export", (rootCode) => {
				let updated = addReExportToBarrel(rootCode, relativeSpecifier);
				const initialPos = {
					x: Math.round(Math.random() * 300) + 100,
					y: Math.round(Math.random() * 300) + 100
				};
				updated = updateLayoutManifestInSchema(updated, { [tableName]: initialPos }, false);
				return updated;
			});

			toast.success(`Module Created: ${fileName}`, {
				description: `Generated ${fileName} and added re-export to ${this.filePath.split('/').pop()}.`
			});
			return;
		}

		if (target === 'd1' && moduleDestination && moduleDestination.mode === 'existing' && moduleDestination.targetModule) {
			const targetFile = moduleDestination.targetModule;
			await this.executeSchemaMutation("Table add", (code) =>
				addTableToSchema(code, tableName, target, extra),
				targetFile
			);

			if (this.filePath && targetFile !== this.filePath) {
				const rootCode = this.rawCode;
				const initialPos = {
					x: Math.round(Math.random() * 300) + 100,
					y: Math.round(Math.random() * 300) + 100
				};
				const updatedRoot = updateLayoutManifestInSchema(rootCode, { [tableName]: initialPos }, false);
				if (updatedRoot !== rootCode) {
					await this.executeSchemaMutation("Update layout manifest", () => updatedRoot);
				}
			}

			toast.success(`Table Added to ${targetFile.split('/').pop()}`, {
				description: `Added "${tableName}" to ${targetFile.split('/').pop()}.`
			});
			return;
		}

		await this.executeSchemaMutation("Table add", (code) => 
			addTableToSchema(code, tableName, target, extra)
		);

		if (target !== 'd1') {
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
		const targetFile = this.getTargetFilePath(tableName);
		let targetImportPath: string | undefined;
		if (referencesTable) {
			const refFile = this.getTargetFilePath(referencesTable);
			if (targetFile && refFile && targetFile !== refFile) {
				const { getRelativeImportSpecifier } = await import("../parser");
				targetImportPath = getRelativeImportSpecifier(targetFile, refFile);
			}
		}
		const { addColumnToSchema } = await import("../parser");
		await this.executeSchemaMutation("Column add", (code) => 
			addColumnToSchema(code, tableName, columnName, type, referencesTable, referencesColumn, targetFile, targetImportPath),
			targetFile
		);
	}

	/**
	 * Adds a relation/edge to the schema and syncs to disk.
	 */
	async addRelation(source: string, target: string) {
		const sourceFile = this.getTargetFilePath(source);
		const targetFile = this.getTargetFilePath(target);
		let targetImportPath: string | undefined;
		if (sourceFile && targetFile && sourceFile !== targetFile) {
			const { getRelativeImportSpecifier } = await import("../parser");
			targetImportPath = getRelativeImportSpecifier(sourceFile, targetFile);
		}
		const { addEdgeToSchema } = await import("../parser");
		await this.executeSchemaMutation("Relation add", (code) => 
			addEdgeToSchema(code, source, target, targetImportPath),
			sourceFile
		);
	}

	/**
	 * Adds or updates a physical Foreign Key relationship (.references()) on a specific column.
	 * Checks for duplicate relationships before executing AST mutation.
	 */
	async addForeignKeyRelation(sourceTable: string, sourceCol: string, targetTable: string, targetCol: string = 'id') {
		const existingEdge = this.edges.find(e => 
			(e.source === sourceTable && e.target === targetTable) &&
			((e.data as any)?.sourceCol === sourceCol || e.sourceHandle === sourceCol)
		);
		if (existingEdge) {
			toast.info("Relationship Already Exists", {
				description: `A relationship between "${sourceTable}" (${sourceCol}) and "${targetTable}" already exists.`
			});
			return;
		}

		const sourceFile = this.getTargetFilePath(sourceTable);
		const targetFile = this.getTargetFilePath(targetTable);
		let targetImportPath: string | undefined;
		if (sourceFile && targetFile && sourceFile !== targetFile) {
			const { getRelativeImportSpecifier } = await import("../parser");
			targetImportPath = getRelativeImportSpecifier(sourceFile, targetFile);
		}

		const { addForeignKeyToColumnInSchema } = await import("../parser");
		await this.executeSchemaMutation("Foreign Key add", (code) => 
			addForeignKeyToColumnInSchema(code, sourceTable, sourceCol, targetTable, targetCol, targetImportPath),
			sourceFile
		);
	}

	/**
	 * Scaffolds the standard Better Auth D1 cluster (user, session, account, verification).
	 */
	async scaffoldBetterAuthCluster() {
		const { scaffoldBetterAuthClusterInSchema } = await import("../parser");
		await this.executeSchemaMutation("Scaffold Better Auth", (code) =>
			scaffoldBetterAuthClusterInSchema(code)
		);
		toast.success("Better Auth Cluster Scaffolding Complete", {
			description: "Generated user, session, account, and verification tables in your D1 schema."
		});
	}

	/**
	 * Scaffolds a local D1 mirror table for webhook sync with Clerk or WorkOS.
	 */
	async scaffoldWebhookMirror(provider: "clerk" | "workos") {
		if (provider === "clerk") {
			const { scaffoldClerkMirrorTableInSchema } = await import("../parser");
			await this.executeSchemaMutation("Scaffold Clerk Mirror", (code) =>
				scaffoldClerkMirrorTableInSchema(code, "clerkUsers")
			);
			toast.success("Clerk Webhook Mirror Scaffolding Complete", {
				description: 'Generated "clerkUsers" mirror table in your D1 schema.'
			});
		} else {
			const { scaffoldWorkOSMirrorTableInSchema } = await import("../parser");
			await this.executeSchemaMutation("Scaffold WorkOS Mirror", (code) =>
				scaffoldWorkOSMirrorTableInSchema(code, "workosUsers")
			);
			toast.success("WorkOS Webhook Mirror Scaffolding Complete", {
				description: 'Generated "workosUsers" mirror table in your D1 schema.'
			});
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
		this.externalFilesMap.clear();
		this.isValid = true;
		this.error = null;
		this.activeInspectorNodeId = null;
		this.isSandboxMode = false;
		this.machine.send("RESET");
	}

	/**
	 * Closes the currently open schema or sandbox mode, returning to the Welcome screen overlay.
	 */
	closeFile() {
		this.reset();
	}

	/**
	 * Clears all saved recent files from localStorage and memory state.
	 */
	clearRecentFiles() {
		this.recentFiles = [];
		if (typeof window !== 'undefined' && window.localStorage) {
			try {
				window.localStorage.removeItem('strata_recent_files');
			} catch (e) {}
		}
	}

	/**
	 * Clears recent files cache and resets state back to empty Welcome screen.
	 */
	closeFileAndClearRecent() {
		this.clearRecentFiles();
		this.closeFile();
	}

	/**
	 * Automatically syncs all missing KV, DO, or R2 target bindings to the project's wrangler configuration file.
	 */
	async syncMissingWranglerBindings() {
		if (this.isSandboxMode) {
			toast.info("Sandbox Playground Active", {
				description: "Wrangler binding files (wrangler.toml/jsonc) operate in-memory while in Sandbox Mode. All node operations work seamlessly!"
			});
			return;
		}

		if (!this.wranglerConfigFilePath && this.filePath) {
			const rootDir = await findProjectRoot(this.filePath);
			const newWranglerPath = rootDir + '/wrangler.toml';
			try {
				await PlatformService.writeText(newWranglerPath, `# Wrangler Configuration generated by Strata\nname = "my-cloudflare-worker"\ncompatibility_date = "2024-01-01"\n`);
				this.wranglerConfigFilePath = newWranglerPath;
				toast.info("Created wrangler.toml", {
					description: "Auto-generated wrangler.toml in project root."
				});
			} catch (e: any) {
				toast.error("Failed to create wrangler.toml", {
					description: e?.message || String(e)
				});
				return;
			}
		}

		if (!this.wranglerConfigFilePath) return;

		const unconfiguredNodes = this.nodes.filter(n => {
			const target = (n.data as any)?.target;
			if (!target || target === 'd1') return false;
			return !this.wranglerBindings.some(b => b.name === n.id && b.type === target);
		});

		if (unconfiguredNodes.length === 0) {
			toast.success("Wrangler Config Aligned", {
				description: "All entity targets are configured."
			});
			return;
		}

		for (const node of unconfiguredNodes) {
			const target = (node.data as any).target;
			const extra = (node.data as any).strata || {};
			await this.syncToWranglerConfig('add', { type: target, name: node.id, extra });
		}

		toast.success("Wrangler Configuration Updated", {
			description: `Added ${unconfiguredNodes.length} missing binding configuration(s).`
		});
	}

	/**
	 * Synchronizes target modifications (KV/DO/R2 additions or deletions) directly to wrangler.toml or wrangler.jsonc.
	 */
	async syncToWranglerConfig(
		action: 'add' | 'remove',
		binding: { type: 'kv' | 'do' | 'r2'; name: string; extra?: any }
	) {
		if (this.isSandboxMode) return;
		
		// Auto-generate wrangler.toml if missing when adding a binding to a local file
		if (!this.wranglerConfigFilePath && action === 'add' && this.filePath) {
			const rootDir = await findProjectRoot(this.filePath);
			const newWranglerPath = rootDir + '/wrangler.toml';
			try {
				await PlatformService.writeText(newWranglerPath, `# Wrangler Configuration generated by Strata\nname = "my-cloudflare-worker"\ncompatibility_date = "2024-01-01"\n`);
				this.wranglerConfigFilePath = newWranglerPath;
				toast.info("Created wrangler.toml", {
					description: `Auto-generated wrangler.toml in project root to store ${binding.type.toUpperCase()} binding.`
				});
			} catch (e: any) {
				console.error("[Strata] Failed to create wrangler.toml:", e);
			}
		}

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

export { uiState };




