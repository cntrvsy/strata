/**
 * parser.ts
 * 
 * The core engine of Strata. This module handles the bidirectional mapping
 * between TypeScript source code (Drizzle ORM) and the visual ERD representation.
 * 
 * It uses `ts-morph` for Abstract Syntax Tree (AST) manipulation, allowing us to
 * surgically inject, rename, and remove code while preserving user formatting and comments.
 */

import { Project, VariableDeclaration, SyntaxKind, SourceFile, ImportSpecifier, Node as ASTNode } from 'ts-morph';
import { type Node, type Edge, MarkerType } from '@xyflow/svelte';

/**
 * Persisted ts-morph project and source file to maintain AST state across parses.
 * Using a singleton project and source file object ensures that we can perform 
 * incremental updates and maintain references to AST nodes.
 */
const project = new Project({ useInMemoryFileSystem: true });
let sourceFile = project.createSourceFile('schema.ts', '');

interface ParseResult {
	success: boolean;
	nodes: Node[];
	edges: Edge[];
	error?: string;
	errorLoc?: { line: number, column: number } | null;
}

/**
 * Ensures the source file is in sync with the provided code.
 * Reuses the existing source file object to maintain AST references.
 * 
 * @param code The raw TypeScript code to load into the AST.
 * @returns The synchronized SourceFile object.
 */
function syncSourceFile(code: string) {
	if (sourceFile.getFullText() !== code) {
		sourceFile.replaceWithText(code);
	}
	return sourceFile;
}

/**
 * Resolves the underlying drizzle sqliteTable CallExpression node from an initializer.
 */
function findSqliteTableCall(initializer: ASTNode): any {
	if (initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable') {
		return initializer;
	}
	return initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find(c => c.getExpression().getText() === 'sqliteTable');
}

/**
 * Robustly checks if a variable declaration is initialized with a Drizzle sqliteTable.
 * Resolves the sqliteTable symbol to confirm it is imported from a module starting with 'drizzle-orm'.
 */
