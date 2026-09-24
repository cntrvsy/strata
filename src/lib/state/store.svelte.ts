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

import { resolveRelativePath, getRelativeImportSpecifier, createIsolatedProject, type StrataNode, type StrataEdge } from "#lib/parser";
import type { AuditIssue, PackageWrapperInfo } from "#lib/parser/types";
import { uiState } from "#lib/state/uiStore.svelte";

export type NodeHighlightStatus = 'self' | 'upstream' | 'downstream' | 'transitive' | 'dimmed' | 'normal';

export interface HighlightGraph {
	isActive: boolean;
	primaryActiveNodeId: string | null;
	activeNodeIds: Set<string>;
	getNodeHighlight: (nodeId: string) => NodeHighlightStatus;
	isEdgeActive: (edgeId: string) => boolean;
	isColumnHighlighted: (nodeId: string, colName: string) => boolean;
	isFocusLocked: boolean;
	focusLockedNodeId: string | null;
	highlightMode: 'direct' | 'transitive';
	connectedCount: number;
}


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
			// Non-blocking fallback: Check if path depth was miscalculated in a monorepo
			let resolvedFallback = false;
			try {
				const cleanSubPath = p.replace(/^(\.\.?\/)+/, '');
				if (cleanSubPath) {
					const workspaceRoot = await findWorkspaceRoot(basePath);
					const candidate = `${workspaceRoot}/${cleanSubPath}`;
					const extRaw = await PlatformService.readText(candidate);
					if (extRaw) {
						externalFilesMap.set(p, extRaw);
						externalFilesMap.set(candidate, extRaw);
						const correctedRel = getRelativeImportSpecifier(basePath, candidate);
						if (correctedRel) {
							externalFilesMap.set('__correction__' + p, correctedRel);
						}
						resolvedFallback = true;
					}
				}
			} catch {}

			if (!resolvedFallback) {
				console.warn(`[Strata] External asset not found at ${resolvedPath}`);
			}
		}
	}
	return externalFilesMap;
}

function parseWranglerBindings(tomlContent: string): { bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[]; main?: string } {
	const bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] = [];
	let main: string | undefined = undefined;
	const mainMatch = tomlContent.match(/^\s*main\s*=\s*["']([^"']+)["']/m);
	if (mainMatch) {
		main = mainMatch[1];
	}

	const blocks = tomlContent.split(/\[\[/);
	
	for (const block of blocks) {
		const lines = block.split('\n');
		const headerLine = lines[0].trim();
		
		if (headerLine.startsWith('kv_namespaces')) {
			let name = '';
			let id = '';
			for (const line of lines) {
				const match = line.match(/^\s*binding\s*=\s*["']([^"']+)["']/);
				if (match) {
					name = match[1];
				}
				const idMatch = line.match(/^\s*id\s*=\s*["']([^"']+)["']/);
				if (idMatch) {
					id = idMatch[1];
				}
			}
			if (name) {
				bindings.push({ type: 'kv', name, extra: { id: id || undefined } });
			}
		} else if (headerLine.startsWith('durable_objects.bindings')) {
			let name = '';
			let className = '';
			let scriptName = '';
			for (const line of lines) {
				const nameMatch = line.match(/^\s*name\s*=\s*["']([^"']+)["']/);
				if (nameMatch) {
					name = nameMatch[1];
				}
				const classMatch = line.match(/^\s*class_name\s*=\s*["']([^"']+)["']/);
				if (classMatch) {
					className = classMatch[1];
				}
				const scriptMatch = line.match(/^\s*script_name\s*=\s*["']([^"']+)["']/);
				if (scriptMatch) {
					scriptName = scriptMatch[1];
				}
			}
			if (name) {
				bindings.push({
					type: 'do',
					name,
					extra: {
						class: className,
						...(scriptName ? { script: scriptName } : {})
					}
				});
			}
		} else if (headerLine.startsWith('r2_buckets')) {
			let name = '';
			let bucketName = '';
			for (const line of lines) {
				const match = line.match(/^\s*binding\s*=\s*["']([^"']+)["']/);
				if (match) {
					name = match[1];
				}
				const bMatch = line.match(/^\s*bucket_name\s*=\s*["']([^"']+)["']/);
				if (bMatch) {
					bucketName = bMatch[1];
				}
			}
			if (name) {
				bindings.push({ type: 'r2', name, extra: { bucket_name: bucketName || undefined } });
			}
		}
	}
	return { bindings, main };
}

function parseJsonBindings(jsonContent: string): { bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[]; main?: string } {
	const bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[] = [];
	const trimmed = jsonContent.trim();
	if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
		return { bindings };
	}
	try {
		const data = parseCleanJson(jsonContent);
		const main = typeof data.main === 'string' ? data.main : undefined;

		if (Array.isArray(data.kv_namespaces)) {
			for (const kv of data.kv_namespaces) {
				if (kv && kv.binding) {
					bindings.push({
						type: 'kv',
						name: kv.binding,
						extra: {
							id: kv.id || undefined,
							binding: kv.binding
						}
					});
				}
			}
		}

		// Detect SQLite DO storage from migrations (e.g. new_sqlite_classes: ["TelemetrySessionDO"])
		const sqliteDoClasses = new Set<string>();
		if (Array.isArray(data.migrations)) {
			for (const mig of data.migrations) {
				if (Array.isArray(mig?.new_sqlite_classes)) {
					for (const cls of mig.new_sqlite_classes) {
						if (typeof cls === 'string') sqliteDoClasses.add(cls);
					}
				}
			}
		}

		if (data.durable_objects && Array.isArray(data.durable_objects.bindings)) {
			for (const dobj of data.durable_objects.bindings) {
				if (dobj && dobj.name) {
					const className = dobj.class_name || undefined;
					const isSqlite = className ? sqliteDoClasses.has(className) : false;
					bindings.push({
						type: 'do',
						name: dobj.name,
						extra: {
							class: className,
							storage: isSqlite ? 'sqlite' : 'kv',
							binding: dobj.name,
							...(dobj.script_name ? { script_name: dobj.script_name } : {})
						}
					});
				}
			}
		}
		if (Array.isArray(data.r2_buckets)) {
			for (const r2 of data.r2_buckets) {
				if (r2 && r2.binding) {
					bindings.push({
						type: 'r2',
						name: r2.binding,
						extra: {
							bucket_name: r2.bucket_name || undefined,
							binding: r2.binding
						}
					});
				}
			}
		}
		return { bindings, main };
	} catch (e) {
		console.warn("[Strata] Failed to parse JSON/JSONC wrangler config:", e);
	}
	return { bindings };
}

function parseWranglerContent(fileName: string, content: string): { bindings: { type: 'kv' | 'do' | 'r2'; name: string; extra: any }[]; main?: string } {
	if (fileName.endsWith('.json') || fileName.endsWith('.jsonc')) {
		return parseJsonBindings(content);
	}
	return parseWranglerBindings(content);
}

function extractClassMethodsFromCode(code: string, className?: string): { name: string; definition: string; isPk: boolean; notNull: boolean; isReferences: boolean }[] {
	try {
		const { sourceFile: sf } = createIsolatedProject('class_methods_check.ts', code);
		const classDecl = (className ? sf.getClass(className) : undefined) || sf.getClasses()[0];
		if (classDecl) {
			return (classDecl.getMethods() as any[])
				.filter((m: any) => m.getScope() === 'public' || !m.getScope())
				.map((m: any) => {
					const paramStr = (m.getParameters() as any[]).map((p: any) => p.getText()).join(', ');
					const retType = m.getReturnTypeNode()?.getText() || 'any';
					return {
						name: `${m.getName()}(${paramStr})`,
						definition: retType,
						isPk: false,
						notNull: false,
						isReferences: false
					};
				});
		}
	} catch {}
	return [];
}

