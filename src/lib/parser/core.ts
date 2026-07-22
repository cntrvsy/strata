/**
 * core.ts
 *
 * Summary: Parses TypeScript/Drizzle schema files into visual Svelte Flow nodes and edges.
 * Expects: Raw typescript code string and optional external file mappings.
 * Output: ParseResult structure containing nodes, edges, warnings, and external imports.
 */
import { SourceFile, VariableDeclaration, SyntaxKind } from 'ts-morph';
import { type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { ParseResult } from './types';
import { createIsolatedProject } from './project';
import { findSqliteTableCall, isDrizzleTableDeclaration, parseColumnChain, resolvePathAlias, extractStrataMetadata } from './helpers';

/**
 * Wraps raw code in pre/code tags for UI presentation.
 */
export function wrapCode(code: string) {
	return `<pre><code>${code}</code></pre>`;
}

/**
 * Parses a Drizzle schema file into Svelte Flow nodes and edges.
 * Handles D1 (sqliteTable), KV (plain objects), relations, and relative external imports.
 */
export function parseSchema(
	code: string,
	externalFilesMap?: Map<string, string>,
	paths?: Record<string, string[]>,
	tsconfigPath?: string
): ParseResult {
	const tempSourceFiles: SourceFile[] = [];
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	try {
		
		const nodes: Node[] = [];
		const edges: Edge[] = [];
		const externalPaths: string[] = [];
		const warnings: string[] = [];
		
		// Find all relative or aliased import declarations
		const externalImports: { filePath: string; importNames: string[] }[] = [];
		const importDecls = sf.getImportDeclarations();
		for (const imp of importDecls) {
			const specifier = imp.getModuleSpecifierValue();
			let isExternal = specifier.startsWith('.') || specifier.startsWith('..');
			let resolvedPath = specifier;

			if (!isExternal && paths && tsconfigPath) {
				const resolved = resolvePathAlias(specifier, paths, tsconfigPath);
				if (resolved) {
					isExternal = true;
					resolvedPath = resolved;
				}
			}

			if (isExternal) {
				const names = imp.getNamedImports().map(ni => ni.getName());
				if (names.length > 0) {
					externalImports.push({
						filePath: resolvedPath,
						importNames: names
					});
				}
			}
		}

		// Find all exported declarations in main schema file
		const variableStatements = sf.getVariableStatements();
		const tableDeclarations = new Map<string, VariableDeclaration>();
		let wranglerPath: string | undefined = undefined;
		
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
					const strataExtracted = extractStrataMetadata(doc.getText());
					if (strataExtracted) {
						strataData = { ...strataData, ...strataExtracted.data };
					}
				}

				if (strataData.target === 'project') {
					if (strataData.wranglerPath) {
						wranglerPath = strataData.wranglerPath;
					}
				}

				if (strataData.path) {
					externalPaths.push(strataData.path);
				}

				// Only process if it's a known storage target
				if (isTable || strataData.target === 'kv' || strataData.target === 'do' || strataData.target === 'r2' || strataData.target === 'schema') {
					const tableName = decl.getName();
					const target = strataData.target || (isTable ? 'd1' : 'kv');
					
					tableDeclarations.set(tableName, decl);

					let columns: any[] = [];
					if (target === 'd1') {
						columns = extractColumns(decl);
					} else if (target === 'kv') {
						if (strataData.schema) {
							columns = Object.entries(strataData.schema).map(([name, val]) => {
								if (typeof val === 'object' && val !== null) {
									const valObj = val as any;
									return {
										name,
										definition: String(valObj.type || 'string'),
										ttl: valObj.ttl ? Number(valObj.ttl) : undefined,
										metadata: valObj.metadata ? String(valObj.metadata) : undefined,
										isPk: false,
										isReferences: false
									};
								}
								return {
									name,
									definition: String(val),
									isPk: false,
									isReferences: false
								};
							});
						} else {
							columns = extractObjectFields(decl);
						}
					} else if (target === 'r2') {
						if (strataData.folders) {
							columns = Object.entries(strataData.folders).map(([name, mime]) => ({
								name: `${name}/`,
								definition: String(mime),
								isPk: false,
								isReferences: false
							}));
						}
					} else if (target === 'do') {
						let doColumns: any[] = [];
						if (externalFilesMap && strataData.path && strataData.class) {
							const fileContent = externalFilesMap.get(strataData.path);
							if (fileContent) {
								try {
									const doSf = project.createSourceFile(`temp_do_${tableName}.ts`, fileContent, { overwrite: true });
									tempSourceFiles.push(doSf);
									const classDecl = doSf.getClass(strataData.class) || doSf.getClasses()[0];
									if (classDecl) {
										doColumns = classDecl.getMethods()
											.filter(m => m.getScope() === 'public' || !m.getScope())
											.map(m => {
												const paramStr = m.getParameters().map(p => p.getText()).join(', ');
												const retType = m.getReturnTypeNode()?.getText() || 'any';
												return {
													name: `${m.getName()}(${paramStr})`,
													definition: retType,
													isPk: false,
													isReferences: false
												};
											});
									}
								} catch (err: any) {
									console.warn(`Failed to parse DO class methods at ${strataData.path}:`, err);
									warnings.push(`Failed to parse DO class methods at ${strataData.path}: ${err?.message || String(err)}`);
								}
							}
						}
						
						if (doColumns.length > 0) {
							columns = doColumns;
						} else if (strataData.methods && Array.isArray(strataData.methods)) {
							columns = strataData.methods.map((m: string) => ({
								name: `${m}()`,
								definition: 'Promise<any>',
								isPk: false,
								isReferences: false
							}));
						} else {
							columns = extractObjectFields(decl);
						}
					}

					if (target !== 'schema') {
						nodes.push({
							id: tableName,
							type: 'table',
							data: { 
								label: tableName, 
								columns,
								target,
								strata: strataData
							},
							position: { x: strataData.x, y: strataData.y }
						});
					}

					// Handle Synthetic Relations (JSDoc based)
					if (strataData.relations && Array.isArray(strataData.relations)) {
						for (const rel of strataData.relations) {
							addEdgeIfUnique(edges, tableName, rel.to, true, 'synthetic');
						}
					}
				}
			}
		}

		// Process external files if provided
		if (externalFilesMap) {
			// Process imports
			for (const extImp of externalImports) {
				const externalContent = externalFilesMap.get(extImp.filePath);
				if (externalContent) {
					try {
						// Create a temporary source file for the external schema
						const extSf = project.createSourceFile(`temp_${extImp.filePath.replace(/[\/.]/g, '_')}.ts`, externalContent, { overwrite: true });
						tempSourceFiles.push(extSf);
						for (const name of extImp.importNames) {
							const decl = extSf.getVariableDeclaration(name);
							if (decl && isDrizzleTableDeclaration(decl)) {
								const statement = decl.getVariableStatement();
								const jsDocs = statement?.getJsDocs() || [];
								let strataData: any = {
									x: Math.round(Math.random() * 200),
									y: Math.round(Math.random() * 200),
									target: 'd1'
								};
								
								for (const doc of jsDocs) {
									const strataExtracted = extractStrataMetadata(doc.getText());
									if (strataExtracted) {
										strataData = { ...strataData, ...strataExtracted.data };
									}
								}

								// Register external node (marked with isExternal: true)
								nodes.push({
									id: name,
									type: 'table',
									data: {
										label: name,
										columns: extractColumns(decl),
										target: strataData.target || 'd1',
										strata: strataData,
										isExternal: true
									},
									position: { x: strataData.x, y: strataData.y }
								});
								
								// Register declaration so we can scan relationships from main schema pointing here
								tableDeclarations.set(name, decl);
							}
						}
					} catch (err) {
						console.warn(`Failed to parse external file ${extImp.filePath} safely:`, err);
					}
				}
			}

			// Process schema pointer variables
			for (const [filePath, content] of externalFilesMap.entries()) {
				if (externalPaths.includes(filePath)) {
					const isSchemaTarget = nodes.some(n => (n.data as any)?.strata?.target === 'schema' && (n.data as any)?.strata?.path === filePath)
						|| Array.from(tableDeclarations.values()).some(d => {
							const strata = d.getVariableStatement()?.getJsDocs()[0]?.getText();
							return strata?.includes('"target": "schema"') && strata?.includes(filePath);
						});
					
					if (isSchemaTarget) {
						try {
							const schemaSf = project.createSourceFile(`temp_schema_${filePath.replace(/[\/.]/g, '_')}.ts`, content, { overwrite: true });
							tempSourceFiles.push(schemaSf);
							
							const variableStatements = schemaSf.getVariableStatements();
							for (const statement of variableStatements) {
								const declarations = statement.getDeclarations();
								for (const decl of declarations) {
									const isTable = isDrizzleTableDeclaration(decl);
									if (isTable) {
										const tableName = decl.getName();
										const jsDocs = statement.getJsDocs();
										let strataData: any = {
											x: Math.round(Math.random() * 200),
											y: Math.round(Math.random() * 200),
											target: 'd1'
										};
										
										for (const doc of jsDocs) {
											const strataExtracted = extractStrataMetadata(doc.getText());
											if (strataExtracted) {
												strataData = { ...strataData, ...strataExtracted.data };
											}
										}
										
										if (!nodes.some(n => n.id === tableName)) {
											nodes.push({
												id: tableName,
												type: 'table',
												data: {
													label: tableName,
													columns: extractColumns(decl),
													target: strataData.target || 'd1',
													strata: strataData
												},
												position: { x: strataData.x, y: strataData.y }
											});
											tableDeclarations.set(tableName, decl);
										}
									}
								}
							}
						} catch (err: any) {
							console.warn(`Failed to parse custom schema pointer file ${filePath}:`, err);
							warnings.push(`Failed to parse custom schema pointer file ${filePath}: ${err?.message || String(err)}`);
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

		// Validation: Ensure all synthetic relations point to existing targets
		const tableNames = new Set(nodes.map(n => n.id));
		for (const [tableName, decl] of tableDeclarations) {
			const statement = decl.getVariableStatement();
			const jsDocs = statement?.getJsDocs() || [];
			for (const doc of jsDocs) {
				const strataExtracted = extractStrataMetadata(doc.getText());
				if (strataExtracted?.data?.relations && Array.isArray(strataExtracted.data.relations)) {
					for (const rel of strataExtracted.data.relations) {
						if (!tableNames.has(rel.to)) {
							warnings.push(`Synthetic relationship in "${tableName}" points to missing target "${rel.to}"`);
						}
					}
				}
			}
		}

		// Cleanup: Ensure all edges point to existing nodes
		const validEdges = edges.filter(e => tableNames.has(e.source) && tableNames.has(e.target));
		
		if (nodes.length === 0 && code.trim().length > 0) {
			return { success: false, error: 'No tables or schema objects found', nodes: [], edges: [], externalImports, externalPaths, warnings, wranglerPath };
		}

		return { success: true, nodes, edges: validEdges, externalImports, externalPaths, warnings, wranglerPath };
	} catch (e: any) {
		console.error("[Strata] Parse critical failure:", e);
		
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
	} finally {
		for (const sf of tempSourceFiles) {
			try {
				project.removeSourceFile(sf);
			} catch (err) {
				console.warn('Failed to cleanup temporary source file:', err);
			}
		}
	}
}

/**
 * Extracts column definitions from a Drizzle sqliteTable declaration.
 */
export function extractColumns(decl: VariableDeclaration) {
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
export function extractObjectFields(decl: VariableDeclaration) {
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
export function extractRelations(tableName: string, decl: VariableDeclaration, edges: Edge[], sf: any) {
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
					const propAccess = args[0].getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)[0];
					if (propAccess) {
						const targetTable = propAccess.getExpression().getText();
						const targetCol = propAccess.getName();
						if (targetTable) {
							physicalRelations.add(targetTable);
							const colName = call.getAncestors().find(a => a.isKind(SyntaxKind.PropertyAssignment))?.asKind(SyntaxKind.PropertyAssignment)?.getName();
							if (colName && targetCol) {
								addEdgeIfUnique(edges, tableName, targetTable, false, 'fk', colName, '1:N', colName, targetCol);
							} else {
								addEdgeIfUnique(edges, tableName, targetTable, false, 'fk', undefined, '1:N');
							}
						}
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
export function addEdgeIfUnique(
	edges: Edge[], 
	source: string, 
	target: string, 
	isVirtual: boolean, 
	relType?: string, 
	name?: string,
	cardinality: '1:1' | '1:N' | 'N:1' | 'unknown' = 'unknown',
	sourceHandle: string = 'source',
	targetHandle: string = 'target'
) {
	const id = `e-${source}-${target}-${name || (isVirtual ? 'v' : 'p')}`;
	if (source === target || edges.some(e => e.id === id)) return;
	
	const edgeColor = isVirtual ? 'var(--color-secondary)' : 'var(--color-primary)';
	
	edges.push({
		id,
		source,
		target,
		sourceHandle,
		targetHandle,
		animated: isVirtual,
		label: name || (relType !== 'fk' ? relType : undefined),
		labelStyle: 'font-size: 10px; color: var(--color-base-content); font-weight: bold;',
		style: isVirtual 
			? `stroke: ${edgeColor}; stroke-width: 1.75; stroke-dasharray: 4 4; opacity: 0.85;`
			: `stroke: ${edgeColor}; stroke-width: 2.25; opacity: 1.0;`,
		type: 'relation',
		data: { isVirtual, cardinality },
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 15,
			height: 15,
			color: edgeColor,
		}
	});
}