function isDrizzleTableDeclaration(decl: VariableDeclaration): boolean {
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
 * Wraps raw code in pre/code tags for UI presentation.
 */
export function wrapCode(code: string) {
	return `<pre><code>${code}</code></pre>`;
}

/**
 * Parses a Drizzle schema file into Svelte Flow nodes and edges.
 * Handles D1 (sqliteTable), KV (plain objects), and relations.
 */
export function parseSchema(code: string): ParseResult {
	try {
		const sf = syncSourceFile(code);
		
		const nodes: Node[] = [];
		const edges: Edge[] = [];
		
		// Find all exported declarations
		const variableStatements = sf.getVariableStatements();
		const tableDeclarations = new Map<string, VariableDeclaration>();
		
		for (const statement of variableStatements) {
			const declarations = statement.getDeclarations();
			for (const decl of declarations) {
				const isTable = isDrizzleTableDeclaration(decl);
				
				// Extract @strata metadata from JSDoc
				const jsDocs = statement.getJsDocs();
				let strataData: any = { 
					x: Math.round(Math.random() * 200), 
					y: Math.round(Math.random() * 200), 
					target: isTable ? 'd1' : undefined 
				};
				
				for (const doc of jsDocs) {
					const fullText = doc.getText();
					const match = fullText.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
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

				// Only process if it's a known storage target
				if (isTable || strataData.target === 'kv' || strataData.target === 'do') {
					const tableName = decl.getName();
					const target = strataData.target || (isTable ? 'd1' : 'kv');
					
					tableDeclarations.set(tableName, decl);
					
					nodes.push({
						id: tableName,
						type: 'table',
						data: { 
							label: tableName, 
							columns: isTable ? extractColumns(decl) : extractObjectFields(decl),
							target: target,
							strata: strataData
						},
						position: { x: strataData.x, y: strataData.y }
					});

					// Handle Synthetic Relations (JSDoc based)
					if (strataData.relations && Array.isArray(strataData.relations)) {
						for (const rel of strataData.relations) {
							addEdgeIfUnique(edges, tableName, rel.to, true, 'synthetic');
						}
					}
				}
			}
		}
		
		// Extract Drizzle-native relations
		for (const [tableName, decl] of tableDeclarations) {
			const initializer = decl.getInitializer()?.getText() || '';
			if (initializer.includes('sqliteTable')) {
				extractRelations(tableName, decl, edges, sf);
			}
		}

		// Cleanup: Ensure all edges point to existing nodes
		const tableNames = new Set(nodes.map(n => n.id));
		const validEdges = edges.filter(e => tableNames.has(e.source) && tableNames.has(e.target));
		
		if (nodes.length === 0 && code.trim().length > 0) {
			return { success: false, error: 'No tables or schema objects found', nodes: [], edges: [] };
		}

		return { success: true, nodes, edges: validEdges };
	} catch (e: any) {
		console.error("[Strata] Parse critical failure:", e);
		
		// Attempt to extract line/column for inline linting
		let line = 1;
		let column = 0;
		const match = e.message?.match(/(\d+):(\d+)/);
		if (match) {
			line = parseInt(match[1]);
			column = parseInt(match[2]);
		}

		return { 
			success: false, 
			error: e.message || "Unknown Error",
			errorLoc: { line, column },
			nodes: [],
			edges: []
		};
	}
}

/**
 * Helper to parse a chained column declaration call expression (e.g. integer("id").primaryKey().notNull())
 */
interface ChainElement {
	name: string;
	args: string[];
}

function parseColumnChain(node: ASTNode): { baseCallText: string, modifiers: ChainElement[] } {
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

function buildColumnChain(baseCallText: string, modifiers: ChainElement[]): string {
	let chain = baseCallText;
	for (const mod of modifiers) {
		chain += `.${mod.name}(${mod.args.join(', ')})`;
	}
	return chain;
}

/**
 * Extracts column definitions from a Drizzle sqliteTable declaration.
 */
function extractColumns(decl: VariableDeclaration) {
	const columns: any[] = [];
	const initializer = decl.getInitializer();
	if (!initializer) return columns;
	
	let tableCall = findSqliteTableCall(initializer);
	
	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1) {
			const config = args[1].asKind(SyntaxKind.ObjectLiteralExpression);
			if (config) {
				for (const prop of config.getProperties()) {
					if (prop.isKind(SyntaxKind.PropertyAssignment)) {
						const name = prop.getName();
						const def = prop.getInitializer()?.getText() || '';
						const initNode = prop.getInitializer();
						let isPk = def.includes('.primaryKey()');
						let notNull = def.includes('.notNull()');
						let defaultVal: string | undefined = undefined;
						let isReferences = def.includes('.references(');

						if (initNode) {
							const { modifiers } = parseColumnChain(initNode);
							isPk = modifiers.some(m => m.name === 'primaryKey');
							notNull = modifiers.some(m => m.name === 'notNull');
							const defaultMod = modifiers.find(m => m.name === 'default' || m.name === 'defaultTo');
							if (defaultMod && defaultMod.args.length > 0) {
								defaultVal = defaultMod.args[0];
							}
							isReferences = modifiers.some(m => m.name === 'references');
						}

						columns.push({
							name: name,
							definition: def,
							isPk,
							notNull,
							defaultVal,
							isReferences
						});
					}
				}
			}
		}
	}
	return columns;
}

/**
 * Extracts fields from a plain object (used for KV/DO mocking).
 */
function extractObjectFields(decl: VariableDeclaration) {
	const fields: any[] = [];
	const initializer = decl.getInitializer();
	let objectLiteral: any = initializer;

	if (initializer?.isKind(SyntaxKind.CallExpression)) {
		const args = initializer.getArguments();
		if (args.length > 0 && args[0].isKind(SyntaxKind.ObjectLiteralExpression)) {
			objectLiteral = args[0];
		}
	}

	if (objectLiteral && objectLiteral.isKind(SyntaxKind.ObjectLiteralExpression)) {
		for (const prop of objectLiteral.getProperties()) {
			if (prop.isKind(SyntaxKind.PropertyAssignment)) {
				fields.push({
					name: prop.getName(),
					definition: prop.getInitializer()?.getText() || 'any',
					isPk: false,
					isReferences: false
				});
			}
		}
	}
	return fields;
}

/**
 * Extracts both physical (FK) and logical (relations()) relationships.
 */
function extractRelations(tableName: string, decl: VariableDeclaration, edges: Edge[], sf: any) {
	const physicalRelations = new Set<string>();

	// Helper to find if a target relation exists and what wrapper it uses (many or one)
	const getRelationWrapper = (fromTable: string, toTable: string): string | null => {
		const sourceFileDecls = sf.getVariableDeclarations();
		for (const d of sourceFileDecls) {
			const init = d.getInitializer();
			if (init?.isKind(SyntaxKind.CallExpression) && init.getExpression().getText() === 'relations') {
				const args = init.getArguments();
				if (args.length > 1 && args[0].getText() === fromTable) {
					const body = (args[1] as any).getBody();
					const objLiteral = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
					if (objLiteral) {
						for (const prop of objLiteral.getProperties()) {
							if (prop.isKind(SyntaxKind.PropertyAssignment)) {
								const relInit = prop.getInitializer();
								if (relInit?.isKind(SyntaxKind.CallExpression) && relInit.getArguments()[0]?.getText() === toTable) {
									return relInit.getExpression().getText(); // e.g. "one" or "many"
								}
							}
						}
					}
				}
			}
		}
		return null;
	};

	// 1. Physical Foreign Keys
	const initializer = decl.getInitializer();
	if (initializer) {
		const callExps = initializer.getDescendantsOfKind(SyntaxKind.CallExpression);
		for (const call of callExps) {
			if (call.getExpression().getText().endsWith('.references')) {
				const args = call.getArguments();
				if (args.length > 0) {
					const match = args[0].getText().match(/=>\s*(\w+)\./);
					if (match) {
						const targetTable = match[1];
						physicalRelations.add(targetTable);
						const colName = call.getAncestors().find(a => a.isKind(SyntaxKind.PropertyAssignment))?.asKind(SyntaxKind.PropertyAssignment)?.getName();
						addEdgeIfUnique(edges, tableName, targetTable, false, 'fk', colName, '1:N');
					}
				}
			}
		}
	}

	// 2. Logical Drizzle relations()
	const sourceFileDecls = sf.getVariableDeclarations();
	for (const d of sourceFileDecls) {
		const init = d.getInitializer();
		if (init?.isKind(SyntaxKind.CallExpression) && init.getExpression().getText() === 'relations') {
			const args = init.getArguments();
			if (args.length > 1 && args[0].getText() === tableName) {
				const body = (args[1] as any).getBody();
				const objLiteral = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];

				if (objLiteral) {
					for (const prop of objLiteral.getProperties()) {
						if (prop.isKind(SyntaxKind.PropertyAssignment)) {
							const relInit = prop.getInitializer();
							if (relInit?.isKind(SyntaxKind.CallExpression)) {
								const relType = relInit.getExpression().getText(); 
								const targetTable = relInit.getArguments()[0]?.getText();
								if (targetTable) {
									const isVirtual = !physicalRelations.has(targetTable);
									
									// Determine Cardinality:
									let cardinality: '1:1' | '1:N' | 'N:1' | 'unknown' = 'unknown';
									if (relType === 'many') {
										cardinality = '1:N';
									} else if (relType === 'one') {
										const reverseType = getRelationWrapper(targetTable, tableName);
										if (reverseType === 'one') {
											cardinality = '1:1';
										} else {
											cardinality = 'N:1';
										}
									}
									
									addEdgeIfUnique(edges, tableName, targetTable, isVirtual, relType, prop.getName(), cardinality);
								}
							}
						}
					}
				}
			}
		}
	}
}

