/**
 * mutators.ts
 *
 * Summary: Surgical AST mutator operations to alter drizzle schema files when the user interacts with the UI.
 * Expects: TypeScript schema code strings and modification targets (positions, tables, columns, relations).
 * Output: Mutated/updated TypeScript code string.
 */
import { SyntaxKind } from 'ts-morph';
import type { Node } from '@xyflow/svelte';
import { createIsolatedProject, withSourceFile } from './project';
import { 
	findSqliteTableCall, 
	isDrizzleTableDeclaration, 
	parseColumnChain, 
	buildColumnChain, 
	ensureImports,
	cleanUnusedImports,
	resolveRelativePath,
	extractStrataMetadata,
	extractStrataLayoutManifest,
	pluralizeIdentifier
} from './helpers';
export { extractStrataLayoutManifest } from './helpers';
import { PlatformService } from '#lib/services/platform';

/**
 * Updates a node's position inside its @strata JSDoc metadata.
 */
export function updateNodePositionInSchema(code: string, tableName: string, x: number, y: number): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(tableName);
	
	if (decl) {
		const statement = decl.getVariableStatement();
		if (statement) {
			const jsDocs = statement.getJsDocs();
			let strataFound = false;

			for (const doc of jsDocs) {
				const text = doc.getText();
				const extracted = extractStrataMetadata(text);
				
				if (extracted) {
					const metadata = extracted.data || {};
					metadata.x = Math.round(x);
					metadata.y = Math.round(y);
					doc.replaceWithText(text.replace(extracted.rawMatch, `@strata ${JSON.stringify(metadata)}`));
					strataFound = true;
					break;
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
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	for (const node of nodes) {
		const decl = sf.getVariableDeclaration(node.id);
		if (decl) {
			const statement = decl.getVariableStatement();
			if (statement) {
				const jsDocs = statement.getJsDocs();
				let strataFound = false;

				for (const doc of jsDocs) {
					const text = doc.getText();
					const extracted = extractStrataMetadata(text);
					
					if (extracted) {
						const metadata = extracted.data || {};
						metadata.x = Math.round(node.position.x);
						metadata.y = Math.round(node.position.y);
						doc.replaceWithText(text.replace(extracted.rawMatch, `@strata ${JSON.stringify(metadata)}`));
						strataFound = true;
						break;
					}
				}

				if (!strataFound) {
					statement.addJsDoc({ description: `\n * @strata { "x": ${Math.round(node.position.x)}, "y": ${Math.round(node.position.y)} }\n ` });
				}
			}
		} else if (node.data && (node.data as any).target && (node.data as any).target !== 'd1') {
			const target = (node.data as any).target;
			const strata = (node.data as any).strata;
			const strataObj: any = {
				target,
				x: Math.round(node.position.x),
				y: Math.round(node.position.y)
			};
			if (strata?.binding) strataObj.binding = strata.binding;
			if (strata?.class) strataObj.class = strata.class;
			if (strata?.path) strataObj.path = strata.path;
			if (strata?.folders) strataObj.folders = strata.folders;
			if (strata?.schema) strataObj.schema = strata.schema;
			if (strata?.relations) strataObj.relations = strata.relations;

			const content = `\n/** \n * @strata ${JSON.stringify(strataObj)} \n */\nexport const ${node.id} = {};\n`;
			sf.insertText(sf.getFullWidth(), content);
		}
	}
	let result = sf.getFullText();
	const virtualNodes = nodes.filter(n => n.type === 'identity');
	if (virtualNodes.length > 0) {
		const positionsMap: Record<string, { x: number; y: number }> = {};
		for (const vn of virtualNodes) {
			positionsMap[vn.id] = { x: Math.round(vn.position.x), y: Math.round(vn.position.y) };
		}
		result = updateLayoutManifestInSchema(result, positionsMap);
	}
	return result;
}

export function sanitizeIdentifier(name: string): string {
	let clean = name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
	if (/^[0-9]/.test(clean)) {
		clean = `entity_${clean}`;
	}
	return clean || 'entity';
}

export interface TablePresets {
	primaryKey?: 'int_autoincrement' | 'autoIncrement' | 'uuid';
	timestamps?: boolean;
	softDelete?: boolean;
}

/**
 * Generates the interior column definition lines and required imports for a D1 table based on presets.
 */
export function generateD1TableColumns(tableName: string, presets?: TablePresets): { code: string; imports: string[] } {
	const imports = ["sqliteTable", "text", "integer"];
	const lines: string[] = [];

	if (presets?.primaryKey === 'uuid') {
		lines.push(`  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),`);
	} else if (presets?.primaryKey === 'autoIncrement' || presets?.primaryKey === 'int_autoincrement') {
		lines.push(`  id: integer("id").primaryKey({ autoIncrement: true }),`);
	} else {
		lines.push(`  id: integer("id").primaryKey(),`);
	}

	if (presets?.timestamps) {
		lines.push(`  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),`);
		lines.push(`  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),`);
	}

	if (presets?.softDelete) {
		lines.push(`  deletedAt: integer("deleted_at", { mode: "timestamp" }),`);
	}

	return {
		code: lines.join("\n"),
		imports
	};
}

/**
 * Adds a new table or plain object entity to the schema.
 * Automatically sanitizes name and guards against duplicate variable declaration collisions.
 */
export function addTableToSchema(
	code: string, 
	tableName: string, 
	target: 'd1' | 'do' | 'kv' | 'r2' = 'd1',
	extra?: { class?: string; path?: string; id?: string; bucket_name?: string; presets?: TablePresets }
): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	
	const sanitized = sanitizeIdentifier(tableName);
	let finalName = sanitized;
	let counter = 2;
	while (sf.getVariableDeclaration(finalName)) {
		finalName = `${sanitized}_${counter}`;
		counter++;
	}

	if (target === 'd1') {
		const { code: columnsCode, imports } = generateD1TableColumns(finalName, extra?.presets);
		ensureImports(sf, "drizzle-orm/sqlite-core", imports);
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}} \n */\nexport const ${finalName} = sqliteTable("${finalName}", {\n${columnsCode}\n});\n`;
		sf.insertText(sf.getFullWidth(), content);
	} else if (target === 'do') {
		const className = extra?.class || "MyClass";
		const classPath = extra?.path || `./src/${className}.ts`;
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}, "target": "do", "class": "${className}", "path": "${classPath}"} \n */\nexport const ${finalName} = {};\n`;
		sf.insertText(sf.getFullWidth(), content);
	} else if (target === 'r2') {
		const bucketName = extra?.bucket_name ? `, "bucket": "${extra.bucket_name}"` : '';
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}, "target": "r2", "folders": {}${bucketName}} \n */\nexport const ${finalName} = {};\n`;
		sf.insertText(sf.getFullWidth(), content);
	} else {
		const kvId = extra?.id ? `, "id": "${extra.id}"` : '';
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}, "target": "kv", "schema": {}${kvId}} \n */\nexport const ${finalName} = {};\n`;
		sf.insertText(sf.getFullWidth(), content);
	}
	return sf.getFullText();
}


