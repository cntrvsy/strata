/**
 * fsm.ts
 *
 * Summary: Configures and constructs the Finite State Machine (FSM) controlling app states.
 * Expects: Initial state token.
 * Output: Initialized FiniteStateMachine instance from runed.
 */
import { FiniteStateMachine } from "runed";
import type { States, Events } from "./types";

export function createStateMachine(initialState: States) {
	return new FiniteStateMachine<States, Events>(
		initialState,
		{
			EMPTY: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				RESET: "EMPTY",
			},
			BUSY: {
				SYNC: "BUSY",
				EDIT: "BUSY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				FAIL: "ERROR",
				RESET: "EMPTY",
			},
			IDLE: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				EDIT: "DIRTY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				RESET: "EMPTY",
			},
			DIRTY: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				EDIT: "DIRTY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				RESET: "EMPTY",
			},
			ERROR: {
				SYNC: "BUSY",
				OPEN: "BUSY",
				EDIT: "DIRTY",
				SAVE: "BUSY",
				SUCCESS: "IDLE",
				FAIL: "ERROR",
				RESET: "EMPTY"
			}
		}
	);
}