/**
 * Adds an edge to the diagram if it doesn't already exist.
 * Standardizes styling for physical vs virtual vs synthetic edges.
 */
function addEdgeIfUnique(
	edges: Edge[], 
	source: string, 
	target: string, 
	isVirtual: boolean, 
	relType?: string, 
	name?: string,
	cardinality: '1:1' | '1:N' | 'N:1' | 'unknown' = 'unknown'
) {
	const id = `e-${source}-${target}-${name || (isVirtual ? 'v' : 'p')}`;
	if (source === target || edges.some(e => e.id === id)) return;
	
	edges.push({
		id,
		source,
		target,
		sourceHandle: 'source',
		targetHandle: 'target',
		animated: isVirtual,
		label: name || (relType !== 'fk' ? relType : undefined),
		labelStyle: 'font-size: 10px; fill: #475569; font-weight: bold;',
		style: isVirtual 
			? 'stroke: var(--color-primary); stroke-width: 1.5; stroke-dasharray: 4 4; opacity: 0.5;'
			: 'stroke: var(--color-primary); stroke-width: 2; opacity: 0.8;',
		type: 'relation',
		data: { isVirtual, cardinality },
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 15,
			height: 15,
			color: isVirtual ? '#94a3b8' : '#475569',
		}
	});
}