/**
 * Adds a new column or field to an existing entity.
 */
export async function addColumnToSchema(
	code: string, 
	tableName: string, 
	columnName: string, 
	type: string = 'text',
	referencesTable?: string,
	referencesColumn?: string,
	schemaFilePath?: string,
	targetImportPath?: string
): Promise<string> {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(tableName);
	if (!decl) return code;

	const statement = decl.getVariableStatement();
	if (statement) {
		const jsDocs = statement.getJsDocs();
		for (const doc of jsDocs) {
			const text = doc.getText();
			const match = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				let strata: any = null;
				try {
					strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
				} catch (e) {
					console.warn('[Strata] Invalid JSON in @strata metadata:', e);
				}

				if (strata) {
					if (strata.target === 'kv') {
						if (!strata.schema) strata.schema = {};
						strata.schema[columnName] = type === 'text' ? 'string' : type;
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} else if (strata.target === 'r2') {
						if (!strata.folders) strata.folders = {};
						strata.folders[columnName] = type || '*/*';
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} else if (strata.target === 'do') {
						if (schemaFilePath && strata.path && strata.class) {
							const resolvedPath = resolveRelativePath(schemaFilePath, strata.path);
							try {
								const fileContent = await PlatformService.readText(resolvedPath);
								const extSf = project.createSourceFile(`temp_do_add_${Date.now()}.ts`, fileContent, { overwrite: true });
								const classDecl = extSf.getClass(strata.class) || extSf.getClasses()[0];
								if (classDecl) {
									let methodName = columnName.trim();
									let parameters: { name: string; type?: string }[] = [];
									const parseMatch = columnName.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
									if (parseMatch) {
										methodName = parseMatch[1].trim();
										const paramsStr = parseMatch[2].trim();
										if (paramsStr) {
											parameters = paramsStr.split(',').map(p => {
												const [pName, pType] = p.split(':').map(x => x.trim());
												return {
													name: pName,
													type: pType || 'any'
												};
											});
										}
									}
									if (!classDecl.getMethod(methodName)) {
										classDecl.addMethod({
											name: methodName,
											parameters,
											returnType: type || 'Promise<any>',
											statements: `throw new Error("Method not implemented.");`,
											scope: 'public' as any
										});
									}
									const newExtContent = extSf.getFullText();
									await PlatformService.writeText(resolvedPath, newExtContent);
								}
							} catch (err: any) {
								console.error(`[Strata] Failed to add DO method to ${resolvedPath}:`, err);
								throw new Error(`Failed to write to external file "${resolvedPath}". Please verify that it is not locked by another process or write-protected.`);
							}
							return sf.getFullText();
						} else {
							if (!strata.methods) strata.methods = [];
							let methodName = columnName.trim();
							const parseMatch = columnName.match(/^([a-zA-Z0-9_]+)/);
							if (parseMatch) {
								methodName = parseMatch[1].trim();
							}
							if (!strata.methods.includes(methodName)) {
								strata.methods.push(methodName);
								doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
								return sf.getFullText();
							}
						}
						return sf.getFullText();
					}
				}
			}
		}
	}

	const initializer = decl.getInitializer();
	if (!initializer) return code;
	
	const tableCall = findSqliteTableCall(initializer);
		
	if (tableCall) {
		const args = tableCall.getArguments();
		if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
			let importType = type;
			let columnDef = `${type}("${columnName}")`;
			if (type === "timestamp") {
				importType = "integer";
				columnDef = `integer("${columnName}", { mode: "timestamp" })`;
			} else if (type === "boolean_int" || type === "boolean") {
				importType = "integer";
				columnDef = `integer("${columnName}", { mode: "boolean" })`;
			}

			ensureImports(sf, "drizzle-orm/sqlite-core", [importType]);

			if (referencesTable && referencesColumn) {
				if (targetImportPath && !sf.getVariableDeclaration(referencesTable)) {
					ensureImports(sf, targetImportPath, [referencesTable]);
				}
				columnDef += `.references(() => ${referencesTable}.${referencesColumn})`;
			}

			if (args[1].getProperty(columnName)) {
				return code;
			}

			args[1].addPropertyAssignment({ 
				name: columnName, 
				initializer: columnDef
			});
		}
	} else if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
		const val = type === 'text' ? 'string' : type;
		initializer.addPropertyAssignment({ name: columnName, initializer: `"${val}"` });
	}
	return sf.getFullText();
}

