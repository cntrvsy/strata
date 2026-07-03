/**
 * index.ts
 *
 * Summary: Entry point for state management. Instantiates and exports the global schemaState singleton.
 * Expects: None.
 * Output: Shared SchemaState instance.
 */
import { SchemaState } from "./store.svelte";

export const schemaState = new SchemaState();

// Expose to window for E2E testing
if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
	(window as any).schemaState = schemaState;
}

export type { States, Events } from "./types";
export { SchemaState } from "./store.svelte";