/**
 * Updates a node's position inside its @strata JSDoc metadata.
 */
export function updateNodePositionInSchema(code: string, tableName: string, x: number, y: number): string {
	const sf = syncSourceFile(code);
	const decl = sf.getVariableDeclaration(tableName);
	
	if (decl) {
		const statement = decl.getVariableStatement();
		if (statement) {
			const jsDocs = statement.getJsDocs();
			let strataFound = false;

			for (const doc of jsDocs) {
				const text = doc.getText();
				const strataMatch = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
				
				if (strataMatch) {
					try {
						const metadata = JSON.parse(strataMatch[1].replace(/^\s*\*\s?/gm, ''));
						metadata.x = Math.round(x);
						metadata.y = Math.round(y);
						doc.replaceWithText(text.replace(strataMatch[0], `@strata ${JSON.stringify(metadata)}`));
						strataFound = true;
						break;
					} catch (e) { console.error(e); }
				}
			}

			if (!strataFound) {
				statement.addJsDoc({ description: `\n * @strata { "x": ${Math.round(x)}, "y": ${Math.round(y)} }\n ` });
			}
		}
	}
	return sf.getFullText();
}

/**
 * Batches updates to node positions inside @strata JSDoc metadata in a single AST pass.
 */
export function updateAllNodePositionsInSchema(code: string, nodes: Node[]): string {
	const sf = syncSourceFile(code);
	for (const node of nodes) {
		const decl = sf.getVariableDeclaration(node.id);
		if (decl) {
			const statement = decl.getVariableStatement();
			if (statement) {
				const jsDocs = statement.getJsDocs();
				let strataFound = false;

				for (const doc of jsDocs) {
					const text = doc.getText();
					const strataMatch = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
					
					if (strataMatch) {
						try {
							const metadata = JSON.parse(strataMatch[1].replace(/^\s*\*\s?/gm, ''));
							metadata.x = Math.round(node.position.x);
							metadata.y = Math.round(node.position.y);
							doc.replaceWithText(text.replace(strataMatch[0], `@strata ${JSON.stringify(metadata)}`));
							strataFound = true;
							break;
						} catch (e) { console.error(e); }
					}
				}

				if (!strataFound) {
					statement.addJsDoc({ description: `\n * @strata { "x": ${Math.round(node.position.x)}, "y": ${Math.round(node.position.y)} }\n ` });
				}
			}
		}
	}
	return sf.getFullText();
}

/**
 * Ensures required imports exist in a file.
 */
