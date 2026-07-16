/**
 * helpers.ts
 *
 * Summary: AST traversal helper functions for Drizzle table declarations and method chaining.
 * Expects: ts-morph AST nodes or source files.
 * Output: Resolved Drizzle function calls, column chains, and relation declarations.
 */
import { VariableDeclaration, SyntaxKind, SourceFile, Node as ASTNode } from 'ts-morph';
import type { ChainElement } from './types';

/**
 * Resolves the underlying drizzle sqliteTable CallExpression node from an initializer.
 */
export function findSqliteTableCall(initializer: ASTNode): any {
	if (initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable') {
		return initializer;
	}
	return initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find(c => c.getExpression().getText() === 'sqliteTable');
}

/**
 * Robustly checks if a variable declaration is initialized with a Drizzle sqliteTable.
 * Resolves the sqliteTable symbol to confirm it is imported from a module starting with 'drizzle-orm'.
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
		return initializer.getText().includes('sqliteTable');
	}

	const declarations = symbol.getDeclarations();
	for (const d of declarations) {
		if (d.isKind(SyntaxKind.ImportSpecifier)) {
			const importDecl = d.getImportDeclaration();
			const moduleSpecifier = importDecl.getModuleSpecifierValue();
			if (moduleSpecifier.startsWith('drizzle-orm')) {
				return true;
			}
		}
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
