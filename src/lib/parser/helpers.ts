/**
 * helpers.ts
 *
 * Summary: AST traversal helper functions for Drizzle table declarations and method chaining.
 * Expects: ts-morph AST nodes or source files.
 * Output: Resolved Drizzle function calls, column chains, and relation declarations.
 */
import { VariableDeclaration, SyntaxKind, SourceFile, Node as ASTNode } from 'ts-morph';
import type { ChainElement } from '$lib/parser/types';

/**
 * Resolves the underlying Drizzle table CallExpression node from an initializer.
 * Supports sqliteTable, pgTable, mysqlTable, singlestoreTable, and custom wrappers.
 */
export function findSqliteTableCall(initializer: ASTNode): any {
	const isTableFn = (name: string) => 
		['sqliteTable', 'pgTable', 'mysqlTable', 'singlestoreTable'].includes(name) || name.endsWith('Table');

	if (initializer.isKind(SyntaxKind.CallExpression)) {
		const exprText = initializer.getExpression().getText();
		if (isTableFn(exprText)) return initializer;
	}

	return initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find(c => {
		const text = c.getExpression().getText();
		return isTableFn(text);
	});
}

/**
 * Robustly checks if a variable declaration is initialized with a Drizzle table.
 * Resolves the table symbol to confirm it is imported from a Drizzle ORM package.
 */
export function isDrizzleTableDeclaration(decl: VariableDeclaration): boolean {
	const initializer = decl.getInitializer();
	if (!initializer) return false;

	const tableCall = findSqliteTableCall(initializer);
	if (!tableCall) return false;

	const identifier = tableCall.getExpression();
	const symbol = identifier.getSymbol();
	if (!symbol) {
		// Fallback to text matching if symbol resolution is unavailable
		const text = initializer.getText();
		return text.includes('Table') || text.includes('sqliteTable') || text.includes('pgTable') || text.includes('mysqlTable');
	}

	const declarations = symbol.getDeclarations();
	for (const d of declarations) {
		if (d.isKind(SyntaxKind.ImportSpecifier)) {
			const importDecl = d.getImportDeclaration();
			const moduleSpecifier = importDecl.getModuleSpecifierValue();
			if (moduleSpecifier.includes('drizzle-orm')) {
				return true;
			}
		}
	}

	// Fallback check if it follows table initialization structure (e.g. 2+ arguments with object literal columns)
	const args = tableCall.getArguments();
	if (args.length >= 2 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
		return true;
	}

	return false;
}

/**
 * Helper to parse a chained column declaration call expression (e.g. integer("id").primaryKey().notNull())
 */
export function parseColumnChain(node: ASTNode): { baseCallText: string, modifiers: ChainElement[] } {
	const modifiers: ChainElement[] = [];
	let current = node;

	while (current.isKind(SyntaxKind.CallExpression)) {
		const expr = current.getExpression();
		if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
			const name = expr.getName();
			const args = current.getArguments().map(a => a.getText());
			modifiers.unshift({ name, args });
			current = expr.getExpression();
		} else {
			break;
		}
	}
	return {
		baseCallText: current.getText(),
		modifiers
	};
}

export function buildColumnChain(baseCallText: string, modifiers: ChainElement[]): string {
	let chain = baseCallText;
	for (const mod of modifiers) {
		chain += `.${mod.name}(${mod.args.join(', ')})`;
	}
	return chain;
}

/**
 * Ensures required imports exist in a file.
 */
export function ensureImports(sf: SourceFile, module: string, names: string[]) {
	let imp = sf.getImportDeclaration(i => i.getModuleSpecifierValue() === module);
	if (!imp) {
		sf.addImportDeclaration({ moduleSpecifier: module, namedImports: names });
	} else {
		const existing = imp.getNamedImports().map(n => n.getName());
		for (const name of names) {
			if (!existing.includes(name)) imp.addNamedImport(name);
		}
	}
}

/**
 * Helper to resolve relative path from base file path.
 * Normalizes all backslashes to forward slashes for cross-platform portability.
 */
