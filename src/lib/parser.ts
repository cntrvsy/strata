import { Project, VariableDeclaration, SyntaxKind } from 'ts-morph';
import { type Node, type Edge } from '@xyflow/svelte';

const project = new Project({ useInMemoryFileSystem: true });

interface ParseResult {
	success: boolean;
	nodes: Node[];
	edges: Edge[];
	error?: string;
}

export function parseSchema(code: string): ParseResult {
	try {
		const sourceFile = project.createSourceFile('temp-schema.ts', code, { overwrite: true });
		
		const nodes: Node[] = [];
		const edges: Edge[] = [];
		
		// Check for syntax errors (basic check)
		const diagnostics = sourceFile.getPreEmitDiagnostics();
		if (diagnostics.length > 10) { // A few errors might be okay (missing imports etc), but 10+ usually means invalid structure
			// console.warn('Many diagnostics found, schema might be invalid');
		}

		// Find all exported declarations
		const variableStatements = sourceFile.getVariableStatements();
		const tableDeclarations = new Map<string, VariableDeclaration>();
		
		for (const statement of variableStatements) {
			const declarations = statement.getDeclarations();
			for (const decl of declarations) {
				const initializer = decl.getInitializer()?.getText() || '';
				if (initializer.includes('sqliteTable')) {
					const tableName = decl.getName();
					tableDeclarations.set(tableName, decl);
					
					// Get JSDoc metadata
					const jsDocs = statement.getJsDocs();
					let strataData = { x: Math.round(Math.random() * 200), y: Math.round(Math.random() * 200) };
					
					for (const doc of jsDocs) {
						const fullText = doc.getText();
						const match = fullText.match(/@strata\s+({[\s\S]*?})/);
						if (match) {
							try {
								// Clean up asterisks and extra whitespace if it's a multiline JSDoc
								const jsonStr = match[1].replace(/^\s*\*\s?/gm, '');
								strataData = JSON.parse(jsonStr);
							} catch (e) {
								console.warn('Failed to parse @strata JSON:', match[1], e);
							}
						}
					}
					
					nodes.push({
						id: tableName,
						type: 'table',
						data: { label: tableName, columns: extractColumns(decl) },
						position: { x: strataData.x, y: strataData.y }
					});
				}
			}
		}
		
		// Now extract relations after all tables are found
		for (const [tableName, decl] of tableDeclarations) {
			extractRelations(tableName, decl, edges, sourceFile);
		}
		
		if (nodes.length === 0 && code.trim().length > 0) {
			return { success: false, error: 'No tables found in schema', nodes: [], edges: [] };
		}

		return { success: true, nodes, edges };
	} catch (e: any) {
		return { success: false, error: e.message, nodes: [], edges: [] };
	}
}

function extractColumns(decl: VariableDeclaration) {
	const columns: any[] = [];
	const initializer = decl.getInitializer();
	if (!initializer) return columns;
	
	const args = initializer.asKind(SyntaxKind.CallExpression)?.getArguments();
	if (args && args.length > 1) {
		const config = args[1].asKind(SyntaxKind.ObjectLiteralExpression);
		if (config) {
			for (const prop of config.getProperties()) {
				if (prop.isKind(SyntaxKind.PropertyAssignment)) {
					columns.push({
						name: prop.getName(),
						definition: prop.getInitializer()?.getText() || ''
					});
				}
			}
		}
	}
	return columns;
}

function extractRelations(tableName: string, decl: VariableDeclaration, edges: Edge[], sourceFile: any) {
	// Method 1: Column-level .references()
	const initializer = decl.getInitializer();
	if (initializer) {
		const args = initializer.asKind(SyntaxKind.CallExpression)?.getArguments();
		if (args && args.length > 1) {
			const config = args[1].asKind(SyntaxKind.ObjectLiteralExpression);
			if (config) {
				for (const prop of config.getProperties()) {
					if (prop.isKind(SyntaxKind.PropertyAssignment)) {
						const def = prop.getInitializer()?.getText() || '';
						// Match: .references(() => users.id)
						const refMatch = def.match(/\.references\(\(\)\s*=>\s*(.*?)\./);
						if (refMatch) {
							addEdgeIfUnique(edges, tableName, refMatch[1].trim());
						}
					}
				}
			}
		}
	}

	// Method 2: relations() block
	const variableStatements = sourceFile.getVariableStatements();
	for (const statement of variableStatements) {
		for (const d of statement.getDeclarations()) {
			const initText = d.getInitializer()?.getText() || '';
			if (initText.startsWith('relations(')) {
				// Check if this relations block is for OUR table
				const args = d.getInitializer()?.asKind(SyntaxKind.CallExpression)?.getArguments();
				if (args && args.length > 0 && args[0].getText() === tableName) {
					// We are in the relations block for tableName
					// Look for one() and many() calls
					const targetMatches = initText.matchAll(/(one|many)\((.*?)[,)]/g);
					for (const m of targetMatches) {
						const targetTable = m[2].trim();
						if (targetTable !== tableName) {
							addEdgeIfUnique(edges, tableName, targetTable);
						}
					}
				}
			}
		}
	}
}

function addEdgeIfUnique(edges: Edge[], source: string, target: string) {
	const id = `e-${source}-${target}`;
	// Avoid duplicates and self-references
	if (source === target) return;
	if (!edges.find(e => e.id === id)) {
		edges.push({
			id,
			source,
			target,
			sourceHandle: 'source',
			targetHandle: 'target',
			animated: true,
			style: 'stroke: var(--color-primary); stroke-width: 2; opacity: 0.6;',
			type: 'smoothstep'
		});
	}
}

export function addEdgeToSchema(code: string, source: string, target: string): string {
	const sourceFile = project.createSourceFile('temp-schema-edit.ts', code, { overwrite: true });

	// Check if relations is imported
	const imports = sourceFile.getImportDeclarations();
	let hasRelationsImport = false;
	for (const imp of imports) {
		const moduleSpecifier = imp.getModuleSpecifierValue();
		if (moduleSpecifier.includes('drizzle-orm') || moduleSpecifier.includes('drizzle-orm/relations')) {
			const namedImports = imp.getNamedImports().map(n => n.getName());
			if (namedImports.includes('relations')) {
				hasRelationsImport = true;
				break;
			}
		}
	}

	if (!hasRelationsImport) {
		sourceFile.addImportDeclaration({
			moduleSpecifier: 'drizzle-orm/relations',
			namedImports: ['relations']
		});
	}

	const relationName = `${source}Relations`;
	
	// Check if relation already exists to avoid duplicates
	let existingRelation = false;
	const variableStatements = sourceFile.getVariableStatements();
	for (const statement of variableStatements) {
		for (const d of statement.getDeclarations()) {
			if (d.getName() === relationName) {
				existingRelation = true;
			}
		}
	}

	if (!existingRelation) {
		sourceFile.addVariableStatement({
			isExported: true,
			declarations: [{
				name: relationName,
				initializer: `relations(${source}, ({ many }) => ({
  ${target}s: many(${target})
}))`
			}]
		});
	}

	return sourceFile.getFullText();
}