/**
 * Adds or updates a physical Foreign Key (.references()) on a column in a D1 table.
 * If sourceCol exists on sourceTable, appends .references(() => targetTable.targetCol).
 * If sourceCol does not exist, creates the new column with .references(() => targetTable.targetCol).
 */
export function addForeignKeyToColumnInSchema(
	code: string,
	sourceTable: string,
	sourceCol: string,
	targetTable: string,
	targetCol: string = 'id',
	targetImportPath?: string
): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(sourceTable);
	if (!decl) return code;

	const initializer = decl.getInitializer();
	if (!initializer) return code;

	const tableCall = findSqliteTableCall(initializer);
	if (!tableCall) return code;

	const args = tableCall.getArguments();
	if (args.length < 2 || !args[1].isKind(SyntaxKind.ObjectLiteralExpression)) return code;

	const objLit = args[1].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
	const prop = objLit.getProperty(sourceCol);

	if (targetImportPath && !sf.getVariableDeclaration(targetTable)) {
		ensureImports(sf, targetImportPath, [targetTable]);
	}

	const refString = `.references(() => ${targetTable}.${targetCol})`;

	if (prop && prop.isKind(SyntaxKind.PropertyAssignment)) {
		const propInit = prop.getInitializer();
		if (propInit) {
			const text = propInit.getText();
			if (!text.includes('.references(')) {
				propInit.replaceWithText(`${text}${refString}`);
			}
		}
	} else {
		// Column doesn't exist yet, create it with integer type & references
		ensureImports(sf, "drizzle-orm/sqlite-core", ["integer"]);
		const columnDef = `integer("${sourceCol}")${refString}`;
		objLit.addPropertyAssignment({
			name: sourceCol,
			initializer: columnDef
		});
	}

	return sf.getFullText();
}

/**
 * Creates a relationship between two entities. 
 * Detects if it should use Drizzle relations() or Synthetic JSDoc relations.
 */

