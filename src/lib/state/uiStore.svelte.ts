/**
 * uiStore.svelte.ts
 *
 * Transient UI state store using Svelte 5 Runes.
 * Decouples modal flags, view modes, search filters, and panel toggles from domain schema persistence.
 */

export class UIState {
	/** Active view mode (diagram canvas vs raw code editor) */
	viewMode = $state<'diagram' | 'code'>('diagram');

	/** Currently selected node ID for inspector */
	activeInspectorNodeId = $state<string | null>(null);

	/** Selection coordinates of active/dragged node */
	activeCoordinates = $state<{ x: number; y: number } | null>(null);

	/** ID of currently hovered node on canvas */
	hoveredNodeId = $state<string | null>(null);

	/** Compact mode toggle (keys only) */
	compactMode = $state(false);

	/** Active filter for storage targets */
	activeFilter = $state<'d1' | 'do' | 'kv' | 'r2' | null>(null);

	/** Modal visibility flags */
	showNewTableModal = $state(false);
	showProjectSettingsModal = $state(false);
	showHelpModal = $state(false);
	showExportToast = $state(false);

	/** Rename Entity Modal State */
	showRenameModal = $state(false);
	renameEntityTargetId = $state<string | null>(null);

	/** Confirmation Dialog Modal State */
	showConfirmModal = $state(false);
	confirmModalData = $state<{
		title: string;
		message: string;
		confirmLabel: string;
		isDanger?: boolean;
		onConfirm: () => void;
	} | null>(null);

	/** Sandbox / Playground Mode State */
	isSandboxMode = $state(false);
	sandboxTemplateKey = $state<string>('fullstack');

	/** Panel collapse states */
	isCodeCollapsed = $state(false);
	isDiagramCollapsed = $state(false);

	/** Target line number to scroll/highlight in code editor */
	targetCodeLine = $state<number | null>(null);

	/** Switch to Code Editor mode and jump to line */
	jumpToCodeLine(line?: number) {
		this.viewMode = 'code';
		this.isCodeCollapsed = false;
		if (line && line > 0) {
			this.targetCodeLine = line;
		}
	}

	/** Reset transient UI selection state */
	resetSelection() {
		this.activeInspectorNodeId = null;
		this.activeCoordinates = null;
		this.hoveredNodeId = null;
	}

}

export const uiState = new UIState();