/**
 * Option 1: Authoritative Cloudflare DO Class Resolution.
 * Inspects the Worker entrypoint (`main` in wrangler.jsonc / wrangler.toml) to discover
 * where the DO class is declared or re-exported, and dynamically extracts its RPC methods.
 */
async function resolveDurableObjectClassFromEntrypoint(
	wranglerDir: string,
	mainEntry: string | undefined,
	className: string
): Promise<{ filePath: string; methods: { name: string; definition: string; isPk: boolean; notNull: boolean; isReferences: boolean }[] } | null> {
	if (!className) return null;

	const entryCandidates = mainEntry 
		? [
			wranglerDir + '/' + mainEntry,
			wranglerDir + '/' + (mainEntry.endsWith('.ts') || mainEntry.endsWith('.js') ? mainEntry : mainEntry + '.ts'),
			wranglerDir + '/' + (mainEntry.endsWith('.ts') || mainEntry.endsWith('.js') ? mainEntry : mainEntry + '/index.ts'),
		]
		: [
			wranglerDir + '/src/index.ts',
			wranglerDir + '/src/worker.ts',
			wranglerDir + '/index.ts',
		];

	let mainPath: string | null = null;
	let mainContent: string | null = null;
	for (const candidate of entryCandidates) {
		try {
			const text = await PlatformService.readText(candidate);
			if (text) {
				mainPath = candidate;
				mainContent = text;
				break;
			}
		} catch {}
	}

	if (!mainPath || !mainContent) {
		// Convention fallback: check standard DO directories
		for (const candidate of [
			`${wranglerDir}/src/durable-objects/${className}.ts`,
			`${wranglerDir}/src/do/${className}.ts`,
			`${wranglerDir}/src/server/durable-objects/${className}.ts`,
			`${wranglerDir}/src/${className}.ts`,
		]) {
			try {
				const text = await PlatformService.readText(candidate);
				if (text) {
					const methods = extractClassMethodsFromCode(text, className);
					return { filePath: candidate, methods };
				}
			} catch {}
		}
		return null;
	}

	// 1. Check if class is declared directly in main
	const declaredMethods = extractClassMethodsFromCode(mainContent, className);
	if (declaredMethods.length > 0 || mainContent.includes(`class ${className}`)) {
		return { filePath: mainPath, methods: declaredMethods };
	}

	// 2. Check if main re-exports the class:
	// export { SessionDO } from './durable-objects/SessionDO'
	// export * from './durable-objects/SessionDO'
	try {
		const { sourceFile: sf } = createIsolatedProject('entrypoint.ts', mainContent);
		for (const exportDecl of sf.getExportDeclarations()) {
			const specifier = exportDecl.getModuleSpecifierValue();
			if (!specifier) continue;

			let matches = false;
			let targetClassName = className;

			const namedExports = exportDecl.getNamedExports();
			if (namedExports.length > 0) {
				for (const ne of namedExports) {
					const exportedName = ne.getAliasNode()?.getText() || ne.getName();
					if (exportedName === className) {
						matches = true;
						targetClassName = ne.getName();
						break;
					}
				}
			} else {
				// export * from './...'
				matches = true;
			}

			if (matches) {
				const baseDir = mainPath.substring(0, mainPath.lastIndexOf('/'));
				const targetBasePath = resolveRelativePath(baseDir + '/dummy.ts', specifier);
				for (const ext of ['', '.ts', '.js', '/index.ts', '/index.js']) {
					try {
						const candidateFile = targetBasePath + ext;
						const text = await PlatformService.readText(candidateFile);
						if (text) {
							const methods = extractClassMethodsFromCode(text, targetClassName);
							return { filePath: candidateFile, methods };
						}
					} catch {}
				}
			}
		}
	} catch (e) {
		console.warn('[Strata] Failed to inspect entrypoint export declarations:', e);
	}

	return null;
}

async function findWorkspaceRoot(filePath: string): Promise<string> {
	const normalized = filePath.replace(/\\/g, '/');
	const lastSlash = normalized.lastIndexOf('/');
	let currentDir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : normalized;

	let fallbackProjectRoot = currentDir;
	for (let depth = 0; depth < 12; depth++) {
		for (const marker of ['.git', 'pnpm-workspace.yaml']) {
			try {
				const exists = await PlatformService.readText(currentDir + '/' + marker);
				if (exists) return currentDir;
			} catch {}
		}

		try {
			const pkgContent = await PlatformService.readText(currentDir + '/package.json');
			if (pkgContent) {
				const parsed = parseCleanJson(pkgContent);
				if (parsed && (parsed.workspaces || parsed.private)) {
					fallbackProjectRoot = currentDir;
					if (parsed.workspaces) return currentDir;
				}
			}
		} catch {}

		const pSlash = currentDir.lastIndexOf('/');
		if (pSlash <= 0) break;
		currentDir = currentDir.substring(0, pSlash);
	}
	return fallbackProjectRoot;
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
				const parsed = parseWranglerContent(customWranglerPath, content);
				const wranglerDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
				for (const b of parsed.bindings) {
					if (b.type === 'do' && b.extra?.class) {
						const resolvedDO = await resolveDurableObjectClassFromEntrypoint(wranglerDir, parsed.main, b.extra.class);
						if (resolvedDO) {
							b.extra.path = resolvedDO.filePath;
							b.extra.methods = resolvedDO.methods;
						}
					}
				}
				return {
					bindings: parsed.bindings,
					configFilePath: fullPath
				};
			}
		} catch (e) {}
	}

	// Dynamic upward traversal to look for wrangler files
	let currentDir = dir;
	for (let depth = 0; depth < 12; depth++) {
		for (const name of ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json']) {
			const candidate = currentDir + '/' + name;
			try {
				const content = await PlatformService.readText(candidate);
				if (content) {
					const parsed = parseWranglerContent(name, content);
					const wranglerDir = candidate.substring(0, candidate.lastIndexOf('/'));
					for (const b of parsed.bindings) {
						if (b.type === 'do' && b.extra?.class) {
							const resolvedDO = await resolveDurableObjectClassFromEntrypoint(wranglerDir, parsed.main, b.extra.class);
							if (resolvedDO) {
								b.extra.path = resolvedDO.filePath;
								b.extra.methods = resolvedDO.methods;
							}
						}
					}
					return {
						bindings: parsed.bindings,
						configFilePath: candidate
					};
				}
			} catch (e) {}
		}
		const lastSlash = currentDir.lastIndexOf('/');
		if (lastSlash <= 0) break;
		currentDir = currentDir.substring(0, lastSlash);
	}
	return { bindings: [], configFilePath: null };
}

/**
 * Preserves selection state and in-memory node positions across re-parses.
 */