export function addEdgeToSchema(
	code: string, 
	source: string, 
	target: string,
	targetImportPath?: string
): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const sourceDecl = sf.getVariableDeclaration(source);
	const targetDecl = sf.getVariableDeclaration(target);
	if (!sourceDecl) return code;

	if (targetImportPath && !targetDecl) {
		ensureImports(sf, targetImportPath, [target]);
	}

	const isSourceTable = sourceDecl.getInitializer()?.getText().includes('sqliteTable');
	const isTargetTable = targetDecl ? targetDecl.getInitializer()?.getText().includes('sqliteTable') : true;

	// --- Synthetic Relations (KV/DO) ---
	if (targetDecl && (!isSourceTable || !isTargetTable)) {
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
	const relPropName = pluralizeIdentifier(target);

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
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	
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
	
	const fullCode = sf.getFullText();
	return removeTableFromLayoutManifest(fullCode, tableName);
}

/**
 * Removes an edge/relationship from the schema.
 */
export function removeEdgeFromSchema(code: string, source: string, target: string, name?: string): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const sourceDecl = sf.getVariableDeclaration(source);
	const relName = `${source}Relations`;
	const relDecl = sf.getVariableDeclaration(relName);

	if (!sourceDecl && !relDecl) return code;

	// --- Synthetic Relations ---
	if (sourceDecl) {
		const isSourceTable = sourceDecl.getInitializer()?.getText().includes('sqliteTable');
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
	}

	// --- Logical Drizzle Relations ---
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
	if (sourceDecl) {
		const initializer = sourceDecl.getInitializer();
		const tableCall = initializer ? findSqliteTableCall(initializer) : null;
		if (tableCall) {
			const args = tableCall.getArguments();
			if (args.length > 1 && args[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
				for (const prop of args[1].getProperties()) {
					if (prop.isKind(SyntaxKind.PropertyAssignment)) {
						if (name && prop.getName() !== name) continue;
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
	}

	// Clean up unused imports for target, source, and relations
	cleanUnusedImports(sf, [target, source, 'relations']);

	return sf.getFullText();
}

/**
 * Removes a specific column or field from an entity.
 */
export async function removeColumnFromSchema(
	code: string, 
	tableName: string, 
	columnName: string,
	schemaFilePath?: string
): Promise<string> {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(tableName);
	if (!decl) return code;
	
	const statement = decl.getVariableStatement();
	if (statement) {
		const jsDocs = statement.getJsDocs();
		for (const doc of jsDocs) {
			const text = doc.getText();
			const match = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				let strata: any = null;
				try {
					strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
				} catch (e) {
					console.warn('[Strata] Invalid JSON in @strata metadata:', e);
				}

				if (strata) {
					if (strata.target === 'kv' && strata.schema) {
						delete strata.schema[columnName];
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} else if (strata.target === 'r2' && strata.folders) {
						const cleanKey = columnName.endsWith('/') ? columnName.slice(0, -1) : columnName;
						delete strata.folders[cleanKey];
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} else if (strata.target === 'do') {
						let methodName = columnName.trim();
						const parseMatch = columnName.match(/^([a-zA-Z0-9_]+)/);
						if (parseMatch) {
							methodName = parseMatch[1].trim();
						}
						if (schemaFilePath && strata.path && strata.class) {
							const resolvedPath = resolveRelativePath(schemaFilePath, strata.path);
							try {
								const fileContent = await PlatformService.readText(resolvedPath);
								const extSf = project.createSourceFile(`temp_do_remove_${Date.now()}.ts`, fileContent, { overwrite: true });
								const classDecl = extSf.getClass(strata.class) || extSf.getClasses()[0];
								if (classDecl) {
									classDecl.getMethod(methodName)?.remove();
									const newExtContent = extSf.getFullText();
									await PlatformService.writeText(resolvedPath, newExtContent);
								}
							} catch (err: any) {
								console.error(`[Strata] Failed to remove DO method from ${resolvedPath}:`, err);
								throw new Error(`Failed to write to external file "${resolvedPath}". Please verify that it is not locked by another process or write-protected.`);
							}
							return sf.getFullText();
						} else if (strata.methods) {
							strata.methods = strata.methods.filter((m: string) => m !== methodName);
							doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
							return sf.getFullText();
						}
						return sf.getFullText();
					}
				}
			}
		}
	}

	const initializer = decl.getInitializer();
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
	const cleanNewName = sanitizeIdentifier(newName);
	if (!cleanNewName || cleanNewName === oldName) return code;

	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(oldName);
	
	if (decl) {
		// 1. Rename the variable declaration
		decl.rename(cleanNewName);
		
		// 2. Update the sqliteTable name if applicable
		const initializer = decl.getInitializer();
		if (initializer?.isKind(SyntaxKind.CallExpression) && initializer.getExpression().getText() === 'sqliteTable') {
			const args = initializer.getArguments();
			if (args.length > 0 && args[0].isKind(SyntaxKind.StringLiteral)) {
				args[0].setLiteralValue(cleanNewName);
			}
		}

		// 3. Rename associated relations() block
		const oldRelName = `${oldName}Relations`;
		const newRelName = `${cleanNewName}Relations`;
		const relDecl = sf.getVariableDeclaration(oldRelName);
		if (relDecl) {
			relDecl.rename(newRelName);
			// Update relations(table, ...) argument
			const relInit = relDecl.getInitializer();
			if (relInit?.isKind(SyntaxKind.CallExpression)) {
				const args = relInit.getArguments();
				if (args.length > 0) args[0].replaceWithText(cleanNewName);
			}
		}
	}
	
	const fullCode = sf.getFullText();
	return renameTableInLayoutManifest(fullCode, oldName, cleanNewName);
}


/**
 * Renames a specific column or field within an entity.
 */
export async function renameColumnInSchema(
	code: string, 
	tableName: string, 
	oldColName: string, 
	newColName: string,
	schemaFilePath?: string
): Promise<string> {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(tableName);
	if (!decl) return code;

	const statement = decl.getVariableStatement();
	if (statement) {
		const jsDocs = statement.getJsDocs();
		for (const doc of jsDocs) {
			const text = doc.getText();
			const match = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				let strata: any = null;
				try {
					strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
				} catch (e) {
					console.warn('[Strata] Invalid JSON in @strata metadata:', e);
				}

				if (strata) {
					if (strata.target === 'kv' && strata.schema && strata.schema[oldColName]) {
						const type = strata.schema[oldColName];
						delete strata.schema[oldColName];
						strata.schema[newColName] = type;
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} else if (strata.target === 'r2' && strata.folders) {
						const cleanOldKey = oldColName.endsWith('/') ? oldColName.slice(0, -1) : oldColName;
						const cleanNewKey = newColName.endsWith('/') ? newColName.slice(0, -1) : newColName;
						if (strata.folders[cleanOldKey]) {
							const mime = strata.folders[cleanOldKey];
							delete strata.folders[cleanOldKey];
							strata.folders[cleanNewKey] = mime;
							doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
							return sf.getFullText();
						}
					} else if (strata.target === 'do') {
						let oldMethodName = oldColName.trim();
						let newMethodName = newColName.trim();
						const oldMatch = oldColName.match(/^([a-zA-Z0-9_]+)/);
						if (oldMatch) oldMethodName = oldMatch[1].trim();
						const newMatch = newColName.match(/^([a-zA-Z0-9_]+)/);
						if (newMatch) newMethodName = newMatch[1].trim();

						if (schemaFilePath && strata.path && strata.class) {
							const resolvedPath = resolveRelativePath(schemaFilePath, strata.path);
							try {
								const fileContent = await PlatformService.readText(resolvedPath);
								const extSf = project.createSourceFile(`temp_do_rename_${Date.now()}.ts`, fileContent, { overwrite: true });
								const classDecl = extSf.getClass(strata.class) || extSf.getClasses()[0];
								if (classDecl) {
									classDecl.getMethod(oldMethodName)?.rename(newMethodName);
									const newExtContent = extSf.getFullText();
									await PlatformService.writeText(resolvedPath, newExtContent);
								}
							} catch (err: any) {
								console.error(`[Strata] Failed to rename DO method in ${resolvedPath}:`, err);
								throw new Error(`Failed to write to external file "${resolvedPath}". Please verify that it is not locked by another process or write-protected.`);
							}
							return sf.getFullText();
						} else if (strata.methods && Array.isArray(strata.methods)) {
							const idx = strata.methods.indexOf(oldMethodName);
							if (idx !== -1) {
								strata.methods[idx] = newMethodName;
								doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
								return sf.getFullText();
							}
						}
						return sf.getFullText();
					}
				}
			}
		}
	}

	const initializer = decl.getInitializer();
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
	modifiers: { isPk?: boolean; notNull?: boolean; defaultVal?: string | null; ttl?: number | null; metadata?: string | null }
): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(tableName);
	if (!decl) return code;

	const statement = decl.getVariableStatement();
	if (statement) {
		const jsDocs = statement.getJsDocs();
		for (const doc of jsDocs) {
			const text = doc.getText();
			const match = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				try {
					const strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
					if (strata.target === 'kv' && strata.schema && strata.schema[columnName] !== undefined) {
						const current = strata.schema[columnName];
						let updatedVal: any = {};
						if (typeof current === 'object' && current !== null) {
							updatedVal = { ...current };
						} else {
							updatedVal = { type: String(current) };
						}
						
						if (modifiers.ttl !== undefined) {
							if (modifiers.ttl === null || modifiers.ttl === undefined || isNaN(Number(modifiers.ttl))) {
								delete updatedVal.ttl;
							} else {
								updatedVal.ttl = Number(modifiers.ttl);
							}
						}
						if (modifiers.metadata !== undefined) {
							if (modifiers.metadata === null || modifiers.metadata === undefined || modifiers.metadata.trim() === '') {
								delete updatedVal.metadata;
							} else {
								updatedVal.metadata = modifiers.metadata.trim();
							}
						}
						if (modifiers.defaultVal !== undefined) {
							if (modifiers.defaultVal) {
								updatedVal.type = modifiers.defaultVal;
							}
						}
						
						const keys = Object.keys(updatedVal);
						if (keys.length === 1 && keys[0] === 'type') {
							strata.schema[columnName] = updatedVal.type;
						} else {
							strata.schema[columnName] = updatedVal;
						}
						
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					}
				} catch (e) {}
			}
		}
	}

	const initializer = decl.getInitializer();
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

/**
 * Updates bucket-level configuration (e.g. public access, custom domain, CORS) in R2 JSDoc metadata.
 */
export function updateTableMetadataInSchema(
	code: string,
	tableName: string,
	metadata: { public?: boolean; customDomain?: string | null; cors?: boolean; class?: string; path?: string }
): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration(tableName);
	if (!decl) return code;

	const statement = decl.getVariableStatement();
	if (statement) {
		const jsDocs = statement.getJsDocs();
		for (const doc of jsDocs) {
			const text = doc.getText();
			const match = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
			if (match) {
				try {
					const strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
					
					if (metadata.public !== undefined) {
						if (metadata.public) {
							strata.public = true;
						} else {
							delete strata.public;
						}
					}
					if (metadata.customDomain !== undefined) {
						if (metadata.customDomain && metadata.customDomain.trim() !== '') {
							strata.customDomain = metadata.customDomain.trim();
						} else {
							delete strata.customDomain;
						}
					}
					if (metadata.cors !== undefined) {
						if (metadata.cors) {
							strata.cors = true;
						} else {
							delete strata.cors;
						}
					}
					if (metadata.class !== undefined) {
						if (metadata.class && metadata.class.trim() !== '') {
							strata.class = metadata.class.trim();
						} else {
							delete strata.class;
						}
					}
					if (metadata.path !== undefined) {
						if (metadata.path && metadata.path.trim() !== '') {
							strata.path = metadata.path.trim();
						} else {
							delete strata.path;
						}
					}

					doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
					return sf.getFullText();
				} catch (e) {}
			}
		}
	}
	return code;
}