export function resolveRelativePath(base: string, rel: string): string {
	const normalizedBase = base.replace(/\\/g, '/');
	const normalizedRel = rel.replace(/\\/g, '/');

	if (normalizedRel.startsWith('/') || /^[a-zA-Z]:\//.test(normalizedRel)) {
		return normalizedRel.endsWith('.ts') ? normalizedRel : normalizedRel + '.ts';
	}

	// Handle workspace root relative paths (e.g., ./src/... or src/...)
	if (normalizedRel.startsWith('./src/') || normalizedRel.startsWith('src/')) {
		const srcIdx = normalizedBase.lastIndexOf('/src/');
		if (srcIdx !== -1) {
			const root = normalizedBase.slice(0, srcIdx);
			const cleanRel = normalizedRel.replace(/^\.\//, '');
			let resolved = `${root}/${cleanRel}`;
			if (!resolved.endsWith('.ts')) {
				resolved += '.ts';
			}
			return resolved;
		}
	}

	const parts = normalizedBase.split('/');
	parts.pop(); // Remove filename
	const relParts = normalizedRel.split('/');
	for (const part of relParts) {
		if (part === '.') continue;
		if (part === '..') {
			parts.pop();
		} else {
			parts.push(part);
		}
	}
	let resolved = parts.join('/');
	if (!resolved.endsWith('.ts')) {
		resolved += '.ts';
	}
	return resolved;
}

/**
 * Resolves a path alias (like $lib/* or @/*) to its full resolved path using tsconfig compilerOptions.paths.
 */
export function resolvePathAlias(
	specifier: string,
	paths: Record<string, string[]>,
	tsconfigPath: string
): string | null {
	const normalizedTsconfig = tsconfigPath.replace(/\\/g, '/');
	const tsconfigDir = normalizedTsconfig.split('/').slice(0, -1).join('/');

	for (const [pattern, replacements] of Object.entries(paths)) {
		if (pattern === specifier && replacements.length > 0) {
			return resolveRelativePath(tsconfigDir + '/dummy.ts', replacements[0]);
		}
		if (pattern.endsWith('/*')) {
			const prefix = pattern.slice(0, -2);
			if (specifier.startsWith(prefix + '/')) {
				const subPath = specifier.slice(prefix.length + 1);
				const replacement = replacements[0].replace(/\*/g, subPath);
				return resolveRelativePath(tsconfigDir + '/dummy.ts', replacement);
			}
		}
	}
	return null;
}

export interface ExtractedStrataMetadata {
	rawMatch: string;
	jsonStr: string;
	data: any;
	issue?: {
		message: string;
		code: 'JSDOC_SYNTAX_ERROR' | 'INVALID_TARGET' | 'TYPE_MISMATCH';
	};
}

/**
 * Robustly extracts balanced JSDoc @strata JSON metadata from text using a character stack parser.
 * Handles nested objects, arrays, string quotes, escaped characters, and multi-line JSDoc comment asterisks.
 */
export function extractStrataMetadata(text: string): ExtractedStrataMetadata | null {
	const strataIdx = text.indexOf('@strata');
	if (strataIdx === -1) return null;

	const startBraceIdx = text.indexOf('{', strataIdx);
	if (startBraceIdx === -1) {
		return {
			rawMatch: '@strata',
			jsonStr: '',
			data: null,
			issue: {
				message: 'Malformed @strata JSDoc: Missing opening bracket `{`',
				code: 'JSDOC_SYNTAX_ERROR'
			}
		};
	}

	let depth = 0;
	let inString = false;
	let quoteChar = '';
	let endBraceIdx = -1;

	for (let i = startBraceIdx; i < text.length; i++) {
		const char = text[i];
		const prevChar = i > 0 ? text[i - 1] : '';

		if (inString) {
			if (char === '\\' && prevChar !== '\\') {
				i++; // Skip escaped character
				continue;
			}
			if (char === quoteChar) {
				inString = false;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			inString = true;
			quoteChar = char;
			continue;
		}

		if (char === '{') {
			depth++;
		} else if (char === '}') {
			depth--;
			if (depth === 0) {
				endBraceIdx = i;
				break;
			}
		}
	}

	if (endBraceIdx === -1) {
		const rawMatch = text.slice(strataIdx, Math.min(text.length, strataIdx + 100));
		return {
			rawMatch,
			jsonStr: rawMatch,
			data: null,
			issue: {
				message: 'Malformed @strata JSDoc: Unclosed closing bracket `}`',
				code: 'JSDOC_SYNTAX_ERROR'
			}
		};
	}

	const rawMatch = text.slice(strataIdx, endBraceIdx + 1);
	const rawJson = text.slice(startBraceIdx, endBraceIdx + 1);
	// Clean leading JSDoc asterisks from multiline JSON strings
	const cleanJson = rawJson.replace(/^\s*\*\s?/gm, '');

	try {
		const data = JSON.parse(cleanJson);
		return {
			rawMatch,
			jsonStr: cleanJson,
			data
		};
	} catch (e: any) {
		// Attempt soft JSON repair (convert single quotes, remove trailing commas)
		const softRepaired = trySoftRepairJson(cleanJson);
		if (softRepaired) {
			return {
				rawMatch,
				jsonStr: cleanJson,
				data: softRepaired,
				issue: {
					message: 'JSDoc @strata syntax formatting issue (single quotes or trailing commas auto-repaired)',
					code: 'JSDOC_SYNTAX_ERROR'
				}
			};
		}

		console.warn('[Strata] Failed to parse @strata JSON payload:', cleanJson, e);
		return {
			rawMatch,
			jsonStr: cleanJson,
			data: null,
			issue: {
				message: `Invalid JSDoc JSON syntax: ${e?.message || String(e)}`,
				code: 'JSDOC_SYNTAX_ERROR'
			}
		};
	}
}

function trySoftRepairJson(jsonStr: string): any | null {
	try {
		const sanitized = jsonStr
			.replace(/\/\/.*/g, '')
			.replace(/'([^'\\]*?)'\s*:/g, '"$1":')
			.replace(/:\s*'([^'\\]*?)'/g, ': "$1"')
			.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
			.replace(/,(\s*[}\]])/g, '$1');
		return JSON.parse(sanitized);
	} catch {
		return null;
	}
}