function ensureImports(sf: SourceFile, module: string, names: string[]) {
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
 * Adds a new table or plain object entity to the schema.
 */
export function addTableToSchema(code: string, tableName: string, target: 'd1' | 'do' | 'kv' = 'd1'): string {
	const sf = syncSourceFile(code);
	
	if (target === 'd1' || target === 'do') {
		ensureImports(sf, "drizzle-orm/sqlite-core", ["sqliteTable", "integer", "text"]);
		const targetLabel = target === 'do' ? ',"target":"do"' : '';
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}${targetLabel}} \n */\nexport const ${tableName} = sqliteTable("${tableName}", {
  id: integer("id").primaryKey(),
});\n`;
		sf.insertText(sf.getFullWidth(), content);
	} else {
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}, "target": "kv"} \n */\nexport const ${tableName} = {\n  id: "string",\n};\n`;
		sf.insertText(sf.getFullWidth(), content);
	}
	return sf.getFullText();
}

/**
 * Adds a new column or field to an existing entity.
 */
export function addColumnToSchema(
	code: string, 
	tableName: string, 
	columnName: string, 
	type: string = 'text',
	referencesTable?: string,
	referencesColumn?: string
): string {
	const sf = syncSourceFile(code);
	const decl = sf.getVariableDeclaration(tableName);
	const initializer = decl?.getInitializer();
	if (!initializer) return code;
	
	const tableCall = findSqliteTableCall(initializer);
		
	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
			ensureImports(sf, "drizzle-orm/sqlite-core", [type]);
			
			let columnDef = `${type}("${columnName}")`;
			if (referencesTable && referencesColumn) {
				columnDef += `.references(() => ${referencesTable}.${referencesColumn})`;
			}

			args[1].addPropertyAssignment({ 
				name: columnName, 
				initializer: columnDef
			});
		}
	} else if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
		initializer.addPropertyAssignment({ name: columnName, initializer: '"string"' });
	}
	return sf.getFullText();
}

/**
 * Forges a relationship between two entities. 
 * Detects if it should use Drizzle relations() or Synthetic JSDoc relations.
 */
export function addEdgeToSchema(code: string, source: string, target: string): string {
	const sf = syncSourceFile(code);
	const sourceDecl = sf.getVariableDeclaration(source);
	const targetDecl = sf.getVariableDeclaration(target);
	if (!sourceDecl || !targetDecl) return code;

	const isSourceTable = sourceDecl.getInitializer()?.getText().includes('sqliteTable');
	const isTargetTable = targetDecl.getInitializer()?.getText().includes('sqliteTable');

	// --- Synthetic Relations (KV/DO) ---
	if (!isSourceTable || !isTargetTable) {
		const jsDoc = sourceDecl.getVariableStatement()?.getJsDocs()[0];
		if (jsDoc) {
			const fullText = jsDoc.getFullText();
			const match = fullText.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				try {
					const strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
					if (!strata.relations) strata.relations = [];
					if (!strata.relations.some((r: any) => r.to === target)) {
						strata.relations.push({ to: target });
						jsDoc.replaceWithText(fullText.replace(match[0], `@strata ${JSON.stringify(strata)}`));
					}
				} catch (e) { console.error(e); }
			}
		}
		return sf.getFullText();
	}

	// --- Drizzle Relations (D1) ---
	ensureImports(sf, 'drizzle-orm', ['relations']);
	const relationName = `${source}Relations`;
	let relDecl = sf.getVariableDeclaration(relationName);
	const relPropName = target.endsWith('s') ? target : `${target}s`;

	if (!relDecl) {
		sf.addVariableStatement({
			isExported: true,
			declarations: [{
				name: relationName,
				initializer: `relations(${source}, ({ many }) => ({
  ${relPropName}: many(${target})
}))`
			}]
		});
	} else {
		const init = relDecl.getInitializer();
		if (init?.isKind(SyntaxKind.CallExpression)) {
			const body = (init.getArguments()[1] as any).getBody();
			const obj = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
			if (obj && !obj.getProperty(relPropName)) {
				obj.addPropertyAssignment({ name: relPropName, initializer: `many(${target})` });
			}
		}
	}
	return sf.getFullText();
}

