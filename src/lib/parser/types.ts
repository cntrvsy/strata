/**
 * types.ts
 *
 * Summary: Shared TypeScript interfaces for parsing results and method chaining configurations.
 * Expects: None.
 * Output: Type definitions for ParseResult and ChainElement.
 */
import type { Node, Edge } from '@xyflow/svelte';

export interface ParseResult {
	success: boolean;
	nodes: Node[];
	edges: Edge[];
	error?: string;
	errorLoc?: { line: number, column: number } | null;
	externalImports?: { filePath: string; importNames: string[] }[];
	externalPaths?: string[]; // Custom paths parsed from JSDoc metadata (e.g. schema pointers, DO class paths)
	warnings?: string[];
	wranglerPath?: string;
}

export interface ChainElement {
	name: string;
	args: string[];
}
