import { Project, VariableDeclaration, SyntaxKind } from 'ts-morph';
import { type Node, type Edge } from '@xyflow/svelte';

const project = new Project({ useInMemoryFileSystem: true });

export function parseSchema(code: string) {
	const sourceFile = project.createSourceFile('temp-schema.ts', code, { overwrite: true });
	
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	
	// Find all exported sqliteTable declarations
	const variableStatements = sourceFile.getVariableStatements();
	
	for (const statement of variableStatements) {
		const declarations = statement.getDeclarations();
		for (const decl of declarations) {
			const initializer = decl.getInitializer();
			if (initializer && initializer.getText().includes('sqliteTable')) {
				const tableName = decl.getName();
				
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
				
				// Create Node
				nodes.push({
					id: tableName,
					type: 'table',
					data: { label: tableName, columns: extractColumns(decl) },
					position: { x: strataData.x, y: strataData.y }
				});
				
				// Extract relations for edges
				extractRelations(tableName, decl, edges);
			}
		}
	}
	
	return { nodes, edges };
}

function extractColumns(decl: VariableDeclaration) {
	const columns: any[] = [];
	const initializer = decl.getInitializer();
	if (!initializer) return columns;
	
	// sqliteTable("name", { ...columns })
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

function extractRelations(tableName: string, decl: VariableDeclaration, edges: Edge[]) {
	// Look for .references(() => users.id)
	const text = decl.getText();
	const refs = text.matchAll(/\.references\(\(\) => (.*?)\.(.*?)\)/g);
	for (const match of refs) {
		const targetTable = match[1];
		edges.push({
			id: `${tableName}-${targetTable}`,
			source: tableName,
			target: targetTable,
			animated: true,
			style: 'stroke: oklch(var(--p)); stroke-width: 2;'
		});
	}
}
