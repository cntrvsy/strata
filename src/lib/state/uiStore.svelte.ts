/**
 * uiStore.svelte.ts
 *
 * Transient UI state store using Svelte 5 Runes.
 * Decouples modal flags, view modes, search filters, and panel toggles from domain schema persistence.
 */

export class UIState {
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
	/** Legacy alias: forwarding to Help Center Auth Blueprints */
	get showScaffoldAuthModal() {
		return this.showHelpModal && this.activeHelpTab === 'identity-auth';
	}
	set showScaffoldAuthModal(val: boolean) {
		if (val) {
			this.activeHelpTab = 'identity-auth';
			this.showHelpModal = true;
		} else if (this.activeHelpTab === 'identity-auth') {
			this.showHelpModal = false;
		}
	}
	get showScaffoldModal() {
		return this.showScaffoldAuthModal;
	}
	set showScaffoldModal(val: boolean) {
		this.showScaffoldAuthModal = val;
	}
	showProjectSettingsModal = $state(false);
	showHelpModal = $state(false);
	activeHelpTab = $state<string>("all");
	showExportToast = $state(false);

	/** Confirmation Dialog Modal State */
	showConfirmModal = $state(false);
	confirmModalData = $state<{
		title: string;
		message: string;
		confirmLabel: string;
		isDanger?: boolean;
		warnings?: string[];
		onConfirm: () => void;
	} | null>(null);

	/** Connection Modeler Modal State */
	showConnectionModelerModal = $state(false);
	connectionModelerData = $state<{
		source: string;
		sourceHandle?: string | null;
		target: string;
		targetHandle?: string | null;
	} | null>(null);

	/** Sandbox / Playground Mode State */
	isSandboxMode = $state(false);
	sandboxTemplateKey = $state<string>('fullstack');

	/** Reset transient UI selection state */
	resetSelection() {
		this.activeInspectorNodeId = null;
		this.activeCoordinates = null;
		this.hoveredNodeId = null;
	}
}

export const uiState = new UIState();
