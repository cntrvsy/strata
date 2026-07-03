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
