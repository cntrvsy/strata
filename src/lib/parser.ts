import { Project, VariableDeclaration, SyntaxKind } from 'ts-morph'; // Parser core
import { type Node, type Edge } from '@xyflow/svelte';

const project = new Project({ useInMemoryFileSystem: true });
const sourceFile = project.createSourceFile('schema.ts', '');

interface ParseResult {
	success: boolean;
	nodes: Node[];
	edges: Edge[];
	error?: string;
}

export function parseSchema(code: string): ParseResult {
	try {
		sourceFile.replaceWithText(code);
		
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
				const isTable = initializer.includes('sqliteTable');
				
				// Get JSDoc metadata
				const jsDocs = statement.getJsDocs();
				let strataData: any = { x: Math.round(Math.random() * 200), y: Math.round(Math.random() * 200), target: isTable ? 'd1' : undefined };
				
				for (const doc of jsDocs) {
					const fullText = doc.getText();
					const match = fullText.match(/@strata\s+({[\s\S]*?})/);
					if (match) {
						try {
							const jsonStr = match[1].replace(/^\s*\*\s?/gm, '');
							const parsed = JSON.parse(jsonStr);
							strataData = { ...strataData, ...parsed };
						} catch (e) {
							console.warn('Failed to parse @strata JSON:', match[1], e);
						}
					}
				}

				if (isTable || strataData.target === 'kv') {
					const tableName = decl.getName();
					const target = strataData.target || (isTable ? 'd1' : 'kv');
					
					tableDeclarations.set(tableName, decl);
					
					nodes.push({
						id: tableName,
						type: 'table',
						data: { 
							label: tableName, 
							columns: isTable ? extractColumns(decl) : extractObjectFields(decl),
							target: target
						},
						position: { x: strataData.x, y: strataData.y }
					});
				}
			}
		}
		
		// Now extract relations after all tables are found
		for (const [tableName, decl] of tableDeclarations) {
			const initializer = decl.getInitializer()?.getText() || '';
			if (initializer.includes('sqliteTable')) {
				extractRelations(tableName, decl, edges, sourceFile);
			}
		}

		// Type Guarding: Filter out edges that point to non-existent tables
		const tableNames = new Set(nodes.map(n => n.id));
		const validEdges = edges.filter(e => tableNames.has(e.source) && tableNames.has(e.target));
		
		if (nodes.length === 0 && code.trim().length > 0) {
			return { success: false, error: 'No tables found in schema', nodes: [], edges: [] };
		}

		return { success: true, nodes, edges: validEdges };
	} catch (e: any) {
		return { success: false, error: e.message, nodes: [], edges: [] };
	}
}

function extractColumns(decl: VariableDeclaration) {
	const columns: any[] = [];
	const initializer = decl.getInitializer();
	if (!initializer) return columns;
	
	// The initializer itself might be the sqliteTable call, or it might be a descendant
	let tableCall;
	if (initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable') {
		tableCall = initializer;
	} else {
		tableCall = initializer.getDescendantsOfKind(SyntaxKind.CallExpression)
			.find(c => c.getExpression().getText() === 'sqliteTable');
	}
	
	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1) {
			const config = args[1].asKind(SyntaxKind.ObjectLiteralExpression);
			if (config) {
				for (const prop of config.getProperties()) {
					if (prop.isKind(SyntaxKind.PropertyAssignment)) {
						const name = prop.getName();
						const def = prop.getInitializer()?.getText() || '';
						columns.push({
							name: name,
							definition: def,
							isPk: def.includes('.primaryKey()'),
							isReferences: def.includes('.references(')
						});
					}
				}
			}
		}
	}
	return columns;
}

function extractObjectFields(decl: VariableDeclaration) {
	const fields: any[] = [];
	const initializer = decl.getInitializer();
	let objectLiteral = initializer;
	if (initializer?.getKind() === SyntaxKind.CallExpression) {
		const args = (initializer as any).getArguments();
		if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
			objectLiteral = args[0];
		}
	}

	if (objectLiteral && objectLiteral.getKind() === SyntaxKind.ObjectLiteralExpression) {
		const obj = objectLiteral as any;
		
		obj.getProperties().forEach((prop: any) => {
			if (prop.getKind() === SyntaxKind.PropertyAssignment) {
				fields.push({
					name: prop.getName(),
					definition: prop.getInitializer()?.getText() || 'any',
					isPk: false,
					isReferences: false
				});
			}
		});
	}
	return fields;
}

