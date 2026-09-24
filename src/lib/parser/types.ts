/**
 * types.ts
 *
 * Summary: Shared TypeScript interfaces for parsing results and method chaining configurations.
 * Expects: None.
 * Output: Type definitions for ParseResult and ChainElement.
 */
import type { Node, Edge } from '@xyflow/svelte';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditIssue {
	id: string;
	severity: AuditSeverity;
	code:
		| 'JSDOC_SYNTAX_ERROR'
		| 'INVALID_TARGET'
		| 'DANGLING_RELATION'
		| 'MISSING_FOREIGN_KEY_TARGET'
		| 'MALFORMED_LAYOUT_MANIFEST'
		| 'D1_TYPE_COMPATIBILITY'
		| 'TYPE_MISMATCH'
		| 'WRANGLER_MISMATCH'
		| 'MISCALCULATED_PATH_DEPTH'
		| 'MISSING_EXTERNAL_FILE'
		| 'BARREL_DUMMY_BINDING'
		| 'UNUSED_BARREL_IMPORT';
	message: string;
	symbolName?: string;
	filePath?: string;
	line?: number;
	column?: number;
	rawMatch?: string;
	suggestedFix?: {
		label: string;
		action:
			| 'auto_repair_jsdoc'
			| 'reset_coords'
			| 'remove_annotation'
			| 'fix_path'
			| 'fix_d1_type'
			| 'migrate_dummy_to_manifest'
			| 'remove_unused_import';
		payload?: any;
	};
}

export interface PackageWrapperInfo {
	reExports: string[];
	candidateSchemaPath?: string;
	candidateSchemaLabel?: string;
	drizzleConfigPath?: string;
}

export type StorageTarget = 'd1' | 'do' | 'kv' | 'r2';

export interface ColumnDefinition {
	name: string;
	definition: string;
	isPk?: boolean;
	isReferences?: boolean;
	notNull?: boolean;
	defaultVal?: string;
	isAuthCore?: boolean;
	isCustomField?: boolean;
	ttl?: number;
	metadata?: string;
}

export interface StrataNodeData {
	label?: string;
	target?: StorageTarget;
	columns?: ColumnDefinition[];
	methods?: ColumnDefinition[];
	patterns?: ColumnDefinition[];
	folders?: ColumnDefinition[];
	strata?: Record<string, any>;
	line?: number;
	moduleInfo?: ModuleInfo;
	isExternal?: boolean;
	isBetterAuth?: boolean;
	provider?: 'clerk' | 'workos';
	title?: string;
	description?: string;
	boundTables?: Array<{ tableId: string; colName: string }>;
	[key: string]: any;
}

export interface StrataEdgeData {
	relationType?: string;
	isSynthetic?: boolean;
	isIdentityBoundary?: boolean;
	provider?: 'clerk' | 'workos';
	sourceCol?: string;
	targetCol?: string;
	relationName?: string;
	[key: string]: any;
}

export type StrataNode = Node<StrataNodeData>;
export type StrataEdge = Edge<StrataEdgeData>;

export interface ParseResult {
	success: boolean;
	nodes: StrataNode[];
	edges: StrataEdge[];
	error?: string;
	errorLoc?: { line: number, column: number } | null;
	externalImports?: { filePath: string; importNames: string[] }[];
	externalPaths?: string[]; // Custom paths parsed from JSDoc metadata (e.g. schema pointers, DO class paths)
	warnings?: string[];
	auditIssues?: AuditIssue[];
	wranglerPath?: string;
	layoutManifest?: Record<string, any>;
	packageWrapperInfo?: PackageWrapperInfo;
}

export interface ChainElement {
	name: string;
	args: string[];
}

export interface ModuleInfo {
	sourceFilePath: string;
	moduleName: string;
	isRootFile: boolean;
}