/**
 * Removes a table or object entity from the schema.
 */
export function removeTableFromSchema(code: string, tableName: string): string {
	const sf = syncSourceFile(code);
	
	// Clean up logical relations blocks referencing this table in other blocks
	const sourceFileDecls = sf.getVariableDeclarations();
	for (const d of sourceFileDecls) {
		// Ensure the node is still valid/attached before reading it
		if (d.wasForgotten()) continue;
		const init = d.getInitializer();
		if (init?.isKind(SyntaxKind.CallExpression) && init.getExpression().getText() === 'relations') {
			const args = init.getArguments();
			if (args.length > 1) {
				const body = (args[1] as any).getBody();
				const objLiteral = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
				if (objLiteral) {
					for (const prop of objLiteral.getProperties()) {
						if (prop.isKind(SyntaxKind.PropertyAssignment)) {
							const relInit = prop.getInitializer();
							if (relInit?.isKind(SyntaxKind.CallExpression)) {
								const targetTable = relInit.getArguments()[0]?.getText();
								if (targetTable === tableName) {
									prop.remove();
								}
							}
						}
					}
					// If relations block has no properties left, delete it entirely
					if (objLiteral.getProperties().length === 0) {
						d.getVariableStatement()?.remove();
					}
				}
			}
		}
	}

	// Clean up columns referencing this table in other tables
	// Retrieve declarations again as some might have been removed or forgotten (e.g. relations blocks)
	const remainingDecls = sf.getVariableDeclarations();
	for (const d of remainingDecls) {
		if (d.wasForgotten()) continue;
		if (d.getName() === tableName) continue;
		if (isDrizzleTableDeclaration(d)) {
			const initializer = d.getInitializer();
			const tableCall = initializer ? findSqliteTableCall(initializer) : null;
			if (tableCall) {
				const args = tableCall.getArguments();
				if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
					for (const prop of args[1].getProperties()) {
						if (prop.isKind(SyntaxKind.PropertyAssignment)) {
							const initNode = prop.getInitializer();
							if (initNode) {
								const { baseCallText, modifiers: chainMods } = parseColumnChain(initNode);
								const refIdx = chainMods.findIndex(m => m.name === 'references');
								if (refIdx !== -1 && chainMods[refIdx].args.length > 0) {
									const refArg = chainMods[refIdx].args[0];
									if (refArg.includes(`${tableName}.`)) {
										chainMods.splice(refIdx, 1);
										const newColDef = buildColumnChain(baseCallText, chainMods);
										prop.setInitializer(newColDef);
									}
								}
							}
						}
					}
				}
			}
		}
	}

	const decl = sf.getVariableDeclaration(tableName);
	if (decl) {
		const statement = decl.getVariableStatement();
		// Remove the associated JSDoc and the statement
		statement?.remove();
		
		// Also cleanup associated relations() block if it exists
		const relName = `${tableName}Relations`;
		sf.getVariableStatement(s => s.getDeclarations().some(d => d.getName() === relName))?.remove();
	}
	
	return sf.getFullText();
}

/**
 * Removes an edge/relationship from the schema.
 */
