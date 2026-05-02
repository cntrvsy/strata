import { Project, VariableDeclaration, SyntaxKind, SourceFile } from 'ts-morph';
import { type Node, type Edge } from '@xyflow/svelte';

/**
 * Persisted ts-morph project and source file to maintain AST state across parses.
 */
const project = new Project({ useInMemoryFileSystem: true });
let sourceFile = project.createSourceFile('schema.ts', '');

interface ParseResult {
	success: boolean;
	nodes: Node[];
	edges: Edge[];
	error?: string;
}

/**
 * Ensures the source file is in sync with the provided code.
 * Reuses the existing source file object to maintain AST references if possible.
 */
function syncSourceFile(code: string) {
	const cleanCode = stripHtml(code);
	if (sourceFile.getFullText() !== cleanCode) {
		sourceFile.replaceWithText(cleanCode);
	}
	return sourceFile;
}

/**
 * Strips HTML tags from a string. Used to clean code previews before parsing.
 */
export function stripHtml(html: string) {
	if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.textContent || div.innerText || '';
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
				const initializer = decl.getInitializer()?.getText() || '';
				const isTable = initializer.includes('sqliteTable');
				
				// Extract @strata metadata from JSDoc
				const jsDocs = statement.getJsDocs();
				let strataData: any = { 
					x: Math.round(Math.random() * 200), 
					y: Math.round(Math.random() * 200), 
					target: isTable ? 'd1' : undefined 
				};
				
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
		return { success: false, error: e.message, nodes: [], edges: [] };
	}
}

/**
 * Extracts column definitions from a Drizzle sqliteTable declaration.
 */
function extractColumns(decl: VariableDeclaration) {
	const columns: any[] = [];
	const initializer = decl.getInitializer();
	if (!initializer) return columns;
	
	let tableCall = initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable'
		? initializer
		: initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find(c => c.getExpression().getText() === 'sqliteTable');
	
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
						addEdgeIfUnique(edges, tableName, targetTable, false, 'fk', colName);
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
									addEdgeIfUnique(edges, tableName, targetTable, isVirtual, relType, prop.getName());
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
function addEdgeIfUnique(edges: Edge[], source: string, target: string, isVirtual: boolean, relType?: string, name?: string) {
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
		labelStyle: 'font-size: 10px; fill: oklch(var(--bc)); font-weight: bold;',
		style: isVirtual 
			? 'stroke: var(--color-primary); stroke-width: 1.5; stroke-dasharray: 4 4; opacity: 0.5;'
			: 'stroke: var(--color-primary); stroke-width: 2; opacity: 0.8;',
		type: 'relation',
		data: { isVirtual }
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
				const strataMatch = text.match(/@strata\s+({[^}]*})/);
				
				if (strataMatch) {
					try {
						const metadata = JSON.parse(strataMatch[1]);
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
	
	const tableCall = initializer.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable'
		? initializer
		: initializer.getDescendantsOfKind(SyntaxKind.CallExpression).find(c => c.getExpression().getText() === 'sqliteTable');
		
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
			const match = fullText.match(/@strata\s*(\{[\s\S]*?\})/);
			if (match) {
				try {
					const strata = JSON.parse(match[1]);
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

	if (!relDecl) {
		sf.addVariableStatement({
			isExported: true,
			declarations: [{
				name: relationName,
				initializer: `relations(${source}, ({ many }) => ({
  ${target}s: many(${target})
}))`
			}]
		});
	} else {
		const init = relDecl.getInitializer();
		if (init?.isKind(SyntaxKind.CallExpression)) {
			const body = (init.getArguments()[1] as any).getBody();
			const obj = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
			if (obj && !obj.getProperty(`${target}s`)) {
				obj.addPropertyAssignment({ name: `${target}s`, initializer: `many(${target})` });
			}
		}
	}
	return sf.getFullText();
}
