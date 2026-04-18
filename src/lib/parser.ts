import { Project, VariableDeclaration, SyntaxKind } from 'ts-morph';
import { type Node, type Edge } from '@xyflow/svelte';

const project = new Project({ useInMemoryFileSystem: true });

export function parseSchema(code: string) {
	const sourceFile = project.createSourceFile('temp-schema.ts', code, { overwrite: true });
	
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	
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
				let strataData = { x: Math.random() * 400, y: Math.random() * 400 };
				
				for (const doc of jsDocs) {
					const comment = doc.getCommentText() || '';
					const match = comment.match(/@strata\s+({.*})/);
					if (match) {
						try {
							strataData = JSON.parse(match[1]);
						} catch (e) {
							console.warn('Failed to parse @strata JSON for', tableName, e);
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
	
	return { nodes, edges };
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
	// 1. Inline references: .references(() => users.id)
	const text = decl.getText();
	const refs = text.matchAll(/\.references\(\(\) => (.*?)\.(.*?)\)/g);
	for (const match of refs) {
		const targetTable = match[1];
		addEdgeIfUnique(edges, tableName, targetTable);
	}

	// 2. Relations block: export const usersRelations = relations(users, ...
	const relationStatements = sourceFile.getVariableStatements();
	for (const statement of relationStatements) {
		for (const d of statement.getDeclarations()) {
			const initText = d.getInitializer()?.getText() || '';
			if (initText.startsWith('relations(') && initText.includes(tableName)) {
				// Naive match for target tables in the relations block
				const targetMatches = initText.matchAll(/(many|one)\((.*?)\)/g);
				for (const m of targetMatches) {
					const targetTable = m[2].trim();
					addEdgeIfUnique(edges, tableName, targetTable);
				}
			}
		}
	}
}

function addEdgeIfUnique(edges: Edge[], source: string, target: string) {
	const id = `${source}-${target}`;
	if (!edges.find(e => e.id === id)) {
		edges.push({
			id,
			source,
			target,
			animated: true,
			style: 'stroke: oklch(var(--p)); stroke-width: 2;',
			type: 'smoothstep'
		});
	}
}