export function removeEdgeFromSchema(code: string, source: string, target: string, name?: string): string {
	const sf = syncSourceFile(code);
	const sourceDecl = sf.getVariableDeclaration(source);
	if (!sourceDecl) return code;

	const isSourceTable = sourceDecl.getInitializer()?.getText().includes('sqliteTable');

	// --- Synthetic Relations ---
	if (!isSourceTable) {
		const jsDoc = sourceDecl.getVariableStatement()?.getJsDocs()[0];
		if (jsDoc) {
			const fullText = jsDoc.getFullText();
			const match = fullText.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				try {
					const strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
					if (strata.relations && Array.isArray(strata.relations)) {
						strata.relations = strata.relations.filter((r: any) => r.to !== target);
						if (strata.relations.length === 0) {
							delete strata.relations;
						}
						jsDoc.replaceWithText(fullText.replace(match[0], `@strata ${JSON.stringify(strata)}`));
					}
				} catch (e) { console.error(e); }
			}
		}
		return sf.getFullText();
	}

	// --- Logical Drizzle Relations ---
	const relName = `${source}Relations`;
	const relDecl = sf.getVariableDeclaration(relName);
	if (relDecl) {
		const init = relDecl.getInitializer();
		if (init?.isKind(SyntaxKind.CallExpression)) {
			const body = (init.getArguments()[1] as any).getBody();
			const obj = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
			if (obj) {
				const prop = name ? obj.getProperty(name) : obj.getProperties().find((p: any) => {
					if (p.isKind(SyntaxKind.PropertyAssignment)) {
						const relInit = p.getInitializer();
						return relInit?.isKind(SyntaxKind.CallExpression) && relInit.getArguments()[0]?.getText() === target;
					}
					return false;
				});

				if (prop) {
					prop.remove();
				}

				if (obj.getProperties().length === 0) {
					relDecl.getVariableStatement()?.remove();
				}
			}
		}
	}

	// --- Physical Foreign Keys ---
	const initializer = sourceDecl.getInitializer();
	const tableCall = initializer ? findSqliteTableCall(initializer) : null;
	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
			for (const prop of args[1].getProperties()) {
				if (prop.isKind(SyntaxKind.PropertyAssignment)) {
					const initNode = prop.getInitializer();
					if (initNode) {
						const { baseCallText, modifiers: chainMods } = parseColumnChain(initNode);
						const refIdx = chainMods.findIndex(m => m.name === 'references');
						if (refIdx !== -1 && chainMods[refIdx].args.length > 0) {
							const refArg = chainMods[refIdx].args[0];
							if (refArg.includes(`${target}.`)) {
								chainMods.splice(refIdx, 1);
								const newColDef = buildColumnChain(baseCallText, chainMods);
								prop.setInitializer(newColDef);
							}
						}
					}
				}
			}
		}
	}

	return sf.getFullText();
}

/**
 * Removes a specific column or field from an entity.
 */
export function removeColumnFromSchema(code: string, tableName: string, columnName: string): string {
	const sf = syncSourceFile(code);
	const decl = sf.getVariableDeclaration(tableName);
	const initializer = decl?.getInitializer();
	
	if (!initializer) return code;
	
	const tableCall = findSqliteTableCall(initializer);

	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
			args[1].getProperty(columnName)?.remove();
		}
	} else if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
		initializer.getProperty(columnName)?.remove();
	}
	
	return sf.getFullText();
}

/**
 * Renames an existing table or object entity.
 * Also updates associated relations() blocks.
 */
export function renameTableInSchema(code: string, oldName: string, newName: string): string {
	const sf = syncSourceFile(code);
	const decl = sf.getVariableDeclaration(oldName);
	
	if (decl) {
		// 1. Rename the variable declaration
		decl.rename(newName);
		
		// 2. Update the sqliteTable name if applicable
		const initializer = decl.getInitializer();
		if (initializer?.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable') {
			const args = initializer.getArguments();
			if (args.length > 0 && args[0].isKind(SyntaxKind.StringLiteral)) {
				args[0].setLiteralValue(newName);
			}
		}

		// 3. Rename associated relations() block
		const oldRelName = `${oldName}Relations`;
		const newRelName = `${newName}Relations`;
		const relDecl = sf.getVariableDeclaration(oldRelName);
		if (relDecl) {
			relDecl.rename(newRelName);
			// Update relations(table, ...) argument
			const relInit = relDecl.getInitializer();
			if (relInit?.isKind(SyntaxKind.CallExpression)) {
				const args = relInit.getArguments();
				if (args.length > 0) args[0].replaceWithText(newName);
			}
		}
	}
	
	return sf.getFullText();
}

