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
	cleanUnusedImports,
	detectPackageWrapper,
	findCorrectedRelativePath
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
	fixD1ColumnTypeInSchema,
	extractStrataLayoutManifest,
	updateLayoutManifestInSchema,
	removeTableFromLayoutManifest,
	renameTableInLayoutManifest,
	parseDrizzleConfigSchemaPath,
	createD1ModuleCode,
	addReExportToBarrel,
	consolidateDummyBindingsIntoManifest,
	removeUnusedImportFromSchema,
	type TablePresets
} from './mutators';

export {
	extractStrataLayoutManifestDetails
} from './helpers';


export type { 
	ParseResult,
	StrataNode,
	StrataEdge,
	StrataNodeData,
	StrataEdgeData,
	ColumnDefinition,
	StorageTarget
} from './types';
export { createIsolatedProject } from './project';