/**
 * Updates the project-level config block in the schema file.
 */
export function updateProjectConfigInSchema(code: string, config: { wranglerPath?: string }): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	const decl = sf.getVariableDeclaration('strataConfig');
	
	const strataVal = {
		target: 'project',
		wranglerPath: config.wranglerPath
	};

	if (decl) {
		const statement = decl.getVariableStatement();
		if (statement) {
			const jsDocs = statement.getJsDocs();
			if (jsDocs.length > 0) {
				const doc = jsDocs[0];
				const text = doc.getText();
				const match = text.match(/@strata\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
				if (match) {
					try {
						const strata = JSON.parse(match[1].replace(/^\s*\*\s?/gm, ''));
						strata.wranglerPath = config.wranglerPath;
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} catch (e) {}
				}
				doc.replaceWithText(`*\n * @strata ${JSON.stringify(strataVal)}\n `);
				return sf.getFullText();
			} else {
				statement.addJsDoc({
					description: `\n * @strata ${JSON.stringify(strataVal)}\n `
				});
				return sf.getFullText();
			}
		}
	} else {
		const content = `\n/**\n * @strata ${JSON.stringify(strataVal)}\n */\nexport const strataConfig = {};\n`;
		sf.insertText(sf.getFullWidth(), content);
	}
	return sf.getFullText();
}

