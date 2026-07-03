/**
 * mutators.ts
 *
 * Summary: Surgical AST mutator operations to alter drizzle schema files when the user interacts with the UI.
 * Expects: TypeScript schema code strings and modification targets (positions, tables, columns, relations).
 * Output: Mutated/updated TypeScript code string.
 */
import { SyntaxKind } from 'ts-morph';
import type { Node } from '@xyflow/svelte';
import { syncSourceFile } from './project';
import { 
	findSqliteTableCall, 
	isDrizzleTableDeclaration, 
	parseColumnChain, 
	buildColumnChain, 
	ensureImports 
} from './helpers';

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
	return sf.getFullText();
}

/**
 * Adds a new table or plain object entity to the schema.
 */
export function addTableToSchema(code: string, tableName: string, target: 'd1' | 'do' | 'kv' | 'r2' = 'd1'): string {
	const sf = syncSourceFile(code);
	
	if (target === 'd1' || target === 'do') {
		ensureImports(sf, "drizzle-orm/sqlite-core", ["sqliteTable", "integer", "text"]);
		const targetLabel = target === 'do' ? ',"target":"do"' : '';
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}${targetLabel}} \n */\nexport const ${tableName} = sqliteTable("${tableName}", {
  id: integer("id").primaryKey(),
});\n`;
		sf.insertText(sf.getFullWidth(), content);
	} else if (target === 'r2') {
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}, "target": "r2", "folders": {}} \n */\nexport const ${tableName} = {};\n`;
		sf.insertText(sf.getFullWidth(), content);
	} else {
		const content = `\n/** \n * @strata {"x": ${Math.round(Math.random() * 400)}, "y": ${Math.round(Math.random() * 400)}, "target": "kv", "schema": {}} \n */\nexport const ${tableName} = {};\n`;
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
		const val = type === 'text' ? 'string' : type;
		initializer.addPropertyAssignment({ name: columnName, initializer: `"${val}"` });
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
					if (strata.target === 'kv' && strata.schema) {
						delete strata.schema[columnName];
						doc.replaceWithText(text.replace(match[0], `@strata ${JSON.stringify(strata)}`));
						return sf.getFullText();
					} else if (strata.target === 'r2' && strata.folders) {
						const cleanKey = columnName.endsWith('/') ? columnName.slice(0, -1) : columnName;
						delete strata.folders[cleanKey];
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
