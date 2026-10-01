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
						"Strata is powered directly by your TypeScript schema codebase. Visual edits surgically patch your code via AST mutations — no hidden databases, zero lock-in.",
					side: "bottom",
					align: "start"
				}
			},
			{
				element: ".svelte-flow__pane",
				popover: {
					title: "Full-Stack Cloudflare Primitives",
					description:
						"Beyond SQL tables, Strata natively models KV Namespaces, Durable Objects, and R2 Buckets directly alongside your D1 relational schema as interconnected cards.",
					side: "top",
					align: "center"
				}
			},
			{
				element: ".svelte-flow__edge, .svelte-flow__handle",
				popover: {
					title: "Two-Tier Relationships",
					description:
						"Canonical table-to-table ERD lines display physical foreign keys (<code>.references()</code>) with solid lines, and logical query-builder relations (<code>relations()</code>) with dashed animated lines.",
					side: "top",
					align: "center"
				}
			},
			{
				element: '[data-testid="inspector"]',
				onHighlightStarted: async () => {
					// Guard: Ensure Inspector HUD is mounted by selecting a node
					if (!schemaState.activeInspectorNodeId) {
						const firstNode = schemaState.nodes.find((n) => (n.data as any)?.target === "d1") || schemaState.nodes[0];
						schemaState.activeInspectorNodeId = firstNode ? firstNode.id : "users";
						await tick();
						await new Promise((r) => setTimeout(r, 100));
					}
				},
				popover: {
					title: "Deep Entity Inspector",
					description:
						"Click any entity to inspect columns, configure SQLite data types (with native timestamp and boolean support), and copy live Drizzle TypeScript snippets.",
					side: "left",
					align: "start"
				}
			},
			{
				element: '[data-testid="bottombar"]',
				onHighlightStarted: () => {
					// Deselect node to clear inspector
					schemaState.activeInspectorNodeId = null;
				},
				popover: {
					title: "Git-Clean Layout Guarantee",
					description:
						"Drag cards freely. In modular schemas, visual coordinates live in the <code>@strata-layout</code> root manifest, keeping domain files (<code>users.ts</code>, <code>posts.ts</code>) 100% clean of Git merge conflicts.",
					side: "top",
					align: "start"
				}
			},
			{
				element: '[data-testid="settings-menu-button"]',
				popover: {
					title: "Auth Blueprints & Identity Guardrails",
					description:
						"Access turnkey blueprints for Better Auth, Clerk, and WorkOS directly from the menu. Copy production-ready webhook mirror tables and auth schema definitions with zero guesswork.",
					side: "bottom",
					align: "end"
				}
			},
			{
				element: '[data-testid="titlebar"] .navbar-end',
				popover: {
					title: "Auto-Layout & 4K PNG Capture",
					description:
						"Tidy complex schemas with ELK auto-layout, switch to Compact Mode for high-level overviews, or export high-resolution PNGs for team docs.",
					side: "bottom",
					align: "end"
				}
			},
			{
				element: '[data-testid="bottombar"]',
				popover: {
					title: "External IDE Pairing & Schema Health",
					description:
						"Strata pairs side-by-side with VS Code, Cursor, and Zed. Live disk watchers keep files in sync, while the Schema Diagnostics HUD catches errors before you commit.",
					side: "top",
					align: "center"
				}
			}
		]
	});

	driverObj.drive();
}
