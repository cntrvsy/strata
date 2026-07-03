/**
 * types.ts
 *
 * Summary: Declares FSM state and event types for the state controller.
 * Expects: None.
 * Output: Type definitions for States and Events.
 */
export type States = "EMPTY" | "BUSY" | "IDLE" | "DIRTY" | "ERROR";

export type Events = 
	| "SYNC" 
	| "OPEN" 
	| "EDIT" 
	| "SAVE" 
	| "SUCCESS" 
	| "FAIL"
	| "RESET";