/**
 * Renames a specific column or field within an entity.
 */
export function renameColumnInSchema(code: string, tableName: string, oldColName: string, newColName: string): string {
	const sf = syncSourceFile(code);
	const decl = sf.getVariableDeclaration(tableName);
	const initializer = decl?.getInitializer();
	
	if (!initializer) return code;
	
	const tableCall = findSqliteTableCall(initializer);

	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
			const prop = args[1].getProperty(oldColName);
			if (prop?.isKind(SyntaxKind.PropertyAssignment)) {
				prop.getNameNode().replaceWithText(newColName);
				// Also update the column name in the function call, e.g. text("old_name") -> text("new_name")
				const colInit = prop.getInitializer();
				if (colInit?.isKind(SyntaxKind.CallExpression)) {
					const colArgs = colInit.getArguments();
					if (colArgs.length > 0 && colArgs[0].isKind(SyntaxKind.StringLiteral)) {
						colArgs[0].setLiteralValue(newColName);
					}
				}
			}
		}
	} else if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
		const prop = initializer.getProperty(oldColName);
		if (prop?.isKind(SyntaxKind.PropertyAssignment)) {
			prop.getNameNode().replaceWithText(newColName);
		}
	}
	
	return sf.getFullText();
}

/**
 * Surgically updates column modifiers (notNull, primaryKey, default) for a Drizzle column.
 */
export function updateColumnModifiersInSchema(
	code: string,
	tableName: string,
	columnName: string,
	modifiers: { isPk?: boolean; notNull?: boolean; defaultVal?: string | null }
): string {
	const sf = syncSourceFile(code);
	const decl = sf.getVariableDeclaration(tableName);
	const initializer = decl?.getInitializer();
	
	if (!initializer) return code;
	
	const tableCall = findSqliteTableCall(initializer);

	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
			const prop = args[1].getProperty(columnName);
			if (prop?.isKind(SyntaxKind.PropertyAssignment)) {
				const colInit = prop.getInitializer();
				if (colInit) {
					const { baseCallText, modifiers: chainMods } = parseColumnChain(colInit);
					
					// Update isPk
					if (modifiers.isPk !== undefined) {
						const hasPk = chainMods.some(m => m.name === 'primaryKey');
						if (modifiers.isPk && !hasPk) {
							chainMods.push({ name: 'primaryKey', args: [] });
						} else if (!modifiers.isPk && hasPk) {
							const index = chainMods.findIndex(m => m.name === 'primaryKey');
							if (index !== -1) chainMods.splice(index, 1);
						}
					}

					// Update notNull
					if (modifiers.notNull !== undefined) {
						const hasNotNull = chainMods.some(m => m.name === 'notNull');
						if (modifiers.notNull && !hasNotNull) {
							chainMods.push({ name: 'notNull', args: [] });
						} else if (!modifiers.notNull && hasNotNull) {
							const index = chainMods.findIndex(m => m.name === 'notNull');
							if (index !== -1) chainMods.splice(index, 1);
						}
					}

					// Update defaultVal
					if (modifiers.defaultVal !== undefined) {
						const defaultIdx = chainMods.findIndex(m => m.name === 'default' || m.name === 'defaultTo');
						if (modifiers.defaultVal === null || modifiers.defaultVal === undefined || modifiers.defaultVal.trim() === '') {
							if (defaultIdx !== -1) {
								chainMods.splice(defaultIdx, 1);
							}
						} else {
							if (defaultIdx !== -1) {
								chainMods[defaultIdx] = { name: chainMods[defaultIdx].name, args: [modifiers.defaultVal] };
							} else {
								chainMods.push({ name: 'default', args: [modifiers.defaultVal] });
							}
						}
					}

					const newColDef = buildColumnChain(baseCallText, chainMods);
					colInit.replaceWithText(newColDef);
				}
			}
		}
	}
	return sf.getFullText();
}