function mapNodesWithExternalPositions(nodes: StrataNode[], filePath: string, selectedNodeIds: Set<string>, existingNodes: StrataNode[]): StrataNode[] {
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
	nodes = $state.raw([] as StrataNode[]);
	/** The current set of Svelte Flow edges (relationships) */
	edges = $state.raw([] as StrataEdge[]);
	/** Flag to ignore the next file change event if triggered by our own write */
	ignoreNextWatch = false;
	/** Whether the schema is currently valid (parsed successfully) */
	isValid = $state(true);
	/** Any error message from the last parse attempt */
	error = $state<string | null>(null);
	/** Exact location of the last parse error for inline linting */
	errorLoc = $state<{ line: number, column: number } | null>(null);
	/** Differentiates between parsing errors, disk write errors, and AST mutation errors */
	errorType = $state<'parse' | 'disk' | 'mutation' | null>(null);
	/** The ID of the node currently displayed in the inspector panel */
	get activeInspectorNodeId() { return uiState.activeInspectorNodeId; }
	set activeInspectorNodeId(val: string | null) { uiState.activeInspectorNodeId = val; }

	/** Convenient getter to retrieve the active inspector node object */
	get activeInspectorNode() {
		if (!this.activeInspectorNodeId) return undefined;
		return this.nodes.find(n => n.id === this.activeInspectorNodeId || (n.data as any)?.label === this.activeInspectorNodeId);
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

	/** Hovered column coordinates { nodeId, colName } */
	get hoveredCol() { return uiState.hoveredCol; }
	set hoveredCol(val: { nodeId: string; colName: string } | null) { uiState.hoveredCol = val; }

	/** Subgraph Focus Lock */
	get isFocusLocked() { return uiState.isFocusLocked; }
	set isFocusLocked(val: boolean) { uiState.isFocusLocked = val; }

	get focusLockedNodeId() { return uiState.focusLockedNodeId; }
	set focusLockedNodeId(val: string | null) { uiState.focusLockedNodeId = val; }

	get highlightMode() { return uiState.highlightMode; }
	set highlightMode(val: 'direct' | 'transitive') { uiState.highlightMode = val; }

	toggleFocusLock(targetNodeId?: string) { uiState.toggleFocusLock(targetNodeId); }
	clearFocusLock() { uiState.clearFocusLock(); }

	/** Whether compact mode is currently active (keys only) */
	get compactMode() { return uiState.compactMode; }
	set compactMode(val: boolean) { uiState.compactMode = val; }

	/**
	 * Single reactive derived memo for graph highlights.
	 * Analyzes hover, selection, and focus lock to compute O(1) status lookups.
	 */
	get highlightGraph(): HighlightGraph {
		const isLocked = uiState.isFocusLocked && !!uiState.focusLockedNodeId;
		const lockedNodeId = isLocked ? uiState.focusLockedNodeId : null;
		const hoveredCol = uiState.hoveredCol;
		const hoveredNodeId = uiState.hoveredNodeId;
		
		let activeInitiatorIds: string[] = [];
		if (lockedNodeId) {
			activeInitiatorIds = [lockedNodeId];
		} else if (hoveredCol) {
			activeInitiatorIds = [hoveredCol.nodeId];
		} else if (hoveredNodeId) {
			activeInitiatorIds = [hoveredNodeId];
		} else {
			const selected = this.nodes.filter(n => n.selected).map(n => n.id);
			if (selected.length > 0) {
				activeInitiatorIds = selected;
			}
		}

		if (activeInitiatorIds.length === 0) {
			return {
				isActive: false,
				primaryActiveNodeId: null,
				activeNodeIds: new Set(),
				getNodeHighlight: () => 'normal',
				isEdgeActive: () => true,
				isColumnHighlighted: () => false,
				isFocusLocked: false,
				focusLockedNodeId: null,
				highlightMode: uiState.highlightMode,
				connectedCount: 0
			};
		}

		const activeSet = new Set(activeInitiatorIds);
		const nodeStatus = new Map<string, NodeHighlightStatus>();
		const activeEdgeIds = new Set<string>();
		const activeColumnKeys = new Set<string>();

		for (const id of activeSet) {
			nodeStatus.set(id, 'self');
		}

		// Helper to resolve standard or custom target column name
		const getColFromTarget = (targetId: string, handle?: string | null): string => {
			if (handle && handle !== 'target') return handle;
			const targetNode = this.nodes.find(n => n.id === targetId || (n.data as any)?.label === targetId);
			const pk = (targetNode?.data as any)?.columns?.find((c: any) => c.isPk)?.name;
			return pk || 'id';
		};

		// 1. Column-specific matching
		if (hoveredCol) {
			const hNode = hoveredCol.nodeId;
			const hCol = hoveredCol.colName;

			for (const edge of this.edges) {
				const src = edge.source;
				const tgt = edge.target;
				const srcCol = (edge.data as any)?.sourceCol || edge.sourceHandle || (typeof edge.label === 'string' ? edge.label : undefined);
				const tgtCol = (edge.data as any)?.targetCol || getColFromTarget(tgt, edge.targetHandle);

				if (src === hNode && srcCol === hCol) {
					activeEdgeIds.add(edge.id);
					nodeStatus.set(tgt, 'upstream');
					activeColumnKeys.add(`${src}:${srcCol}`);
					if (tgtCol) activeColumnKeys.add(`${tgt}:${tgtCol}`);
				} else if (tgt === hNode && tgtCol === hCol) {
					activeEdgeIds.add(edge.id);
					nodeStatus.set(src, 'downstream');
					if (srcCol) activeColumnKeys.add(`${src}:${srcCol}`);
					activeColumnKeys.add(`${tgt}:${tgtCol}`);
				}
			}
		} else {
			// 2. Node-level matching
			for (const edge of this.edges) {
				const src = edge.source;
				const tgt = edge.target;
				const srcCol = (edge.data as any)?.sourceCol || edge.sourceHandle || (typeof edge.label === 'string' ? edge.label : undefined);
				const tgtCol = (edge.data as any)?.targetCol || getColFromTarget(tgt, edge.targetHandle);

				const isSrcActive = activeSet.has(src);
				const isTgtActive = activeSet.has(tgt);

				if (isSrcActive && isTgtActive) {
					activeEdgeIds.add(edge.id);
					if (srcCol) activeColumnKeys.add(`${src}:${srcCol}`);
					if (tgtCol) activeColumnKeys.add(`${tgt}:${tgtCol}`);
				} else if (isSrcActive) {
					activeEdgeIds.add(edge.id);
					if (!nodeStatus.has(tgt)) {
						nodeStatus.set(tgt, 'upstream'); // target is referenced by active node
					}
					if (srcCol) activeColumnKeys.add(`${src}:${srcCol}`);
					if (tgtCol) activeColumnKeys.add(`${tgt}:${tgtCol}`);
				} else if (isTgtActive) {
					activeEdgeIds.add(edge.id);
					if (!nodeStatus.has(src)) {
						nodeStatus.set(src, 'downstream'); // source references active node
					}
					if (srcCol) activeColumnKeys.add(`${src}:${srcCol}`);
					if (tgtCol) activeColumnKeys.add(`${tgt}:${tgtCol}`);
				}
			}

			// 3. Transitive 2nd-degree neighbors (if mode is transitive)
			if (uiState.highlightMode === 'transitive') {
				const directNeighbors = Array.from(nodeStatus.keys()).filter(id => !activeSet.has(id));
				// Safeguard against hub-entity explosion (e.g. if > 12 direct neighbors)
				if (directNeighbors.length <= 12) {
					const directSet = new Set(directNeighbors);
					for (const edge of this.edges) {
						const src = edge.source;
						const tgt = edge.target;
						if (directSet.has(src) && !nodeStatus.has(tgt)) {
							nodeStatus.set(tgt, 'transitive');
							activeEdgeIds.add(edge.id);
						} else if (directSet.has(tgt) && !nodeStatus.has(src)) {
							nodeStatus.set(src, 'transitive');
							activeEdgeIds.add(edge.id);
						}
					}
				}
			}
		}

		const primaryActiveNodeId = activeInitiatorIds.length === 1 ? activeInitiatorIds[0] : null;

		return {
			isActive: true,
			primaryActiveNodeId,
			activeNodeIds: activeSet,
			getNodeHighlight: (nodeId: string) => {
				return nodeStatus.get(nodeId) || 'dimmed';
			},
			isEdgeActive: (edgeId: string) => activeEdgeIds.has(edgeId),
			isColumnHighlighted: (nodeId: string, colName: string) => activeColumnKeys.has(`${nodeId}:${colName}`),
			isFocusLocked: isLocked,
			focusLockedNodeId: lockedNodeId,
			highlightMode: uiState.highlightMode,
			connectedCount: nodeStatus.size - activeSet.size
		};
	}


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

	/** Signal counter to request diagram canvas fitView from external components */
	fitViewTrigger = $state(0);
	requestFitView() { this.fitViewTrigger++; }

	/** True while auto-layout is animating node positions */
	isArrangingLayout = $state(false);
	
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

	/**
	 * Computes a context-aware project name derived from the active template or file path.
	 */
	get suggestedProjectName(): string {
		if (this.isSandboxMode) {
			const key = this.sandboxTemplateKey || 'starter';
			return `${key}-starter`.replace(/-starter-starter$/, '-starter');
		}
		if (this.filePath) {
			const parts = this.filePath.split(/[/\\]/);
			const parent = parts[parts.length - 2];
			const grandParent = parts[parts.length - 3];
			if (parent && parent !== 'src' && parent !== 'schema') {
				return parent;
			}
			if (grandParent && grandParent !== 'packages') {
				return grandParent;
			}
			const fileName = parts[parts.length - 1]?.replace(/\.[^/.]+$/, '');
			if (fileName && fileName !== 'schema' && fileName !== 'index') {
				return fileName;
			}
		}
		return 'strata-app';
	}

	/** Confirmation Dialog Modal State */
	get showConfirmModal() { return uiState.showConfirmModal; }
	set showConfirmModal(val: boolean) { uiState.showConfirmModal = val; }

	get confirmModalData() { return uiState.confirmModalData; }
	set confirmModalData(val: { title: string; message: string; confirmLabel: string; isDanger?: boolean; warnings?: string[]; onConfirm: () => void } | null) { uiState.confirmModalData = val; }

	/** Triggers the styled Confirmation Modal */
	promptConfirm(data: { title: string; message: string; confirmLabel: string; isDanger?: boolean; warnings?: string[]; onConfirm: () => void }) {
		uiState.confirmModalData = data;
		uiState.showConfirmModal = true;
	}

	/** Connection Modeler Modal State */
	get showConnectionModelerModal() { return uiState.showConnectionModelerModal; }
	set showConnectionModelerModal(val: boolean) { uiState.showConnectionModelerModal = val; }
	get connectionModelerData() { return uiState.connectionModelerData; }
	set connectionModelerData(val: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null } | null) { uiState.connectionModelerData = val; }

	/** Whether the 'New Table' modal is currently visible */
	get showNewTableModal() { return uiState.showNewTableModal; }
	set showNewTableModal(val: boolean) { uiState.showNewTableModal = val; }

	/** Whether the 'Scaffold Auth & Identity' modal is currently visible */
	get showScaffoldAuthModal() { return uiState.showScaffoldAuthModal; }
	set showScaffoldAuthModal(val: boolean) { uiState.showScaffoldAuthModal = val; }
	get showScaffoldModal() { return uiState.showScaffoldAuthModal; }
	set showScaffoldModal(val: boolean) { uiState.showScaffoldAuthModal = val; }

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

	/** Active tab within the developer Help Center */
	get activeHelpTab() { return uiState.activeHelpTab; }
	set activeHelpTab(val: string) { uiState.activeHelpTab = val; }

	/** Opens the developer Help Center focused on a specific category or blueprint tab */
	openHelpTopic(tabId: string) {
		uiState.activeHelpTab = tabId;
		uiState.showHelpModal = true;
	}

	/** List of JSDoc and AST audit issues */
	auditIssues = $state<AuditIssue[]>([]);

	/** Detected package wrapper details if opened file is not the schema barrel */
	packageWrapperInfo = $state<PackageWrapperInfo | null>(null);

	/** The list of bindings parsed from wrangler.toml */
	wranglerBindings = $state<{ type: 'kv' | 'do' | 'r2'; name: string; extra?: any }[]>([]);

	/** Warnings about configuration mismatches between schema and wrangler bindings */
	get validationWarnings() {
		const warnings: string[] = [];
		const kvNodes = this.nodes.filter(n => (n.data as any)?.target === 'kv');
		const doNodes = this.nodes.filter(n => (n.data as any)?.target === 'do');
		const r2Nodes = this.nodes.filter(n => (n.data as any)?.target === 'r2');

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
			for (const r2 of r2Nodes) {
				if (!this.wranglerBindings.some(b => b.name === r2.id && b.type === 'r2')) {
					warnings.push(`R2 Bucket "${r2.id}" is not configured in your ${filename}.`);
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
	 * Auto-repairs malformed or missing @strata-layout coordinates for a given node symbol.
	 */
	async repairNodeJsdoc(symbolName: string) {
		const node = this.nodes.find(n => n.id === symbolName);
		if (!node) return;
		const x = Math.round(node.position.x || 100);
		const y = Math.round(node.position.y || 100);
		
		const { updateLayoutManifestInSchema } = await import("../parser");
		await this.executeSchemaMutation("Repair JSDoc layout", (rootCode) =>
			updateLayoutManifestInSchema(rootCode, { [symbolName]: { x, y } }, false)
		);
		toast.success("Layout Position Saved", {
			description: `Consolidated position for "${symbolName}" in @strata-layout.`
		});
	}

	/**
	 * Applies a recommended audit quick-fix on disk (e.g. repairing a miscalculated path depth, D1 type mode, or layout manifest).
	 */
	async applyAuditFix(issue: AuditIssue) {
		if (issue.suggestedFix?.action === 'fix_path' && issue.symbolName && issue.suggestedFix.payload?.correctedPath) {
			await this.updateTableMetadata(issue.symbolName, {
				path: issue.suggestedFix.payload.correctedPath
			});
			toast.success("Path Depth Corrected", {
				description: `Updated @strata path for "${issue.symbolName}" to ${issue.suggestedFix.payload.correctedPath}.`
			});
		} else if (issue.suggestedFix?.action === 'fix_d1_type' && issue.symbolName && issue.suggestedFix.payload?.columnName && issue.suggestedFix.payload?.targetMode) {
			const { fixD1ColumnTypeInSchema } = await import("../parser");
			const targetFile = this.getTargetFilePath(issue.symbolName);
			await this.executeSchemaMutation("Fix D1 column type", (code) =>
				fixD1ColumnTypeInSchema(code, issue.symbolName!, issue.suggestedFix!.payload!.columnName, issue.suggestedFix!.payload!.targetMode),
				targetFile
			);
			toast.success("Column Type Updated", {
				description: `Converted "${issue.suggestedFix.payload.columnName}" to integer({ mode: "${issue.suggestedFix.payload.targetMode}" }).`
			});
		} else if (issue.suggestedFix?.action === 'auto_repair_jsdoc') {
			if (issue.code === 'MALFORMED_LAYOUT_MANIFEST' || !issue.symbolName) {
				const { extractStrataLayoutManifestDetails, updateLayoutManifestInSchema } = await import("../parser");
				const details = extractStrataLayoutManifestDetails(this.rawCode);
				if (details.manifest) {
					await this.executeSchemaMutation("Repair layout manifest", (rootCode) =>
						updateLayoutManifestInSchema(rootCode, details.manifest!)
					);
					toast.success("Layout Manifest Repaired", {
						description: "Formatted and restored @strata-layout manifest."
					});
				}
			} else {
				await this.repairNodeJsdoc(issue.symbolName);
			}
		} else if (issue.suggestedFix?.action === 'migrate_dummy_to_manifest') {
			const { consolidateDummyBindingsIntoManifest } = await import("../parser");
			await this.executeSchemaMutation("Consolidate bindings to manifest", (rootCode) =>
				consolidateDummyBindingsIntoManifest(rootCode)
			);
			toast.success("Bindings Consolidated", {
				description: "Migrated non-SQL bindings into @strata-layout and stripped dummy variables."
			});
		} else if (issue.suggestedFix?.action === 'remove_unused_import' && issue.suggestedFix.payload?.moduleSpecifier) {
			const { removeUnusedImportFromSchema } = await import("../parser");
			await this.executeSchemaMutation("Remove unused import", (rootCode) =>
				removeUnusedImportFromSchema(rootCode, issue.suggestedFix!.payload!.moduleSpecifier)
			);
			toast.success("Cleaned Barrel", {
				description: `Removed unused import "${issue.suggestedFix.payload.moduleSpecifier}".`
			});
		}
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
			if (result.warnings && result.warnings.length > 0 && !this.isSandboxMode) {
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
				: { bindings: this.wranglerBindings, configFilePath: null };
			this.wranglerBindings = wranglerBindings;
			this.wranglerConfigFilePath = configFilePath;
			const finalNodes = [...result.nodes];
			
			for (const binding of wranglerBindings) {
				if (!finalNodes.some(n => n.id === binding.name)) {
					const manifestEntry = (result.layoutManifest as any)?.[binding.name];
					let cols: any[] = [];
					if (binding.type === 'kv') {
						const kvSchema = manifestEntry?.schema || binding.extra?.schema;
						cols = kvSchema 
							? Object.entries(kvSchema).map(([k, v]) => {
								if (typeof v === 'object' && v !== null) {
									const vObj = v as any;
									return {
										name: k,
										definition: String(vObj.type || 'string'),
										ttl: vObj.ttl ? Number(vObj.ttl) : undefined,
										metadata: vObj.metadata ? String(vObj.metadata) : undefined,
										isPk: false,
										notNull: false,
										isReferences: false
									};
								}
								return {
									name: k,
									definition: String(v),
									isPk: false,
									notNull: false,
									isReferences: false
								};
							})
							: [];
					} else if (binding.type === 'do') {
						const doMethods = manifestEntry?.methods || binding.extra?.methods;
						cols = doMethods 
							? doMethods.map((m: any) => typeof m === 'string' ? { name: m, definition: 'method', isPk: false, notNull: false, isReferences: false } : m)
							: [];
					} else if (binding.type === 'r2') {
						const r2Folders = manifestEntry?.folders || binding.extra?.folders;
						cols = r2Folders
							? Object.entries(r2Folders).map(([k, v]) => ({
								name: k.endsWith('/') ? k : `${k}/`,
								definition: String(v),
								isPk: false,
								notNull: false,
								isReferences: false
							}))
							: [];
					}

					const initialPos = manifestEntry && typeof manifestEntry.x === 'number' && typeof manifestEntry.y === 'number'
						? { x: Math.round(manifestEntry.x), y: Math.round(manifestEntry.y) }
						: { x: Math.round(Math.random() * 200), y: Math.round(Math.random() * 200) };

					const nodeType = binding.type;
					finalNodes.push({
						id: binding.name,
						type: nodeType,
						data: {
							label: binding.name,
							columns: cols,
							methods: binding.type === 'do' ? cols : undefined,
							patterns: binding.type === 'kv' ? cols : undefined,
							folders: binding.type === 'r2' ? cols : undefined,
							target: binding.type,
							strata: {
								target: binding.type,
								x: initialPos.x,
								y: initialPos.y,
								binding: binding.name,
								class: binding.extra?.class_name || binding.extra?.class || manifestEntry?.class,
								path: binding.extra?.path || manifestEntry?.path,
								folders: manifestEntry?.folders || binding.extra?.folders,
								schema: manifestEntry?.schema || binding.extra?.schema,
								methods: manifestEntry?.methods || binding.extra?.methods,
								public: manifestEntry?.public ?? binding.extra?.public,
								cors: manifestEntry?.cors ?? binding.extra?.cors,
								customDomain: manifestEntry?.customDomain || binding.extra?.customDomain,
								relations: manifestEntry?.relations || binding.extra?.relations,
								...binding.extra
							},
							isExternal: true
						},
						position: initialPos
					});
				}
			}

			// Also spawn nodes for any non-SQL targets declared in layoutManifest that aren't in wranglerBindings or finalNodes
			if (result.layoutManifest) {
				for (const [nodeId, manifestEntry] of Object.entries(result.layoutManifest)) {
					const target = (manifestEntry as any)?.target;
					if (target && (target === 'kv' || target === 'do' || target === 'r2') && !finalNodes.some(n => n.id === nodeId)) {
						let cols: any[] = [];
						if (target === 'kv' && (manifestEntry as any).schema) {
							cols = Object.entries((manifestEntry as any).schema).map(([k, v]: [string, any]) => ({
								name: k,
								definition: typeof v === 'object' && v?.type ? String(v.type) : String(v || 'string'),
								ttl: typeof v === 'object' ? v?.ttl : undefined,
								metadata: typeof v === 'object' ? v?.metadata : undefined,
								isPk: false,
								notNull: false,
								isReferences: false
							}));
						} else if (target === 'do' && (manifestEntry as any).methods) {
							cols = (manifestEntry as any).methods.map((m: any) => typeof m === 'string' ? { name: m, definition: 'method', isPk: false, notNull: false, isReferences: false } : m);
						} else if (target === 'r2' && (manifestEntry as any).folders) {
							cols = Object.entries((manifestEntry as any).folders).map(([k, v]: [string, any]) => ({
								name: k.endsWith('/') ? k : `${k}/`,
								definition: String(v),
								isPk: false,
								notNull: false,
								isReferences: false
							}));
						}
						const pos = typeof (manifestEntry as any).x === 'number' && typeof (manifestEntry as any).y === 'number'
							? { x: Math.round((manifestEntry as any).x), y: Math.round((manifestEntry as any).y) }
							: { x: 100, y: 100 };
						finalNodes.push({
							id: nodeId,
							type: target,
							data: {
								label: nodeId,
								columns: cols,
								methods: target === 'do' ? cols : undefined,
								patterns: target === 'kv' ? cols : undefined,
								folders: target === 'r2' ? cols : undefined,
								target,
								strata: {
									target,
									x: pos.x,
									y: pos.y,
									binding: nodeId,
									...manifestEntry
								},
								isExternal: true
							},
							position: pos
						});
					}
				}
			}

			// Ensure all synthetic edges declared in layoutManifest connecting to finalNodes are preserved
			const finalNodeIds = new Set(finalNodes.map(n => n.id));
			const combinedEdges = [...result.edges];
			if (result.layoutManifest) {
				for (const [nodeId, meta] of Object.entries(result.layoutManifest)) {
					if (meta && Array.isArray((meta as any).relations)) {
						for (const rel of (meta as any).relations) {
							if (rel && rel.to && finalNodeIds.has(nodeId) && finalNodeIds.has(rel.to)) {
								const alreadyExists = combinedEdges.some(
									e => (e.source === nodeId && e.target === rel.to) || (e.source === rel.to && e.target === nodeId)
								);
								if (!alreadyExists) {
									combinedEdges.push({
										id: `edge_${nodeId}_${rel.to}`,
										source: nodeId,
										target: rel.to,
										type: 'relation',
										label: 'synthetic',
										data: {
											isSynthetic: true,
											edgeType: 'synthetic',
											isVirtual: true
										}
									});
								}
							}
						}
					}
				}
			}

			// Preserve selection state
			const selectedNodeIds = new Set(this.nodes.filter(n => n.selected).map(n => n.id));
			this.nodes = mapNodesWithExternalPositions(finalNodes, this.filePath || 'sandbox', selectedNodeIds, this.nodes);
			this.edges = combinedEdges;
			this.rawCode = code;
			this.isValid = true;
			this.error = null;
			this.errorLoc = null;
			this.errorType = null;
			this.packageWrapperInfo = null;
			return true;
		} else {
			this.isValid = false;
			this.error = result.error || "Parse Error";
			this.errorLoc = result.errorLoc || null;
			this.errorType = 'parse';
			this.packageWrapperInfo = result.packageWrapperInfo || null;
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
	async loadSandboxDemo(templateKey: string = 'ai-agent-rag') {
		const { SAMPLE_TEMPLATES } = await import("#lib/mock");
		const template = SAMPLE_TEMPLATES[templateKey] || SAMPLE_TEMPLATES['ai-agent-rag'];

		this.isSandboxMode = true;
		this.sandboxTemplateKey = templateKey;
		this.filePath = null;
		this.wranglerBindings = template.wranglerBindings ? [...template.wranglerBindings] : [];
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
					try {
						await PlatformService.readText(resolvedSchema);
						targetPath = resolvedSchema;
						toast.info("Drizzle Config Ingested", {
							description: `Resolved schema: ${targetPath}`
						});
					} catch (readErr: any) {
						toast.error("Schema File Not Found", {
							description: `drizzle.config.ts points to "${resolvedSchema}", but the file could not be read. Select your schema entrypoint directly.`,
							duration: 8000
						});
						return;
					}
				} else {
					toast.error("Cannot Resolve Schema", {
						description: `Could not determine schema file path from drizzle.config.ts. Please open your schema file directly.`,
						duration: 8000
					});
					return;
				}
			} catch (err: any) {
				console.warn("[Strata] Failed to parse drizzle.config.ts schema path:", err);
				toast.error("Failed to Read drizzle.config.ts", {
					description: err.message || String(err)
				});
				return;
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
	getTargetFilePath(tableName: string): string | undefined {
		if (this.isSandboxMode) return undefined;
		const node = this.nodes.find(n => n.id === tableName || (n.data as any)?.label === tableName);
		return (node?.data as any)?.moduleInfo?.sourceFilePath || this.filePath || undefined;
	}

	/**
	 * Returns the Drizzle/TypeScript definition snippet for a given table or entity.
	 * Searches across modular domain files, root schema code, and falls back to
	 * synthesizing the definition from the node's AST properties.
	 */
	getTableDefinitionSnippet(tableName: string): string {
		const node = this.nodes.find(n => n.id === tableName || (n.data as any)?.label === tableName);
		if (!node) return "";

		// 1. Identity Providers (Clerk, WorkOS)
		if (node.type === "identity" || (node.data as any)?.provider) {
			const isClerk = (node.data as any)?.provider === "clerk";
			return isClerk
				? `// Recommended D1 Webhook User Mirror\nexport const clerkUsers = sqliteTable("clerkUsers", {\n  id: text("id").primaryKey(),\n  clerkUserId: text("clerk_user_id").notNull().unique(),\n  email: text("email").notNull(),\n  firstName: text("first_name"),\n  lastName: text("last_name"),\n  imageUrl: text("image_url"),\n  createdAt: integer("created_at", { mode: "timestamp" }),\n  updatedAt: integer("updated_at", { mode: "timestamp" })\n});`
				: `// Recommended D1 WorkOS Users Mirror\nexport const workosUsers = sqliteTable("workosUsers", {\n  id: text("id").primaryKey(),\n  workosUserId: text("workos_user_id").notNull().unique(),\n  workosOrgId: text("workos_org_id"),\n  email: text("email").notNull(),\n  firstName: text("first_name"),\n  lastName: text("last_name"),\n  createdAt: integer("created_at", { mode: "timestamp" }),\n  updatedAt: integer("updated_at", { mode: "timestamp" })\n});`;
		}

		const name = node.id;
		const target = (node.data as any)?.target || (node.type === "table" ? "d1" : node.type) || "d1";
		
		// Resolve file content: check modular domain file first, then fall back to rawCode
		const targetFile = (node.data as any)?.moduleInfo?.sourceFilePath || this.getTargetFilePath(name) || this.filePath;
		const fileCode = (targetFile && this.externalFilesMap.get(targetFile)) || this.rawCode;

		// 2. Exact regex extraction from source file
		if (target === "d1" && fileCode) {
			const pattern = new RegExp(
				`(?:\\/\\*\\*[\\s\\S]*?\\*\\/\\s*)?export\\s+const\\s+${name}\\s*=\\s*sqliteTable[\\s\\S]*?\\n\\}\\);?`,
				"m"
			);
			const match = fileCode.match(pattern);
			if (match) return match[0].trim();
		}

		// 3. Robust AST synthesis fallback for D1 tables (works for sandbox mode or modified files)
		if (target === "d1") {
			const cols = ((node.data as any)?.columns || [])
				.map((col: any) => {
					let chain = col.definition || `text("${col.name}")`;
					if (!chain.includes("(")) {
						chain = `${chain}("${col.name}")`;
					}
					if (col.isPk && !chain.includes(".primaryKey(")) chain += ".primaryKey()";
					if (col.notNull && !chain.includes(".notNull(")) chain += ".notNull()";
					if (col.defaultVal !== undefined && col.defaultVal !== null && !chain.includes(".default(") && !chain.includes(".$defaultFn(")) {
						chain += `.default(${col.defaultVal})`;
					}
					return `  ${col.name}: ${chain},`;
				})
				.join("\n");
			return `export const ${name} = sqliteTable("${name}", {\n${cols}\n});`;
		} else if (target === "kv") {
			const fields = ((node.data as any)?.columns || (node.data as any)?.patterns || [])
				.map((c: any) => `  ${c.name}: ${c.definition || "string"};`)
				.join("\n");
			return `export interface ${name}KV {\n${fields}\n}`;
		} else if (target === "r2") {
			const fields = ((node.data as any)?.columns || (node.data as any)?.folders || [])
				.map((c: any) => `  "${c.name}": "${c.definition || "*/*"}";`)
				.join("\n");
			return `export interface ${name}Bucket {\n${fields}\n}`;
		} else if (target === "do") {
			const methods = ((node.data as any)?.columns || (node.data as any)?.methods || [])
				.map((c: any) => `  ${c.name}: ${c.definition || "Promise<void>"};`)
				.join("\n");
			return `export class ${name} {\n${methods}\n}`;
		}

		return "";
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
			
			const isTargetExternal = Boolean(
				targetFilePath && this.filePath && targetFilePath !== this.filePath
			);
			const fileToMutate = isTargetExternal ? targetFilePath! : this.filePath;
			let currentCode = this.rawCode;

			if (isTargetExternal) {
				try {
					let extCode = this.externalFilesMap.get(targetFilePath!);
					if (!extCode) {
						extCode = await PlatformService.readText(targetFilePath!);
					}
					currentCode = extCode;
				} catch (readErr: any) {
					this.error = readErr.message || String(readErr);
					this.errorType = 'disk';
					this.machine.send("FAIL");
					toast.error(`Failed to read target module`, {
						description: readErr.message || String(readErr)
					});
					return;
				}
			}

			let newCode: string;
			try {
				newCode = await mutateFn(currentCode);
			} catch (mutErr: any) {
				console.error(`[Strata] ${operationName} AST mutation failed:`, mutErr);
				this.error = mutErr.message || String(mutErr);
				this.errorType = 'mutation';
				this.machine.send("FAIL");
				toast.error(`${operationName} failed`, {
					description: mutErr.message || String(mutErr)
				});
				return;
			}

			if (!this.isSandboxMode && fileToMutate) {
				try {
					this.ignoreNextWatch = true;
					this.lastWriteTime = Date.now();
					await PlatformService.writeText(fileToMutate, newCode);
				} catch (writeErr: any) {
					console.error(`[Strata] ${operationName} disk write failed:`, writeErr);
					this.error = writeErr.message || String(writeErr);
					this.errorType = 'disk';
					this.machine.send("FAIL");
					toast.error(`Disk write failed for "${operationName}"`, {
						description: writeErr.message || String(writeErr)
					});
					return;
				}
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
	async updateTableMetadata(
		tableName: string, 
		metadata: { 
			public?: boolean; 
			customDomain?: string | null; 
			cors?: boolean; 
			class?: string; 
			path?: string;
			methods?: string[];
			schema?: Record<string, any>;
			folders?: Record<string, string>;
			[key: string]: any;
		}
	) {
		const targetNode = this.nodes.find(n => n.id === tableName);
		const target = (targetNode?.data as any)?.target || 'd1';

		if (target !== 'd1' && (this.isSandboxMode || !this.filePath)) {
			const binding = this.wranglerBindings.find(b => b.name === tableName);
			if (binding) {
				binding.extra = { ...binding.extra, ...metadata };
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const targetFile = this.getTargetFilePath(tableName);
		const { updateTableMetadataInSchema } = await import("../parser");
		await this.executeSchemaMutation("Table metadata update", (code) => 
			updateTableMetadataInSchema(code, tableName, metadata),
			targetFile
		);
	}

	/**
	 * Deletes an RPC method from a Durable Object actor.
	 */
	async deleteMethod(doName: string, methodName: string) {
		if (this.isSandboxMode || !this.filePath) {
			const binding = this.wranglerBindings.find(b => b.name === doName);
			if (binding && binding.extra?.methods) {
				binding.extra.methods = binding.extra.methods.filter(
					(m: string) => m !== methodName && !m.startsWith(methodName + '(')
				);
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const targetNode = this.nodes.find(n => n.id === doName);
		const strata = targetNode?.data?.strata || {};
		const currentMethods = strata.methods || [];
		const updatedMethods = currentMethods.filter(
			(m: string) => m !== methodName && !m.startsWith(methodName + '(')
		);
		await this.updateTableMetadata(doName, { methods: updatedMethods });
	}

	/**
	 * Deletes a key pattern from a KV Namespace.
	 */
	async deletePattern(kvName: string, patternName: string) {
		if (this.isSandboxMode || !this.filePath) {
			const binding = this.wranglerBindings.find(b => b.name === kvName);
			if (binding && binding.extra?.schema) {
				delete binding.extra.schema[patternName];
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const targetNode = this.nodes.find(n => n.id === kvName);
		const strata = targetNode?.data?.strata || {};
		const currentSchema = { ...(strata.schema || {}) };
		delete currentSchema[patternName];
		await this.updateTableMetadata(kvName, { schema: currentSchema });
	}

	/**
	 * Deletes a folder prefix mapping from an R2 Bucket.
	 */
	async deleteFolder(r2Name: string, folderName: string) {
		const baseKey = folderName.replace(/\/$/, '');
		if (this.isSandboxMode || !this.filePath) {
			const binding = this.wranglerBindings.find(b => b.name === r2Name);
			if (binding && binding.extra?.folders) {
				delete binding.extra.folders[baseKey];
				delete binding.extra.folders[folderName];
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const targetNode = this.nodes.find(n => n.id === r2Name);
		const strata = targetNode?.data?.strata || {};
		const currentFolders = { ...(strata.folders || {}) };
		delete currentFolders[baseKey];
		delete currentFolders[folderName];
		await this.updateTableMetadata(r2Name, { folders: currentFolders });
	}

	/**
	 * Deletes a column from a table in the schema and syncs to disk.
	 */
	async deleteColumn(tableName: string, colName: string) {
		const targetNode = this.nodes.find(n => n.id === tableName);
		const target = targetNode?.data?.target || 'd1';

		if (target === 'do') {
			return this.deleteMethod(tableName, colName);
		}
		if (target === 'kv') {
			return this.deletePattern(tableName, colName);
		}
		if (target === 'r2') {
			return this.deleteFolder(tableName, colName);
		}

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

		if (this.isSandboxMode || !this.filePath) {
			this.wranglerBindings = this.wranglerBindings.filter(b => b.name !== tableName);
		}

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
	}

	/**
	 * Deletes a relationship/edge from the schema and syncs to disk.
	 */
	async deleteRelation(source: string, target: string, name?: string) {
		const { removeEdgeFromSchema, resolveRelativePath } = await import("../parser");
		
		const matchingEdge = this.edges.find(e => 
			((e.source === source && e.target === target) || (e.source === target && e.target === source)) && 
			(name ? (e.label === name || e.sourceHandle === name || (e.data as any)?.sourceCol === name || (e.data as any)?.relationNames?.includes(name)) : true)
		);
		const isVirtual = matchingEdge?.data?.isVirtual ?? false;
		const isSynthetic = matchingEdge?.data?.isSynthetic || matchingEdge?.data?.isIdentityBoundary || (matchingEdge?.data as any)?.edgeType === 'synthetic' || matchingEdge?.label === 'synthetic';

		let targetFile: string | undefined;

		if (isSynthetic) {
			// Synthetic architectural links always live in @strata-layout in the root file
			targetFile = this.filePath || undefined;
		} else if (this.externalFilesMap.size > 0 && this.filePath) {
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
	 * In sandbox mode, updates the in-memory rawCode with layout positions and marks state clean.
	 */
	async saveToFile() {
		if (this.isSandboxMode) {
			const { updateAllNodePositionsInSchema, updateLayoutManifestInSchema } = await import("../parser");
			const isModular = this.externalFilesMap.size > 0 || this.nodes.some(n => {
				const info = (n.data as any)?.moduleInfo;
				return info && !info.isRootFile;
			});

			if (isModular || this.rawCode.includes('@strata-layout')) {
				const positionsMap: Record<string, { x: number; y: number }> = {};
				for (const node of this.nodes) {
					positionsMap[node.id] = {
						x: Math.round(node.position.x),
						y: Math.round(node.position.y)
					};
				}
				this.rawCode = updateLayoutManifestInSchema(this.rawCode, positionsMap, true);
			} else {
				this.rawCode = updateAllNodePositionsInSchema(this.rawCode, this.nodes);
			}

			this.machine.send("SUCCESS");
			this.isRecentlySaved = true;
			setTimeout(() => (this.isRecentlySaved = false), 1500);
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

			if (isModular || currentCode.includes('@strata-layout')) {
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
		extra?: { class?: string; path?: string; id?: string; bucket_name?: string; presets?: import("../parser").TablePresets },
		moduleDestination?: { mode: 'root' | 'existing' | 'new'; targetModule?: string }
	) {
		const { addTableToSchema, createD1ModuleCode, addReExportToBarrel, updateLayoutManifestInSchema } = await import("../parser");

		if (target === 'd1' && moduleDestination && moduleDestination.mode === 'new' && this.filePath) {
			const baseDir = this.filePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
			let fileName = moduleDestination.targetModule?.trim() || `${tableName}.ts`;
			if (!fileName.endsWith('.ts')) fileName += '.ts';
			const newFilePath = `${baseDir}/${fileName}`;
			const relativeSpecifier = `./${fileName.replace(/\.ts$/, '')}`;

			const newModuleCode = createD1ModuleCode(tableName, extra?.presets);

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

		if (target !== 'd1') {
			if (this.isSandboxMode || !this.filePath) {
				const existingIdx = this.wranglerBindings.findIndex(b => b.name === tableName);
				const bindingEntry = {
					type: target,
					name: tableName,
					extra: {
						class: extra?.class,
						path: extra?.path,
						id: extra?.id,
						bucket_name: extra?.bucket_name,
						...(extra as any)
					}
				};
				if (existingIdx >= 0) {
					this.wranglerBindings[existingIdx] = bindingEntry;
				} else {
					this.wranglerBindings = [...this.wranglerBindings, bindingEntry];
				}
			}
		}

		await this.executeSchemaMutation("Table add", (code) => 
			addTableToSchema(code, tableName, target, extra)
		);
	}

	/**
	 * Adds an RPC method to a Durable Object actor.
	 */
	async addMethod(doName: string, methodName: string, returnType: string = 'Promise<void>') {
		const targetNode = this.nodes.find(n => n.id === doName);
		const existingMethods = targetNode?.data?.methods || targetNode?.data?.columns || [];
		if (existingMethods.some(m => m.name.toLowerCase() === methodName.trim().toLowerCase() || m.name.startsWith(methodName.trim() + '('))) {
			toast.warning("Method Already Exists", {
				description: `Durable Object "${doName}" already has a method named "${methodName}".`
			});
			return;
		}

		if (this.isSandboxMode || !this.filePath) {
			const binding = this.wranglerBindings.find(b => b.name === doName);
			if (binding) {
				binding.extra = binding.extra || {};
				binding.extra.methods = binding.extra.methods || [];
				binding.extra.methods.push(methodName);
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const strata = targetNode?.data?.strata || {};
		const currentMethods = strata.methods || [];
		const updatedMethods = [...currentMethods, methodName];
		await this.updateTableMetadata(doName, { methods: updatedMethods });
	}

	/**
	 * Adds a key pattern to a KV Namespace cache.
	 */
	async addPattern(kvName: string, patternName: string, valueType: string = 'string', ttl?: number) {
		const targetNode = this.nodes.find(n => n.id === kvName);
		const existingPatterns = targetNode?.data?.patterns || targetNode?.data?.columns || [];
		if (existingPatterns.some(p => p.name.toLowerCase() === patternName.trim().toLowerCase())) {
			toast.warning("Pattern Already Exists", {
				description: `KV Namespace "${kvName}" already has a pattern named "${patternName}".`
			});
			return;
		}

		const val = ttl !== undefined ? { type: valueType, ttl } : valueType;

		if (this.isSandboxMode || !this.filePath) {
			const binding = this.wranglerBindings.find(b => b.name === kvName);
			if (binding) {
				binding.extra = binding.extra || {};
				binding.extra.schema = binding.extra.schema || {};
				binding.extra.schema[patternName] = val;
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const strata = targetNode?.data?.strata || {};
		const currentSchema = { ...(strata.schema || {}) };
		currentSchema[patternName] = val;
		await this.updateTableMetadata(kvName, { schema: currentSchema });
	}

	/**
	 * Adds a folder prefix mapping to an R2 Bucket.
	 */
	async addFolder(r2Name: string, folderName: string, mimeType: string = '*/*') {
		const cleanName = folderName.endsWith('/') ? folderName : `${folderName}/`;
		const targetNode = this.nodes.find(n => n.id === r2Name);
		const existingFolders = targetNode?.data?.folders || targetNode?.data?.columns || [];
		if (existingFolders.some(f => f.name.toLowerCase() === cleanName.toLowerCase())) {
			toast.warning("Folder Prefix Already Exists", {
				description: `R2 Bucket "${r2Name}" already has a prefix named "${cleanName}".`
			});
			return;
		}

		if (this.isSandboxMode || !this.filePath) {
			const binding = this.wranglerBindings.find(b => b.name === r2Name);
			if (binding) {
				binding.extra = binding.extra || {};
				binding.extra.folders = binding.extra.folders || {};
				binding.extra.folders[folderName.replace(/\/$/, '')] = mimeType;
			}
			await this.parseAndApply(this.rawCode);
			return;
		}

		const strata = targetNode?.data?.strata || {};
		const currentFolders = { ...(strata.folders || {}) };
		currentFolders[folderName.replace(/\/$/, '')] = mimeType;
		await this.updateTableMetadata(r2Name, { folders: currentFolders });
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
		const targetNode = this.nodes.find(n => n.id === tableName);
		const target = targetNode?.data?.target || 'd1';

		if (target === 'do') {
			return this.addMethod(tableName, columnName, type);
		}
		if (target === 'kv') {
			return this.addPattern(tableName, columnName, type);
		}
		if (target === 'r2') {
			return this.addFolder(tableName, columnName, type);
		}

		const existingCols = targetNode?.data?.columns || [];
		if (existingCols.some((c: any) => c.name.toLowerCase() === columnName.trim().toLowerCase())) {
			toast.warning("Column Already Exists", {
				description: `Table "${tableName}" already has a column named "${columnName}".`
			});
			return;
		}

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
	 * Adds an explicit synthetic link in @strata-layout (e.g. D1 to non-SQL or architectural reference).
	 */
	async addSyntheticRelation(source: string, target: string) {
		const { addEdgeToSchema } = await import("../parser");
		await this.executeSchemaMutation("Synthetic Relation add", (code) =>
			addEdgeToSchema(code, source, target, undefined, 'synthetic'),
			this.filePath || undefined
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
	 * Finds all references to a given table across domain module files in a modular project.
	 */
	findCrossModuleReferences(tableName: string): { file: string; lineContent: string }[] {
		const references: { file: string; lineContent: string }[] = [];
		const currentFile = this.getTargetFilePath(tableName);

		for (const [filePath, content] of this.externalFilesMap.entries()) {
			if (filePath === currentFile) continue;
			const lines = content.split('\n');
			for (let idx = 0; idx < lines.length; idx++) {
				const line = lines[idx];
				const refRegex = new RegExp(`\\.references\\s*\\(\\s*\\(\\)\\s*=>\\s*${tableName}\\b`);
				if (refRegex.test(line)) {
					const fileName = filePath.split(/[/\\]/).pop() || filePath;
					references.push({
						file: fileName,
						lineContent: line.trim()
					});
				}
			}
		}
		return references;
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
		this.errorLoc = null;
		this.errorType = null;
		this.activeInspectorNodeId = null;
		this.isSandboxMode = false;
		this.packageWrapperInfo = null;
		this.auditIssues = [];
		this.machine.send("RESET");
	}

	/**
	 * Closes the currently open schema or sandbox mode, returning to the Welcome screen overlay.
	 * Prompts for confirmation if unsaved layout coordinates are pending.
	 */
	closeFile() {
		if (this.hasUnsavedChanges) {
			this.promptConfirm({
				title: "Unsaved Layout Changes",
				message: "You have unsaved node layout movements. Are you sure you want to close this schema without saving your layout coordinates?",
				confirmLabel: "Close & Discard",
				isDanger: true,
				onConfirm: () => {
					PlatformService.unwatchFile().catch(() => {});
					this.reset();
				}
			});
			return;
		}
		PlatformService.unwatchFile().catch(() => {});
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
				description: "Wrangler binding files (wrangler.jsonc) operate in-memory while in Sandbox Mode."
			});
			return;
		}

		const unconfiguredNodes = this.nodes.filter(n => {
			const target = (n.data as any)?.target;
			if (!target || target === 'd1') return false;
			return !this.wranglerBindings.some(b => b.name === n.id && b.type === target);
		});

		if (unconfiguredNodes.length === 0) {
			toast.success("Wrangler Bindings Aligned", {
				description: "All entity targets are configured in your Wrangler bindings."
			});
			return;
		}

		const kvEntries = unconfiguredNodes
			.filter(n => (n.data as any)?.target === 'kv')
			.map(n => `    { "binding": "${n.id}", "id": "${(n.data as any)?.strata?.id || n.id}" }`);
		const doEntries = unconfiguredNodes
			.filter(n => (n.data as any)?.target === 'do')
			.map(n => `    { "name": "${n.id}", "class_name": "${(n.data as any)?.strata?.class || n.id}" }`);
		const r2Entries = unconfiguredNodes
			.filter(n => (n.data as any)?.target === 'r2')
			.map(n => `    { "binding": "${n.id}", "bucket_name": "${(n.data as any)?.strata?.bucket_name || n.id}" }`);

		let snippet = "// Add the following binding(s) to your wrangler.jsonc:\n";
		if (kvEntries.length > 0) snippet += `"kv_namespaces": [\n${kvEntries.join(",\n")}\n],\n`;
		if (doEntries.length > 0) snippet += `"durable_objects": {\n  "bindings": [\n${doEntries.join(",\n")}\n  ]\n},\n`;
		if (r2Entries.length > 0) snippet += `"r2_buckets": [\n${r2Entries.join(",\n")}\n],\n`;

		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(snippet.trim());
				toast.success("Wrangler Recipe Copied", {
					description: `Copied configuration for ${unconfiguredNodes.length} binding(s) to clipboard. Paste into your wrangler.jsonc.`
				});
				return;
			} catch {}
		}

		toast.info("Unconfigured Wrangler Bindings", {
			description: `${unconfiguredNodes.length} binding(s) need declaration in wrangler.jsonc.`
		});
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




