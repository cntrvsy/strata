import { type Node, type Edge } from '@xyflow/svelte';

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
	filePath = $state(
		typeof window !== 'undefined' 
			? localStorage.getItem('strata-last-file') 
			: null
	);
	/** HTML-wrapped code preview of the schema.ts file */
	rawCode = $state('');
	
	// --- IO State ---
	/** True if a write operation to disk is currently in progress */
	isSaving = $state(false);
	/** True if the diagram is currently being re-parsed or updated from disk */
	isSyncing = $state(false);
	/** True if the user has moved nodes but hasn't saved the layout to disk (Ctrl+S) */
	hasUnsavedChanges = $state(false);
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
	async syncWithFile() {
		if (!this.filePath) return;
		this.isSyncing = true;
		try {
			// Dynamic imports to avoid SSR issues or circular dependencies
			const { readTextFile } = await import("@tauri-apps/plugin-fs");
			const { parseSchema, wrapCode } = await import("./parser");
			
			const raw = await readTextFile(this.filePath);
			const result = parseSchema(raw);
			
			if (result.success) {
				// Preserve selection state
				const selectedNodeIds = new Set(this.nodes.filter(n => n.selected).map(n => n.id));
				
				this.nodes = result.nodes.map(n => ({
					...n,
					selected: selectedNodeIds.has(n.id)
				}));
				
				this.edges = result.edges;
				this.rawCode = wrapCode(raw);
				this.isValid = true;
				this.error = null;
			} else {
				this.isValid = false;
				this.error = result.error || "Parse Error";
			}
		} catch (e: any) {
			console.error("[Strata] Sync failed:", e);
			this.error = e.message;
		} finally {
			// Small delay to let Svelte Flow settle its internal state
			setTimeout(() => {
				this.isSyncing = false;
			}, 300);
		}
	}

	constructor() {
		// Persist the open file path across sessions
		$effect.root(() => {
			$effect(() => {
				if (typeof window !== 'undefined') {
					if (this.filePath) {
						localStorage.setItem('strata-last-file', this.filePath);
					} else {
						localStorage.removeItem('strata-last-file');
					}
				}
			});
		});
	}
}

/**
 * Singleton instance of the application state.
 */
export const schemaState = new SchemaState();
