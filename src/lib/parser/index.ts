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
	resolveRelativePath,
	resolvePathAlias,
	getRelativeImportSpecifier,
	cleanUnusedImports
} from './helpers';

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
	updateColumnModifiersInSchema,
	updateProjectConfigInSchema,
	updateTableMetadataInSchema,
	addForeignKeyToColumnInSchema,
	scaffoldBetterAuthClusterInSchema,
	scaffoldClerkMirrorTableInSchema,
	scaffoldWorkOSMirrorTableInSchema,
	extractStrataLayoutManifest,
	updateLayoutManifestInSchema,
	removeTableFromLayoutManifest,
	renameTableInLayoutManifest,
	parseDrizzleConfigSchemaPath,
	createD1ModuleCode,
	addReExportToBarrel
} from './mutators';


export type { ParseResult } from './types';
export { createIsolatedProject } from './project';