/**
 * Scaffolds the standard Better Auth Drizzle D1 table cluster (user, session, account, verification).
 */
export function scaffoldBetterAuthClusterInSchema(code: string): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	ensureImports(sf, 'drizzle-orm/sqlite-core', ['sqliteTable', 'text', 'integer']);

	const tablesToScaffold = [
		{
			name: 'user',
			code: `export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});\n`
		},
		{
			name: 'session',
			code: `export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull().references(() => user.id)
});\n`
		},
		{
			name: 'account',
			code: `export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});\n`
		},
		{
			name: 'verification',
			code: `export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" })
});\n`
		}
	];

	for (const tbl of tablesToScaffold) {
		if (!sf.getVariableDeclaration(tbl.name)) {
			sf.insertText(sf.getFullWidth(), `\n${tbl.code}`);
		}
	}

	return sf.getFullText();
}

/**
 * Scaffolds a local D1 mirror table for Clerk webhooks.
 */
export function scaffoldClerkMirrorTableInSchema(code: string, tableName = 'users'): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	ensureImports(sf, 'drizzle-orm/sqlite-core', ['sqliteTable', 'text', 'integer']);

	let targetName = tableName;
	let counter = 1;
	while (sf.getVariableDeclaration(targetName)) {
		targetName = `${tableName}${counter++}`;
	}

	const snippet = `\nexport const ${targetName} = sqliteTable("${targetName}", {
	id: text("id").primaryKey(),
	clerkUserId: text("clerk_user_id").notNull().unique(),
	email: text("email").notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	imageUrl: text("image_url"),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" })
});\n`;

	sf.insertText(sf.getFullWidth(), snippet);
	return sf.getFullText();
}

