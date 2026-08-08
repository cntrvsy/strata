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
	code: 'JSDOC_SYNTAX_ERROR' | 'INVALID_TARGET' | 'DANGLING_RELATION' | 'TYPE_MISMATCH' | 'WRANGLER_MISMATCH';
	message: string;
	symbolName?: string;
	filePath?: string;
	line?: number;
	column?: number;
	rawMatch?: string;
	suggestedFix?: {
		label: string;
		action: 'auto_repair_jsdoc' | 'reset_coords' | 'remove_annotation';
	};
}

export interface ParseResult {
	success: boolean;
	nodes: Node[];
	edges: Edge[];
	error?: string;
	errorLoc?: { line: number, column: number } | null;
	externalImports?: { filePath: string; importNames: string[] }[];
	externalPaths?: string[]; // Custom paths parsed from JSDoc metadata (e.g. schema pointers, DO class paths)
	warnings?: string[];
	auditIssues?: AuditIssue[];
	wranglerPath?: string;
}

export interface ChainElement {
	name: string;
	args: string[];
}

