/**
 * index.ts
 *
 * Summary: Main entry point for the parser package. Exports parsing and mutating APIs.
 * Expects: Internal modules.
 * Output: Unified public API surface.
 */
export { 
	parseSchema, 
	wrapCode 
} from './core';

export { 
	updateNodePositionInSchema, 
	updateAllNodePositionsInSchema, 
	addTableToSchema, 
	addColumnToSchema, 
	addEdgeToSchema, 
	removeTableFromSchema, 
	removeEdgeFromSchema, 
	removeColumnFromSchema, 
	renameTableInSchema, 
	renameColumnInSchema, 
	updateColumnModifiersInSchema 
} from './mutators';

export type { ParseResult } from './types';
export { project, sourceFile, syncSourceFile } from './project';