/**
 * Scaffolds a local D1 mirror table for WorkOS Directory Sync / SSO.
 */
export function scaffoldWorkOSMirrorTableInSchema(code: string, tableName = 'workosUsers'): string {
	const { project, sourceFile: sf } = createIsolatedProject('schema.ts', code);
	ensureImports(sf, 'drizzle-orm/sqlite-core', ['sqliteTable', 'text', 'integer']);

	let targetName = tableName;
	let counter = 1;
	while (sf.getVariableDeclaration(targetName)) {
		targetName = `${tableName}${counter++}`;
	}

	const snippet = `\nexport const ${targetName} = sqliteTable("${targetName}", {
	id: text("id").primaryKey(),
	workosUserId: text("workos_user_id").notNull().unique(),
	workosOrgId: text("workos_org_id"),
	email: text("email").notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	createdAt: integer("created_at", { mode: "timestamp" }),
	updatedAt: integer("updated_at", { mode: "timestamp" })
});\n`;

	sf.insertText(sf.getFullWidth(), snippet);
	return sf.getFullText();
}

/**
 * Updates or creates the consolidated @strata-layout JSDoc manifest in the root schema file.
 * This keeps domain files (users.ts, posts.ts) 100% clean in Git diffs when dragging nodes.
 */
export function updateLayoutManifestInSchema(
	code: string,
	positions: Record<string, { x: number; y: number }>,
	pruneMissing: boolean = false
): string {
	const match = code.match(/@strata-layout\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
	
	if (match) {
		let currentManifest: Record<string, { x: number; y: number }> = {};
		try {
			const cleanJson = match[1].replace(/^\s*\*\s?/gm, '');
			currentManifest = JSON.parse(cleanJson);
		} catch {}

		const merged = pruneMissing ? { ...positions } : { ...currentManifest, ...positions };
		const formattedJson = JSON.stringify(merged, null, 2)
			.split('\n')
			.map((line, idx) => (idx === 0 ? line : ` * ${line}`))
			.join('\n');

		return code.replace(match[0], `@strata-layout ${formattedJson}`);
	} else {
		// Prepend manifest at the top of the root file
		const formattedJson = JSON.stringify(positions, null, 2)
			.split('\n')
			.map((line, idx) => (idx === 0 ? line : ` * ${line}`))
			.join('\n');

		const manifestComment = `/**\n * @strata-layout ${formattedJson}\n */\n\n`;
		return manifestComment + code;
	}
}

/**
 * Removes a table from the consolidated @strata-layout manifest if present.
 */
export function removeTableFromLayoutManifest(code: string, tableName: string): string {
	const match = code.match(/@strata-layout\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
	if (!match) return code;
	try {
		const cleanJson = match[1].replace(/^\s*\*\s?/gm, '');
		const manifest = JSON.parse(cleanJson);
		if (tableName in manifest) {
			delete manifest[tableName];
			const formattedJson = JSON.stringify(manifest, null, 2)
				.split('\n')
				.map((line, idx) => (idx === 0 ? line : ` * ${line}`))
				.join('\n');
			return code.replace(match[0], `@strata-layout ${formattedJson}`);
		}
	} catch {}
	return code;
}

/**
 * Renames a table key in the consolidated @strata-layout manifest if present.
 */
export function renameTableInLayoutManifest(code: string, oldName: string, newName: string): string {
	const match = code.match(/@strata-layout\s+({[\s\S]*?})(?=\s*\n?\s*\*?\s*@|\s*\n?\s*\*?\s*\/|\s*$)/);
	if (!match) return code;
	try {
		const cleanJson = match[1].replace(/^\s*\*\s?/gm, '');
		const manifest = JSON.parse(cleanJson);
		if (oldName in manifest) {
			manifest[newName] = manifest[oldName];
			delete manifest[oldName];
			const formattedJson = JSON.stringify(manifest, null, 2)
				.split('\n')
				.map((line, idx) => (idx === 0 ? line : ` * ${line}`))
				.join('\n');
			return code.replace(match[0], `@strata-layout ${formattedJson}`);
		}
	} catch {}
	return code;
}

/**
 * Creates clean standalone D1 table code for a new domain module file.
 */
export function createD1ModuleCode(tableName: string, presets?: TablePresets): string {
	const sanitized = sanitizeIdentifier(tableName);
	const { code: columnsCode, imports } = generateD1TableColumns(sanitized, presets);
	return `import { ${imports.join(", ")} } from "drizzle-orm/sqlite-core";

export const ${sanitized} = sqliteTable("${sanitized}", {
${columnsCode}
});
`;
}

/**
 * Ensures a barrel file (e.g. index.ts) re-exports a given module specifier.
 * Example: export * from "./comments";
 */
export function addReExportToBarrel(barrelCode: string, moduleSpecifier: string): string {
	const cleanSpecifier = moduleSpecifier.replace(/^\.\//, '').replace(/\.ts$/, '');
	const regex = new RegExp(`export\\s*\\*\\s*from\\s*["'](\\.\\/)?${cleanSpecifier}(\\.js|\\.ts)?["']`, 'i');
	if (regex.test(barrelCode)) {
		return barrelCode;
	}

	const normalizedExport = moduleSpecifier.startsWith('.') ? moduleSpecifier.replace(/\.ts$/, '') : `./${moduleSpecifier.replace(/\.ts$/, '')}`;
	const trimmed = barrelCode.trimEnd();
	return trimmed ? `${trimmed}\nexport * from "${normalizedExport}";\n` : `export * from "${normalizedExport}";\n`;
}

/**
 * Resolves the primary schema file or barrel index from drizzle.config.ts contents.
 * Supports string literals, backtick template strings, string arrays, trailing slashes, and glob patterns.
 */
export function parseDrizzleConfigSchemaPath(configCode: string, configFilePath: string): string | null {
	let candidatePath: string | null = null;

	// 1. Check for array of schemas: schema: [ ... ]
	const arrayMatch = configCode.match(/schema:\s*\[([\s\S]*?)\]/);
	if (arrayMatch) {
		const rawItems = [...arrayMatch[1].matchAll(/["'`]((?:\\.|[^"'`])+)["'`]/g)].map(m => m[1].trim());
		if (rawItems.length > 0) {
			candidatePath = rawItems.find(p => p.includes('index.ts') || p.includes('schema.ts') || p.includes('*')) || rawItems[0];
		}
	}

	if (!candidatePath) {
		// 2. Check for single string (single quotes, double quotes, or backticks)
		const singleMatch = configCode.match(/schema:\s*["'`]((?:\\.|[^"'`])+)["'`]/);
		if (singleMatch) {
			candidatePath = singleMatch[1].trim();
		}
	}

	if (!candidatePath) return null;

	let rawPath = candidatePath;
	const baseDir = configFilePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');

	// Strip glob patterns like /*, /**, /*.ts
	if (rawPath.endsWith('/**')) {
		rawPath = rawPath.slice(0, -3);
	} else if (rawPath.endsWith('/*.ts')) {
		rawPath = rawPath.slice(0, -5);
	} else if (rawPath.endsWith('/*')) {
		rawPath = rawPath.slice(0, -2);
	}

	// Strip trailing slashes
	rawPath = rawPath.replace(/\/+$/, '');

	if (!rawPath.endsWith('.ts')) {
		rawPath = `${rawPath}/index.ts`;
	}

	if (rawPath.startsWith('.')) {
		const parts = `${baseDir}/${rawPath}`.split('/');
		const resolved: string[] = [];
		for (const part of parts) {
			if (part === '.' || part === '') continue;
			if (part === '..') resolved.pop();
			else resolved.push(part);
		}
		return (configFilePath.startsWith('/') ? '/' : '') + resolved.join('/');
	}

	return rawPath;
}


