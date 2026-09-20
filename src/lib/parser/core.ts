/**
 * core.ts
 *
 * Summary: Parses TypeScript/Drizzle schema files into visual Svelte Flow nodes and edges.
 * Expects: Raw typescript code string and optional external file mappings.
 * Output: ParseResult structure containing nodes, edges, warnings, and external imports.
 */
import { SourceFile, VariableDeclaration, SyntaxKind } from 'ts-morph';
import { type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { ParseResult, AuditIssue, StrataNode, StrataEdge } from '#lib/parser/types';
import { createIsolatedProject } from '#lib/parser/project';
import { findSqliteTableCall, isDrizzleTableDeclaration, parseColumnChain, resolvePathAlias, resolveRelativePath, extractStrataMetadata, extractStrataLayoutManifest, extractStrataLayoutManifestDetails, detectPackageWrapper } from '#lib/parser/helpers';


/**
 * Wraps raw code in pre/code tags for UI presentation.
 */
export function wrapCode(code: string) {
	return `<pre><code>${code}</code></pre>`;
}

/**
 * Helper to retrieve external file content with normalized path matching (handles optional ./ prefixes).
 */
export function getMapFileContent(map: Map<string, string> | undefined, rawPath: string | undefined): string | undefined {
	if (!map || !rawPath) return undefined;
	const withExt = rawPath.endsWith('.ts') ? rawPath : rawPath + '.ts';
	const withoutExt = rawPath.endsWith('.ts') ? rawPath.slice(0, -3) : rawPath;

	const candidates = [
		rawPath,
		withExt,
		withoutExt,
		withExt.replace(/^\.\//, ''),
		withoutExt.replace(/^\.\//, ''),
		'./' + withExt.replace(/^\.\//, ''),
		'./' + withoutExt.replace(/^\.\//, '')
	];

	for (const candidate of candidates) {
		if (map.has(candidate)) return map.get(candidate);
	}
	return undefined;
}

/**
 * Parses a Drizzle schema file into Svelte Flow nodes and edges.
 * Handles D1 (sqliteTable), KV (plain objects), relations, and relative external imports.
 */
export function parseSchema(
	code: string,
	externalFilesMap?: Map<string, string>,
	paths?: Record<string, string[]>,
	tsconfigPath?: string,
	filePath?: string
): ParseResult {
	const tempSourceFiles: SourceFile[] = [];
	const effectiveFileName = filePath ? filePath.split(/[/\\]/).pop() || 'schema.ts' : 'schema.ts';
	const { project, sourceFile: sf } = createIsolatedProject(effectiveFileName, code);
	try {
		
		const nodes: StrataNode[] = [];
		const edges: StrataEdge[] = [];
		const externalPaths: string[] = [];
		const warnings: string[] = [];
		const auditIssues: AuditIssue[] = [];
		
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
			} else if (isExternal && filePath) {
				resolvedPath = resolveRelativePath(filePath, specifier);
			}

			if (isExternal) {
				const names = imp.getNamedImports().map(ni => ni.getAliasNode()?.getText() || ni.getName());
				// Handle named imports or default/namespace imports
				externalImports.push({
					filePath: resolvedPath,
					importNames: names.length > 0 ? names : ['*']
				});
			}
		}

		// Find all relative or aliased export declarations (e.g. export * from './users'; export { a, b } from './posts')
		const exportDecls = sf.getExportDeclarations();
		for (const exp of exportDecls) {
			const specifier = exp.getModuleSpecifierValue();
			if (!specifier) continue;
			let isExternal = specifier.startsWith('.') || specifier.startsWith('..');
			let resolvedPath = specifier;

			if (!isExternal && paths && tsconfigPath) {
				const resolved = resolvePathAlias(specifier, paths, tsconfigPath);
				if (resolved) {
					isExternal = true;
					resolvedPath = resolved;
				}
			} else if (isExternal && filePath) {
				resolvedPath = resolveRelativePath(filePath, specifier);
			}

			if (isExternal) {
				const namedExports = exp.getNamedExports();
				const names = namedExports.map(ne => ne.getAliasNode()?.getText() || ne.getName());
				externalImports.push({
					filePath: resolvedPath,
					importNames: names.length > 0 ? names : ['*']
				});
			}
		}

		// Find all exported declarations in main schema file
		const variableStatements = sf.getVariableStatements();
		const tableDeclarations = new Map<string, VariableDeclaration>();
		let wranglerPath: string | undefined = undefined;
		// Extract @strata-layout manifest if present in the root file
		const manifestDetails = extractStrataLayoutManifestDetails(code);
		const layoutManifest = manifestDetails.manifest;
		if (layoutManifest && (layoutManifest as any).__config__?.wranglerPath) {
			wranglerPath = (layoutManifest as any).__config__.wranglerPath;
		}
		if (manifestDetails.error) {
			auditIssues.push({
				id: `audit_layout_manifest_${Date.now()}`,
				severity: 'warning',
				code: 'MALFORMED_LAYOUT_MANIFEST',
				message: manifestDetails.error,
				rawMatch: manifestDetails.rawMatch,
				suggestedFix: {
					label: 'Auto-repair Layout Manifest',
					action: 'auto_repair_jsdoc'
				}
			});
		}
		
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
						if (strataExtracted.issue) {
							auditIssues.push({
								id: `audit_${decl.getName()}_${statement.getStartLineNumber()}_${auditIssues.length}`,
								severity: strataExtracted.issue.code === 'JSDOC_SYNTAX_ERROR' && strataExtracted.data ? 'warning' : 'error',
								code: strataExtracted.issue.code,
								message: strataExtracted.issue.message,
								symbolName: decl.getName(),
								line: statement.getStartLineNumber(),
								column: 1,
								rawMatch: strataExtracted.rawMatch,
								suggestedFix: {
									label: 'Auto-Repair JSDoc',
									action: 'auto_repair_jsdoc'
								}
							});
						}
						if (strataExtracted.data) {
							strataData = { ...strataData, ...strataExtracted.data };
						}
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
						for (const col of columns) {
							if (col.definition && /\btimestamp\s*\(/.test(col.definition) && !col.definition.includes('mode:')) {
								auditIssues.push({
									id: `audit_d1_timestamp_${tableName}_${col.name}`,
									severity: 'warning',
									code: 'D1_TYPE_COMPATIBILITY',
									message: `Column "${col.name}" on "${tableName}" uses timestamp() without SQLite mode. Cloudflare D1 lacks native Date: recommend using integer("${col.name}", { mode: "timestamp" }).`,
									symbolName: tableName,
									line: statement.getStartLineNumber(),
									rawMatch: col.definition,
									suggestedFix: {
										label: 'Convert to integer({ mode: "timestamp" })',
										action: 'fix_d1_type'
									}
								});
							} else if (col.definition && /\bboolean\s*\(/.test(col.definition) && !col.definition.includes('mode:')) {
								auditIssues.push({
									id: `audit_d1_boolean_${tableName}_${col.name}`,
									severity: 'warning',
									code: 'D1_TYPE_COMPATIBILITY',
									message: `Column "${col.name}" on "${tableName}" uses boolean() without SQLite mode. Cloudflare D1 lacks native Boolean: recommend using integer("${col.name}", { mode: "boolean" }).`,
									symbolName: tableName,
									line: statement.getStartLineNumber(),
									rawMatch: col.definition,
									suggestedFix: {
										label: 'Convert to integer({ mode: "boolean" })',
										action: 'fix_d1_type'
									}
								});
							}
						}
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
						let missingFileWarning: string | undefined = undefined;
						if (strataData.path) {
							const fileContent = getMapFileContent(externalFilesMap, strataData.path);
							if (fileContent) {
								try {
									const doSf = project.createSourceFile(`temp_do_${tableName}.ts`, fileContent, { overwrite: true });
									tempSourceFiles.push(doSf);
									const classDecl = (strataData.class ? doSf.getClass(strataData.class) : undefined) || doSf.getClasses()[0];
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
									} else {
										missingFileWarning = `Durable Object class "${strataData.class || 'default'}" not found in "${strataData.path}"`;
										warnings.push(missingFileWarning);
									}
								} catch (err: any) {
									console.warn(`Failed to parse DO class methods at ${strataData.path}:`, err);
									warnings.push(`Failed to parse DO class methods at ${strataData.path}: ${err?.message || String(err)}`);
								}
							} else if (filePath && externalFilesMap) {
								missingFileWarning = `Durable Object class file not found at path "${strataData.path}"`;
								warnings.push(missingFileWarning);
							}

							const correctedPath = externalFilesMap?.get('__correction__' + strataData.path);
							if (correctedPath) {
								auditIssues.push({
									id: `audit_path_${tableName}_${statement.getStartLineNumber()}`,
									severity: 'warning',
									code: 'MISCALCULATED_PATH_DEPTH',
									message: `Path depth miscalculated: "${strataData.path}" was resolved from monorepo root. Recommended path: "${correctedPath}".`,
									symbolName: tableName,
									line: statement.getStartLineNumber(),
									column: 1,
									rawMatch: strataData.path,
									suggestedFix: {
										label: `Fix Path to ${correctedPath}`,
										action: 'fix_path',
										payload: { correctedPath }
									}
								});
							} else if (missingFileWarning && strataData.path && filePath) {
								auditIssues.push({
									id: `audit_missing_do_${tableName}_${statement.getStartLineNumber()}`,
									severity: 'warning',
									code: 'MISSING_EXTERNAL_FILE',
									message: missingFileWarning,
									symbolName: tableName,
									line: statement.getStartLineNumber(),
									column: 1,
									rawMatch: strataData.path
								});
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
						
						if (missingFileWarning) {
							strataData.missingFileWarning = missingFileWarning;
						}
					}

					if (target !== 'schema') {
						const sourceFilePath = filePath || 'schema.ts';
						const moduleName = sourceFilePath.split(/[/\\]/).pop() || 'schema.ts';
						const nodeType = target === 'd1' || !target ? 'table' : target;
						nodes.push({
							id: tableName,
							type: nodeType,
							data: { 
								label: tableName, 
								columns,
								methods: target === 'do' ? columns : undefined,
								patterns: target === 'kv' ? columns : undefined,
								folders: target === 'r2' ? columns : undefined,
								target,
								strata: strataData,
								line: decl.getStartLineNumber(),
								moduleInfo: {
									sourceFilePath,
									moduleName,
									isRootFile: true
								},
								isExternal: false
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
		if (externalFilesMap && typeof (externalFilesMap as any).entries === 'function') {
			// Populate all files from externalFilesMap into the project
			for (const [fPath, content] of externalFilesMap.entries()) {
				const tempName = `temp_${fPath.replace(/[\/.]/g, '_')}.ts`;
				if (!project.getSourceFile(tempName)) {
					try {
						const extSf = project.createSourceFile(tempName, content, { overwrite: true });
						tempSourceFiles.push(extSf);
					} catch (e) {}
				}
			}

			// Process imports
			for (const extImp of externalImports) {
				const externalContent = getMapFileContent(externalFilesMap, extImp.filePath);
				if (externalContent) {
					try {
						const tempName = `temp_${extImp.filePath.replace(/[\/.]/g, '_')}.ts`;
						let extSf = project.getSourceFile(tempName);
						if (!extSf) {
							extSf = project.createSourceFile(tempName, externalContent, { overwrite: true });
							tempSourceFiles.push(extSf);
						}
						const targetDecls: VariableDeclaration[] = [];
						if (extImp.importNames.includes('*')) {
							for (const d of extSf.getVariableDeclarations()) {
								if (isDrizzleTableDeclaration(d)) targetDecls.push(d);
							}
						} else {
							for (const name of extImp.importNames) {
								const decl = extSf.getVariableDeclaration(name);
								if (decl && isDrizzleTableDeclaration(decl)) {
									targetDecls.push(decl);
								}
							}
						}

						for (const decl of targetDecls) {
							const name = decl.getName();
							if (nodes.some(n => n.id === name)) continue;

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

							// Register external node with first-class module identity
							const moduleName = extImp.filePath.split(/[/\\]/).pop() || extImp.filePath;
							const extTarget = strataData.target || 'd1';
							const extNodeType = extTarget === 'd1' ? 'table' : extTarget;
							const extCols = extractColumns(decl);
							nodes.push({
								id: name,
								type: extNodeType,
								data: {
									label: name,
									columns: extCols,
									methods: extTarget === 'do' ? extCols : undefined,
									patterns: extTarget === 'kv' ? extCols : undefined,
									folders: extTarget === 'r2' ? extCols : undefined,
									target: extTarget,
									strata: strataData,
									line: decl.getStartLineNumber(),
									moduleInfo: {
										sourceFilePath: extImp.filePath,
										moduleName,
										isRootFile: false
									},
									isExternal: true
								},
								position: { x: strataData.x, y: strataData.y }
							});
							
							// Register declaration so we can scan relationships from main schema pointing here
							tableDeclarations.set(name, decl);
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
							if (d.wasForgotten()) return false;
							try {
								const strata = d.getVariableStatement()?.getJsDocs()[0]?.getText();
								return strata?.includes('"target": "schema"') && strata?.includes(filePath);
							} catch {
								return false;
							}
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
											const moduleName = filePath.split(/[/\\]/).pop() || filePath;
											const customTarget = strataData.target || 'd1';
											const customNodeType = customTarget === 'd1' ? 'table' : customTarget;
											const customCols = extractColumns(decl);
											nodes.push({
												id: tableName,
												type: customNodeType,
												data: {
													label: tableName,
													columns: customCols,
													methods: customTarget === 'do' ? customCols : undefined,
													patterns: customTarget === 'kv' ? customCols : undefined,
													folders: customTarget === 'r2' ? customCols : undefined,
													target: customTarget,
													strata: strataData,
													line: decl.getStartLineNumber(),
													moduleInfo: {
														sourceFilePath: filePath,
														moduleName,
														isRootFile: false
													},
													isExternal: false
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
		
		// Extract unified relationships: Phase 1 (Physical FKs) then Phase 2 (Drizzle Relations)
		const allSourceFiles = project.getSourceFiles();
		extractAllSchemaRelations(tableDeclarations, edges, allSourceFiles);

		// Validation: Ensure all synthetic relations point to existing targets
		const tableNames = new Set(nodes.map(n => n.id));
		for (const [tableName, decl] of tableDeclarations) {
			if (decl.wasForgotten()) continue;
			try {
				const statement = decl.getVariableStatement();
				const jsDocs = statement?.getJsDocs() || [];
				const lineNum = statement?.getStartLineNumber() || 1;
				for (const doc of jsDocs) {
					const strataExtracted = extractStrataMetadata(doc.getText());
					if (strataExtracted?.data?.relations && Array.isArray(strataExtracted.data.relations)) {
						for (const rel of strataExtracted.data.relations) {
							if (!tableNames.has(rel.to)) {
								const msg = `Synthetic relationship in "${tableName}" points to missing target "${rel.to}"`;
								warnings.push(msg);
								auditIssues.push({
									id: `audit_dangling_${tableName}_${rel.to}`,
									severity: 'warning',
									code: 'DANGLING_RELATION',
									message: msg,
									symbolName: tableName,
									line: lineNum,
									suggestedFix: {
										label: 'Remove Dangling Relation',
										action: 'auto_repair_jsdoc'
									}
								});
							}
						}
					}
				}
			} catch {}
		}

		// Detect Better Auth cluster
		const betterAuthNames = new Set(['user', 'users', 'session', 'sessions', 'account', 'accounts', 'verification', 'verifications']);
		const matchingAuthTables = nodes.filter(n => betterAuthNames.has(n.id.toLowerCase()));
		if (matchingAuthTables.length >= 2) {
			const authCoreCols = new Set([
				'id', 'userid', 'user_id', 'token', 'expiresat', 'expires_at', 'password',
				'emailverified', 'email_verified', 'identifier', 'value', 'createdat', 'created_at',
				'updatedat', 'updated_at', 'accountid', 'account_id', 'providerid', 'provider_id',
				'ipaddress', 'ip_address', 'useragent', 'user_agent'
			]);
			for (const node of matchingAuthTables) {
				(node.data as any).isBetterAuth = true;
				const cols = (node.data as any).columns;
				if (Array.isArray(cols)) {
					for (const col of cols) {
						const normName = col.name.toLowerCase().replace(/[^a-z0-9]/g, '');
						if (authCoreCols.has(normName) || authCoreCols.has(col.name.toLowerCase())) {
							col.isAuthCore = true;
						} else if (!['name', 'email', 'image'].includes(col.name.toLowerCase())) {
							col.isCustomField = true;
						}
					}
				}
			}
		}

		// Detect Clerk and WorkOS boundary columns across all nodes
		const clerkBoundTables: { tableId: string; colName: string }[] = [];
		const workosBoundTables: { tableId: string; colName: string }[] = [];

		for (const node of nodes) {
			if (node.type === 'identity') continue;
			const cols = (node.data as any)?.columns || [];
			for (const col of cols) {
				const colLower = col.name.toLowerCase();
				if (colLower.includes('clerk')) {
					clerkBoundTables.push({ tableId: node.id, colName: col.name });
				}
				if (colLower.includes('workos')) {
					workosBoundTables.push({ tableId: node.id, colName: col.name });
				}
			}
		}

		if (clerkBoundTables.length > 0) {
			const clerkNodeId = '__clerk_identity__';
			const existingClerk = nodes.find(n => n.id === clerkNodeId);
			if (!existingClerk) {
				nodes.push({
					id: clerkNodeId,
					type: 'identity',
					data: {
						provider: 'clerk',
						label: 'Clerk Auth',
						title: 'Clerk Authentication',
						description: 'Hosted User Management & Auth Provider',
						boundTables: clerkBoundTables
					},
					position: { x: 50, y: 50 }
				});
			}
			for (const bound of clerkBoundTables) {
				const edgeId = `edge-${clerkNodeId}-${bound.tableId}-${bound.colName}`;
				if (!edges.some(e => e.id === edgeId)) {
					edges.push({
						id: edgeId,
						source: clerkNodeId,
						target: bound.tableId,
						type: 'relation',
						animated: true,
						data: {
							isIdentityBoundary: true,
							provider: 'clerk',
							sourceCol: 'id',
							targetCol: bound.colName,
							relationType: 'one-to-many'
						}
					});
				}
			}
		}

		if (workosBoundTables.length > 0) {
			const workosNodeId = '__workos_identity__';
			const existingWorkos = nodes.find(n => n.id === workosNodeId);
			if (!existingWorkos) {
				nodes.push({
					id: workosNodeId,
					type: 'identity',
					data: {
						provider: 'workos',
						label: 'WorkOS SSO',
						title: 'WorkOS Enterprise SSO',
						description: 'Enterprise SSO & Directory Sync',
						boundTables: workosBoundTables
					},
					position: { x: 50, y: 300 }
				});
			}
			for (const bound of workosBoundTables) {
				const edgeId = `edge-${workosNodeId}-${bound.tableId}-${bound.colName}`;
				if (!edges.some(e => e.id === edgeId)) {
					edges.push({
						id: edgeId,
						source: workosNodeId,
						target: bound.tableId,
						type: 'relation',
						animated: true,
						data: {
							isIdentityBoundary: true,
							provider: 'workos',
							sourceCol: 'id',
							targetCol: bound.colName,
							relationType: 'one-to-many'
						}
					});
				}
			}
		}

		// Apply layout manifest overrides if present in root schema
		if (layoutManifest) {
			for (const node of nodes) {
				if (layoutManifest[node.id]) {
					node.position = {
						x: Math.round(layoutManifest[node.id].x),
						y: Math.round(layoutManifest[node.id].y)
					};
				}
			}
			for (const [nodeId, meta] of Object.entries(layoutManifest)) {
				if (meta && Array.isArray((meta as any).relations)) {
					for (const rel of (meta as any).relations) {
						if (rel && rel.to) {
							addEdgeIfUnique(edges, nodeId, rel.to, true, 'synthetic');
						}
					}
				}
			}
		}

		// Cleanup: Ensure all edges point to existing nodes and emit actionable diagnostics for broken references
		const allNodeIds = new Set(nodes.map(n => n.id));
		const validEdges: Edge[] = [];
		for (const edge of edges) {
			if (allNodeIds.has(edge.source) && allNodeIds.has(edge.target)) {
				validEdges.push(edge);
			} else if (!(edge.data as any)?.isSynthetic && (edge.data as any)?.edgeType !== 'synthetic' && edge.label !== 'synthetic') {
				const fromNode = edge.source;
				const colName = (edge.data as any)?.sourceCol || (edge as any).sourceHandle;
				const isFk = (edge.data as any)?.edgeType === 'fk' || !(edge.data as any)?.isVirtual;
				const msg = colName
					? `Foreign key on "${fromNode}.${colName}" references missing table "${edge.target}". Ensure "${edge.target}" is defined, exported, or imported into this module.`
					: `Relationship from "${fromNode}" references missing table "${edge.target}".`;
				warnings.push(msg);
				auditIssues.push({
					id: `audit_fk_missing_${fromNode}_${edge.target}_${colName || 'rel'}`,
					severity: isFk ? 'error' : 'warning',
					code: 'MISSING_FOREIGN_KEY_TARGET',
					message: msg,
					symbolName: fromNode,
					rawMatch: edge.target
				});
			}
		}
		
		if (nodes.length === 0 && code.trim().length > 0) {
			const packageWrapperInfo = detectPackageWrapper(code, filePath);
			const errorMsg = packageWrapperInfo
				? `Package wrapper detected: No direct tables found in this file. Found re-exports from: [${packageWrapperInfo.reExports.join(', ')}].`
				: filePath
					? `No Drizzle tables or Cloudflare entities found in "${effectiveFileName}". Expected sqliteTable() declarations or barrel re-exports (e.g. export * from './users').`
					: 'No tables or schema objects found';
			return { 
				success: false, 
				error: errorMsg, 
				nodes: [], 
				edges: [], 
				externalImports, 
				externalPaths, 
				warnings, 
				auditIssues, 
				wranglerPath,
				layoutManifest: layoutManifest || undefined,
				packageWrapperInfo: packageWrapperInfo || undefined
			};
		}

		return { success: true, nodes, edges: validEdges, externalImports, externalPaths, warnings, auditIssues, wranglerPath, layoutManifest: layoutManifest || undefined };
	} catch (e: any) {
		console.error("[Strata] Parse critical failure:", e);
		
		let line = 1;
		let column = 0;
		const match = e.message?.match(/(\d+):(\d+)/);
		if (match) {
			line = parseInt(match[1]);
			column = parseInt(match[2]);
		}

		const criticalIssue: AuditIssue = {
			id: `critical_${Date.now()}`,
			severity: 'critical',
			code: 'JSDOC_SYNTAX_ERROR',
			message: `AST Parse Failure: ${e.message || 'Syntax Error'}`,
			line,
			column
		};

		return { 
			success: false, 
			error: e.message || "Unknown Error",
			errorLoc: { line, column },
			nodes: [],
			edges: [],
			auditIssues: [criticalIssue]
		};

	} finally {
		try {
			project.removeSourceFile(sf);
		} catch {}
		for (const tempSf of tempSourceFiles) {
			try {
				project.removeSourceFile(tempSf);
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
 * Adds a physical Foreign Key edge backed by .references().
 */
export function addPhysicalFkEdge(
	edges: Edge[],
	source: string,
	target: string,
	sourceCol?: string,
	targetCol?: string
) {
	const id = `e-${source}-${target}-${sourceCol || 'fk'}`;
	if (edges.some(e => e.id === id)) return;
	if (source === target && !sourceCol) return;

	const edgeColor = 'var(--color-primary)';
	edges.push({
		id,
		source,
		target,
		sourceHandle: sourceCol || 'source',
		targetHandle: targetCol || 'target',
		animated: false,
		label: sourceCol || 'FK',
		labelStyle: 'font-size: 10px; color: var(--color-base-content); font-weight: bold;',
		style: `stroke: ${edgeColor}; stroke-width: 2.25; opacity: 1.0;`,
		type: 'relation',
		data: {
			isPhysical: true,
			isVirtual: false,
			isSynthetic: false,
			cardinality: '1:N',
			edgeType: 'fk',
			sourceCol,
			targetCol,
			fkConstraint: {
				sourceCol: sourceCol || '',
				targetCol: targetCol || ''
			},
			relationNames: [],
			drizzleRelations: [],
			description: `Physical FK: ${source}.${sourceCol || ''} → ${target}.${targetCol || ''}`
		},
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 15,
			height: 15,
			color: edgeColor,
		}
	});
}

/**
 * Updates human-readable relationship pedigree description.
 */
function updateEdgeDescription(edge: Edge) {
	const d = edge.data as any;
	if (!d) return;
	const parts: string[] = [];
	if (d.isPhysical) {
		const srcCol = d.sourceCol || edge.sourceHandle;
		const tgtCol = d.targetCol || edge.targetHandle;
		parts.push(`Physical FK: ${edge.source}.${srcCol} → ${edge.target}.${tgtCol}`);
	} else if (d.isSynthetic) {
		parts.push(`Cloudflare Service Topology: ${edge.source} → ${edge.target}`);
	} else {
		parts.push(`Virtual Drizzle Relation: ${edge.source} ↔ ${edge.target}`);
	}
	if (d.drizzleRelations && d.drizzleRelations.length > 0) {
		const relStr = d.drizzleRelations
			.map((r: any) => `${r.fromTable}.${r.relationName} (${r.relationType})`)
			.join(', ');
		parts.push(`Drizzle: ${relStr}`);
	}
	d.description = parts.join(' | ');
}

/**
 * Unifies a Drizzle relation declaration with an existing physical or virtual edge,
 * or registers a single canonical virtual edge if none exists.
 */
function unifyOrAddDrizzleRelation(
	edges: Edge[],
	fromTable: string,
	targetTable: string,
	relType: string,
	propName: string,
	sourceColFromConfig?: string,
	targetColFromConfig?: string,
	relationNameConfig?: string,
	getRelationWrapper?: (from: string, to: string) => string | null
) {
	let matchedEdge: Edge | undefined;

	if (relType === 'one') {
		// fromTable is child, targetTable is parent
		const candidates = edges.filter(e => e.source === fromTable && e.target === targetTable);
		if (candidates.length > 0) {
			if (sourceColFromConfig) {
				matchedEdge = candidates.find(e => 
					(e.data as any)?.sourceCol === sourceColFromConfig || 
					e.sourceHandle === sourceColFromConfig ||
					(e.data as any)?.fkConstraint?.sourceCol === sourceColFromConfig
				);
			}
			if (!matchedEdge && relationNameConfig) {
				matchedEdge = candidates.find(e => 
					e.label === relationNameConfig || 
					(e.data as any)?.relationNames?.includes(relationNameConfig)
				);
			}
			if (!matchedEdge) {
				matchedEdge = candidates.find(e => 
					!(e.data as any)?.drizzleRelations?.some((r: any) => r.fromTable === fromTable && r.relationType === 'one')
				) || candidates[0];
			}
		}

		if (!matchedEdge) {
			const revCandidates = edges.filter(e => e.source === targetTable && e.target === fromTable);
			if (revCandidates.length > 0) {
				matchedEdge = revCandidates[0];
			}
		}
	} else if (relType === 'many') {
		// fromTable is parent, targetTable is child
		const candidates = edges.filter(e => e.source === targetTable && e.target === fromTable);
		if (candidates.length > 0) {
			if (relationNameConfig) {
				matchedEdge = candidates.find(e => 
					e.label === relationNameConfig || 
					(e.data as any)?.relationNames?.includes(relationNameConfig)
				);
			}
			if (!matchedEdge) {
				matchedEdge = candidates.find(e => 
					!(e.data as any)?.drizzleRelations?.some((r: any) => r.fromTable === fromTable && r.relationType === 'many')
				) || candidates[0];
			}
		}

		if (!matchedEdge) {
			const fwdCandidates = edges.filter(e => e.source === fromTable && e.target === targetTable);
			if (fwdCandidates.length > 0) {
				matchedEdge = fwdCandidates[0];
			}
		}
	}

	if (matchedEdge) {
		const ed = matchedEdge.data as any;
		if (!ed.relationNames) ed.relationNames = [];
		if (!ed.relationNames.includes(propName)) ed.relationNames.push(propName);

		if (!ed.drizzleRelations) ed.drizzleRelations = [];
		ed.drizzleRelations.push({ fromTable, relationName: propName, relationType: relType });

		if (relType === 'many') {
			ed.cardinality = '1:N';
		} else if (relType === 'one') {
			const otherWrapper = getRelationWrapper ? getRelationWrapper(targetTable, fromTable) : null;
			const hasReverseOne = otherWrapper === 'one' || ed.drizzleRelations.some((r: any) => r.fromTable === targetTable && r.relationType === 'one');
			const hasReverseMany = otherWrapper === 'many' || ed.drizzleRelations.some((r: any) => r.relationType === 'many');

			if (hasReverseOne) {
				ed.cardinality = '1:1';
			} else if (ed.isPhysical || hasReverseMany) {
				ed.cardinality = '1:N';
			} else {
				ed.cardinality = 'N:1';
			}
		}

		if (!matchedEdge.label || matchedEdge.label === ed.sourceCol || matchedEdge.label === 'FK') {
			matchedEdge.label = propName;
		}

		updateEdgeDescription(matchedEdge);
	} else {
		// Create single canonical virtual edge
		const source = fromTable;
		const target = targetTable;
		const otherWrapper = getRelationWrapper ? getRelationWrapper(targetTable, fromTable) : null;

		let cardinality: '1:1' | '1:N' | 'N:1' | 'unknown' = 'unknown';
		if (relType === 'many') {
			cardinality = '1:N';
		} else if (relType === 'one') {
			cardinality = (otherWrapper === 'one') ? '1:1' : 'N:1';
		}

		const id = `e-${source}-${target}-${propName}`;
		const edgeColor = 'var(--color-secondary)';
		const edge: Edge = {
			id,
			source,
			target,
			sourceHandle: sourceColFromConfig || 'source',
			targetHandle: targetColFromConfig || 'target',
			animated: true,
			label: propName,
			labelStyle: 'font-size: 10px; color: var(--color-base-content); font-weight: bold;',
			style: `stroke: ${edgeColor}; stroke-width: 1.75; stroke-dasharray: 4 4; opacity: 0.85;`,
			type: 'relation',
			data: {
				isVirtual: true,
				isPhysical: false,
				isSynthetic: false,
				cardinality,
				edgeType: relType,
				sourceCol: sourceColFromConfig || propName,
				targetCol: targetColFromConfig,
				relationNames: [propName],
				drizzleRelations: [{ fromTable, relationName: propName, relationType: relType }],
				description: `Virtual Drizzle Relation: ${fromTable}.${propName} (${relType})`
			},
			markerEnd: {
				type: MarkerType.ArrowClosed,
				width: 15,
				height: 15,
				color: edgeColor,
			}
		};
		edges.push(edge);
	}
}

/**
 * Extracts and unifies both physical (FK) and logical (relations()) relationships across all tables and files.
 */
export function extractAllSchemaRelations(
	tableDeclarations: Map<string, VariableDeclaration>,
	edges: Edge[],
	sfOrFiles: any
) {
	const allFiles: SourceFile[] = Array.isArray(sfOrFiles) 
		? sfOrFiles 
		: (sfOrFiles?.getSourceFiles ? sfOrFiles.getSourceFiles() : [sfOrFiles]);

	const getRelationWrapper = (fromTable: string, toTable: string): string | null => {
		for (const file of allFiles) {
			if (!file || typeof file.getVariableDeclarations !== 'function') continue;
			const sourceFileDecls = file.getVariableDeclarations();
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
										return relInit.getExpression().getText();
									}
								}
							}
						}
					}
				}
			}
		}
		return null;
	};

	// ------------------------------------------------------------------------
	// PHASE 1: Physical Foreign Keys (.references()) across all tables
	// ------------------------------------------------------------------------
	for (const [tableName, decl] of tableDeclarations) {
		if (decl.wasForgotten()) continue;
		try {
			const initializer = decl.getInitializer();
			if (!initializer || !decl.getInitializer()?.getText().includes('sqliteTable')) continue;

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
								const colName = call.getAncestors().find(a => a.isKind(SyntaxKind.PropertyAssignment))?.asKind(SyntaxKind.PropertyAssignment)?.getName();
								addPhysicalFkEdge(edges, tableName, targetTable, colName, targetCol);
							}
						}
					}
				}
			}
		} catch {}
	}

	// ------------------------------------------------------------------------
	// PHASE 2: Logical Drizzle relations() across all files
	// ------------------------------------------------------------------------
	for (const file of allFiles) {
		if (!file || typeof file.getVariableDeclarations !== 'function') continue;
		const sourceFileDecls = file.getVariableDeclarations();
		for (const d of sourceFileDecls) {
			const init = d.getInitializer();
			if (init?.isKind(SyntaxKind.CallExpression) && init.getExpression().getText() === 'relations') {
				const args = init.getArguments();
				if (args.length > 1) {
					const fromTable = args[0].getText();
					const body = (args[1] as any).getBody();
					const objLiteral = body.isKind(SyntaxKind.ObjectLiteralExpression) ? body : body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];

					if (objLiteral) {
						for (const prop of objLiteral.getProperties()) {
							if (prop.isKind(SyntaxKind.PropertyAssignment)) {
								const relInit = prop.getInitializer();
								if (relInit?.isKind(SyntaxKind.CallExpression)) {
									const relType = relInit.getExpression().getText();
									const relArgs = relInit.getArguments();
									const targetTable = relArgs[0]?.getText();
									if (!targetTable) continue;

									let sourceColFromConfig: string | undefined;
									let targetColFromConfig: string | undefined;
									let relationNameConfig: string | undefined;

									if (relArgs.length > 1 && relArgs[1].isKind(SyntaxKind.ObjectLiteralExpression)) {
										const configObj = relArgs[1];
										const fieldsProp = configObj.getProperty('fields');
										if (fieldsProp?.isKind(SyntaxKind.PropertyAssignment)) {
											const pa = fieldsProp.getInitializer()?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)[0];
											if (pa) sourceColFromConfig = pa.getName();
										}
										const refProp = configObj.getProperty('references');
										if (refProp?.isKind(SyntaxKind.PropertyAssignment)) {
											const pa = refProp.getInitializer()?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)[0];
											if (pa) targetColFromConfig = pa.getName();
										}
										const relNameProp = configObj.getProperty('relationName');
										if (relNameProp?.isKind(SyntaxKind.PropertyAssignment)) {
											const t = relNameProp.getInitializer()?.getText();
											if (t) relationNameConfig = t.replace(/['"`]/g, '');
										}
									}

									unifyOrAddDrizzleRelation(
										edges,
										fromTable,
										targetTable,
										relType,
										prop.getName(),
										sourceColFromConfig,
										targetColFromConfig,
										relationNameConfig,
										getRelationWrapper
									);
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
 * Backwards compatibility wrapper for extracting relations on a single table.
 */
export function extractRelations(tableName: string, decl: VariableDeclaration, edges: Edge[], sfOrFiles: any) {
	const tableMap = new Map<string, VariableDeclaration>();
	tableMap.set(tableName, decl);
	extractAllSchemaRelations(tableMap, edges, sfOrFiles);
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
	if (source === target && !name) return;

	if (relType === 'synthetic') {
		const id = `e-${source}-${target}-synthetic`;
		if (edges.some(e => e.id === id)) return;
		const edgeColor = 'var(--color-secondary)';
		edges.push({
			id,
			source,
			target,
			sourceHandle,
			targetHandle,
			animated: true,
			label: name || 'topology',
			labelStyle: 'font-size: 10px; color: var(--color-base-content); font-weight: bold;',
			style: `stroke: ${edgeColor}; stroke-width: 1.75; stroke-dasharray: 4 4; opacity: 0.85;`,
			type: 'relation',
			data: { 
				isVirtual: true, 
				isPhysical: false,
				cardinality: 'unknown', 
				edgeType: 'synthetic', 
				isSynthetic: true,
				sourceCol: name || (sourceHandle !== 'source' ? sourceHandle : undefined),
				description: `Cloudflare Service Topology Link: ${source} → ${target}`
			},
			markerEnd: {
				type: MarkerType.ArrowClosed,
				width: 15,
				height: 15,
				color: edgeColor,
			}
		});
		return;
	}

	if (relType === 'fk') {
		addPhysicalFkEdge(edges, source, target, name || (sourceHandle !== 'source' ? sourceHandle : undefined), targetHandle !== 'target' ? targetHandle : undefined);
		return;
	}

	unifyOrAddDrizzleRelation(
		edges,
		source,
		target,
		relType || 'many',
		name || 'rel',
		sourceHandle !== 'source' ? sourceHandle : undefined,
		targetHandle !== 'target' ? targetHandle : undefined
	);
}
