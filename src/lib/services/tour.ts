/**
 * tour.ts
 *
 * Summary: Guided interactive tour for Strata using Driver.js.
 * Walkthrough is 100% manual, triggered on demand via the "Tour" button in Titlebar.
 */

import { driver } from "driver.js";
import { schemaState } from "#lib/state";
import { tick } from "svelte";

export async function startStrataTour() {
	// If in EMPTY state, load the fullstack sandbox template so canvas elements exist
	if (!schemaState.filePath && !schemaState.isSandboxMode) {
		schemaState.loadSandboxDemo("fullstack");
		await tick();
		schemaState.requestFitView();
		// Wait for Svelte Flow to mount and compute node dimensions
		await new Promise((r) => setTimeout(r, 350));
	}

	const driverObj = driver({
		showProgress: true,
		animate: true,
		allowClose: true,
		overlayColor: "rgba(0, 0, 0, 0.72)",
		nextBtnText: "Next →",
		prevBtnText: "← Back",
		doneBtnText: "Finish Tour",
		onDestroyed: () => {
			// Clean up any temporary node selection
			if (schemaState.activeInspectorNodeId === "users") {
				schemaState.activeInspectorNodeId = null;
			}
		},
		steps: [
			{
				element: '[data-testid="navbar"] .navbar-start',
				popover: {
					title: "Single Source of Truth",
					description:
						"Strata reads directly from your TypeScript schema codebase. Visual edits surgically patch your code via AST mutations — zero sidecar JSON files, zero lock-in.",
					side: "bottom",
					align: "start"
				}
			},
			{
				element: ".svelte-flow__pane",
				popover: {
					title: "Interactive Architecture Canvas",
					description:
						"Cloudflare D1 tables render alongside KV Namespaces, Durable Objects (with live RPC methods), and R2 Buckets. Double-click any entity to zoom into it, press <code>0</code> or double-click the background to fit view, and press <code>F</code> to isolate 1-hop subgraphs.",
					side: "top",
					align: "center"
				}
			},
			{
				element: '[data-testid="inspector-panel"]',
				onHighlightStarted: async () => {
					// Ensure Inspector HUD is mounted by selecting a node
					if (!schemaState.activeInspectorNodeId) {
						const firstNode = schemaState.nodes.find((n) => (n.data as any)?.target === "d1") || schemaState.nodes[0];
						schemaState.activeInspectorNodeId = firstNode ? firstNode.id : "users";
						await tick();
						await new Promise((r) => setTimeout(r, 150));
					}
				},
				popover: {
					title: "Deep Entity & Schema Inspector",
					description:
						"Inspect column types, foreign keys, and indexes. Toggle the Code Preview to inspect both the individual table snippet and the complete file's <code>@strata-layout</code> manifest. Press <code>E</code> anytime to jump directly to this line in your code editor.",
					side: "left",
					align: "start"
				}
			},
			{
				element: '[data-testid="titlebar"] .navbar-end',
				onHighlightStarted: () => {
					// Deselect node to clear inspector
					schemaState.activeInspectorNodeId = null;
				},
				popover: {
					title: "Canvas Tools & Export",
					description:
						"Tidy complex diagrams with ELK auto-layout, switch to Compact Mode for high-density overviews, or export high-resolution 4K PNG diagrams for documentation.",
					side: "bottom",
					align: "end"
				}
			},
			{
				element: '[data-testid="bottombar"]',
				popover: {
					title: "Live Health & Git-Clean Layout",
					description:
						"Native OS file watchers detect disk changes in milliseconds. In modular setups, visual coordinates save directly to the root <code>@strata-layout</code> manifest, keeping domain files (<code>users.ts</code>, <code>posts.ts</code>) 100% free of Git merge conflicts.",
					side: "top",
					align: "start"
				}
			},
			{
				element: '[data-testid="settings-menu-button"]',
				popover: {
					title: "Settings, Blueprints & AI Disclosure",
					description:
						"Access turnkey Better Auth, Clerk, and WorkOS blueprints, configure your preferred code editor, view the 0rwx AI:W transparency disclosure, and check for software updates.",
					side: "bottom",
					align: "end"
				}
			}
		]
	});

	driverObj.drive();
}

export const startCirrusTour = startStrataTour;