function extractRelations(tableName: string, decl: VariableDeclaration, edges: Edge[], sourceFile: any) {
	const physicalRelations = new Set<string>();

	// 1. Physical Relations (.references())
	const initializer = decl.getInitializer();
	if (initializer) {
		const callExps = initializer.getDescendantsOfKind(SyntaxKind.CallExpression);
		for (const call of callExps) {
			const expression = call.getExpression();
			const expressionText = expression.getText();
			if (expressionText.endsWith('.references')) {
				const args = call.getArguments();
				if (args.length > 0) {
					const refFn = args[0];
					let targetTable: string | undefined;

					if (refFn.isKind(SyntaxKind.ArrowFunction)) {
						const body = refFn.getBody();
						if (body.isKind(SyntaxKind.PropertyAccessExpression)) {
							targetTable = body.getExpression().getText();
						} else {
							// Fallback to regex if it's not a simple property access
							const match = refFn.getText().match(/=>\s*(\w+)\./);
							if (match) targetTable = match[1];
						}
					}

					if (targetTable) {
						physicalRelations.add(targetTable);
						const colName = call.getAncestors().find(a => a.isKind(SyntaxKind.PropertyAssignment))?.asKind(SyntaxKind.PropertyAssignment)?.getName();
						addEdgeIfUnique(edges, tableName, targetTable, false, undefined, colName);
					}
				}
			}
		}
	}

	// 2. Application Relations (relations() block)
	// We'll search for 'export const ... = relations(tableName, ...)'
	const sourceFileDecls = sourceFile.getVariableDeclarations();
	for (const d of sourceFileDecls) {
		const init = d.getInitializer();
		if (init?.isKind(SyntaxKind.CallExpression)) {
			const callExpr = init.getExpression();
			if (callExpr.getText() === 'relations') {
				const args = init.getArguments();
				if (args.length > 1 && args[0].getText() === tableName) {
					// Found relations block for tableName
					const configFn = args[1];
					if (configFn.isKind(SyntaxKind.ArrowFunction) || configFn.isKind(SyntaxKind.FunctionExpression)) {
						const body = configFn.isKind(SyntaxKind.ArrowFunction) ? configFn.getBody() : configFn.getBody();
						
						let objLiteral: any;
						if (body.isKind(SyntaxKind.ObjectLiteralExpression)) {
							objLiteral = body;
						} else if (body.isKind(SyntaxKind.Block)) {
							const returnStmt = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
							objLiteral = returnStmt?.getExpression();
						}

						if (objLiteral && objLiteral.isKind(SyntaxKind.ObjectLiteralExpression)) {
							for (const prop of objLiteral.getProperties()) {
								if (prop.isKind(SyntaxKind.PropertyAssignment)) {
									const relInit = prop.getInitializer();
									if (relInit?.isKind(SyntaxKind.CallExpression)) {
										const relExpr = relInit.getExpression();
										const relType = relExpr.getText(); // 'one' or 'many'
										const relArgs = relInit.getArguments();
										if (relArgs.length > 0) {
											const targetTable = relArgs[0].getText();
											const relName = prop.getName();
											const isVirtual = !physicalRelations.has(targetTable);
											addEdgeIfUnique(edges, tableName, targetTable, isVirtual, relType, relName);
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
}

function addEdgeIfUnique(edges: Edge[], source: string, target: string, isVirtual: boolean, relType?: string, name?: string) {
	// For relations, we might have multiple edges between same tables (different purposes)
	const id = `e-${source}-${target}-${name || (isVirtual ? 'v' : 'p')}`;
	
	if (source === target) return;
	
	const existing = edges.find(e => e.id === id);
	if (!existing) {
		edges.push({
			id,
			source,
			target,
			sourceHandle: 'source',
			targetHandle: 'target',
			animated: isVirtual,
			label: name || (relType ? relType : undefined),
			labelStyle: 'font-size: 10px; fill: oklch(var(--bc)); opacity: 0.5;',
			style: isVirtual 
				? 'stroke: var(--color-primary); stroke-width: 1.5; stroke-dasharray: 5 5; opacity: 0.4;'
				: 'stroke: var(--color-primary); stroke-width: 2; opacity: 0.7;',
			type: isVirtual ? 'default' : 'smoothstep'
		});
	}
}

export function addEdgeToSchema(code: string, source: string, target: string): string {
	sourceFile.replaceWithText(code);

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

export function updateNodePositionInSchema(code: string, tableName: string, x: number, y: number): string {
	sourceFile.replaceWithText(code);
	
	const decl = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
		.find(d => d.getName() === tableName);
	
	if (decl) {
		const statement = decl.getVariableStatement();
		if (statement) {
			const jsDocs = statement.getJsDocs();
			let strataFound = false;

			for (const doc of jsDocs) {
				const text = doc.getText();
				const strataMatch = text.match(/@strata\s+({[^}]*})/);
				
				if (strataMatch) {
					try {
						const metadata = JSON.parse(strataMatch[1]);
						metadata.x = Math.round(x);
						metadata.y = Math.round(y);
						
						const newStrataText = `@strata ${JSON.stringify(metadata)}`;
						const newDocText = text.replace(/@strata\s+{[^}]*}/, newStrataText);
						doc.replaceWithText(newDocText);
						strataFound = true;
						break;
					} catch (e) {
						console.error("Failed to parse existing strata metadata:", e);
					}
				}
			}

			if (!strataFound) {
				statement.addJsDoc({
					description: `\n * @strata { "x": ${Math.round(x)}, "y": ${Math.round(y)} }\n `
				});
			}
		}
	}

	return sourceFile.getFullText();
}
