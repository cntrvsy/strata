/**
 * projectBootstrap.ts
 *
 * Summary: Scaffolding and project bootstrap generator. Converts in-memory visual
 * canvas architectures into complete, runnable Cloudflare + Drizzle repositories.
 */

import type { Node } from '@xyflow/svelte';
import { PlatformService } from './platform';

/**
 * Sanitizes a user-provided project name to a valid npm package and directory name.
 */
export function sanitizeProjectName(name: string): string {
	const sanitized = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-_]/g, '-')
		.replace(/^-+|-+$/g, '');
	return sanitized || 'strata-app';
}

/**
 * Sanitizes a string into a valid Cloudflare binding identifier (uppercase alphanumeric/underscores).
 */
export function sanitizeBinding(name: string): string {
	const cleaned = name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
	return cleaned || 'BINDING';
}

/**
 * Sanitizes a string into a valid Cloudflare R2 bucket name (lowercase alphanumeric and hyphens).
 */
export function sanitizeBucketName(name: string): string {
	const cleaned = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/^-+|-+$/g, '');
	return cleaned || 'app-bucket';
}

/**
 * Generates a clean wrangler.jsonc configuration matching all entities currently on canvas.
 */
export function generateWranglerConfig(nodes: Node[], projectName: string): string {
	const safeName = sanitizeProjectName(projectName);
	
	const hasD1Tables = nodes.some(n => {
		const target = (n.data as any)?.target;
		return !target || target === 'd1';
	});

	const kvNodes = nodes.filter(n => (n.data as any)?.target === 'kv');
	const doNodes = nodes.filter(n => (n.data as any)?.target === 'do');
	const r2Nodes = nodes.filter(n => (n.data as any)?.target === 'r2');

	const config: Record<string, any> = {
		$schema: 'node_modules/wrangler/config-schema.json',
		name: safeName,
		main: 'src/index.ts',
		compatibility_date: '2024-09-23',
		compatibility_flags: ['nodejs_compat']
	};

	// 1. D1 Database
	if (hasD1Tables) {
		config.d1_databases = [
			{
				binding: 'DB',
				database_name: `${safeName}-db`,
				database_id: 'local-d1-db',
				migrations_dir: 'drizzle/migrations'
			}
		];
	}

	// 2. KV Namespaces
	if (kvNodes.length > 0) {
		config.kv_namespaces = kvNodes.map(n => {
			const strata = (n.data as any)?.strata || {};
			const binding = sanitizeBinding(strata.binding || n.id);
			return {
				binding,
				id: `${binding.toLowerCase()}_id`
			};
		});
	}

	// 3. Durable Objects
	if (doNodes.length > 0) {
		const doBindings = doNodes.map(n => {
			const strata = (n.data as any)?.strata || {};
			const binding = sanitizeBinding(strata.binding || n.id);
			const className = strata.class ? sanitizeBinding(strata.class) : binding;
			return {
				name: binding,
				class_name: className
			};
		});

		config.durable_objects = {
			bindings: doBindings
		};

		// In Cloudflare Workers, Durable Objects require an explicit migrations block
		config.migrations = [
			{
				tag: 'v1',
				new_classes: doBindings.map(b => b.class_name)
			}
		];
	}

	// 4. R2 Buckets
	if (r2Nodes.length > 0) {
		config.r2_buckets = r2Nodes.map(n => {
			const strata = (n.data as any)?.strata || {};
			const binding = sanitizeBinding(strata.binding || n.id);
			const bucketName = sanitizeBucketName(strata.binding || n.id);
			return {
				binding,
				bucket_name: bucketName
			};
		});
	}

	// 5. Modern Observability
	config.observability = {
		enabled: true
	};

	return JSON.stringify(config, null, 2) + '\n';
}

/**
 * Generates a standard Cloudflare D1 Drizzle kit configuration file.
 */
export function generateDrizzleConfig(projectName: string, schemaRelativePath: string = './src/schema.ts'): string {
	return `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "${schemaRelativePath}",
  out: "./drizzle/migrations",
  dbCredentials: {
    // For local development, Drizzle Kit outputs standard SQL migrations to ./drizzle/migrations.
    // Apply them locally via: npm run db:migrate:local (wrangler d1 migrations apply)
    // To inspect remote D1 using Drizzle Studio:
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    databaseId: process.env.CLOUDFLARE_DATABASE_ID || "",
    token: process.env.CLOUDFLARE_D1_TOKEN || "",
  },
});
`;
}

/**
 * Generates a package.json tailored for Drizzle + Cloudflare Workers with D1, KV, DO, R2.
 * Dynamically detects ecosystem libraries (Better Auth, Stripe, Clerk/WorkOS, AI) from canvas and schema.
 */
export function generatePackageJson(
	projectName: string,
	nodes: Node[] = [],
	rawCode: string = ''
): string {
	const safeName = sanitizeProjectName(projectName);

	const hasD1Tables = nodes.some(n => {
		const target = (n.data as any)?.target;
		return n.type !== 'identity' && (!target || target === 'd1');
	}) || rawCode.includes('sqliteTable');

	const d1Binding = 'DB';

	const scripts: Record<string, string> = {
		dev: 'wrangler dev',
		deploy: 'wrangler deploy',
		typecheck: 'tsc --noEmit'
	};

	if (hasD1Tables) {
		scripts['db:generate'] = 'drizzle-kit generate';
		scripts['db:migrate:local'] = `wrangler d1 migrations apply ${d1Binding} --local`;
		scripts['db:migrate:remote'] = `wrangler d1 migrations apply ${d1Binding} --remote`;
	}

	const dependencies: Record<string, string> = {
		'drizzle-orm': '^0.38.4'
	};

	const devDependencies: Record<string, string> = {
		'@cloudflare/workers-types': '^4.20240923.0',
		'drizzle-kit': '^0.30.2',
		typescript: '^5.5.0',
		wrangler: '^3.80.0'
	};

	// 1. Detect Better Auth:
	const tableNames = new Set(
		nodes
			.filter(n => n.type !== 'identity' && (!(n.data as any)?.target || (n.data as any)?.target === 'd1'))
			.map(n => n.id.toLowerCase())
	);
	// Also extract table names declared in rawCode (sqliteTable("name" or sqliteTable('name')
	const tableMatches = rawCode.matchAll(/sqliteTable\s*\(\s*["']([^"']+)["']/g);
	for (const match of tableMatches) {
		tableNames.add(match[1].toLowerCase());
	}

	const hasBetterAuth =
		(tableNames.has('user') && (tableNames.has('session') || tableNames.has('account'))) ||
		rawCode.includes('better-auth') ||
		rawCode.includes('Better Auth');
	if (hasBetterAuth) {
		dependencies['better-auth'] = '^1.1.18';
	}

	// 2. Detect Stripe:
	const hasStripe =
		rawCode.toLowerCase().includes('stripe') ||
		nodes.some(n => {
			const cols = ((n.data as any)?.columns || []) as Array<{ name: string }>;
			return cols.some(c => c.name.toLowerCase().includes('stripe'));
		});
	if (hasStripe) {
		dependencies['stripe'] = '^17.5.0';
	}

	// 3. Detect Webhook IdP Mirrors (Clerk / WorkOS):
	const hasClerkOrWorkOS =
		tableNames.has('clerkusers') ||
		tableNames.has('workosusers') ||
		rawCode.includes('clerkUsers') ||
		rawCode.includes('workosUsers') ||
		rawCode.includes('clerkUserId') ||
		rawCode.includes('workosOrgId') ||
		nodes.some(n => (n.data as any)?.target === 'identity');
	if (hasClerkOrWorkOS) {
		dependencies['svix'] = '^1.45.1';
	}

	// 4. Detect AI / Vectorize:
	const hasAI =
		rawCode.includes('@cloudflare/ai') ||
		rawCode.includes('Ai') ||
		nodes.some(n => {
			const strata = (n.data as any)?.strata || {};
			return (
				(strata.binding && strata.binding.toLowerCase().includes('ai')) ||
				n.id.toLowerCase().includes('ai') ||
				n.id.toLowerCase().includes('rag')
			);
		});
	if (hasAI) {
		dependencies['@cloudflare/ai'] = '^1.0.86';
	}

	const pkg = {
		name: safeName,
		version: '0.1.0',
		private: true,
		type: 'module',
		scripts,
		dependencies,
		devDependencies
	};

	return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Generates a modern tsconfig.json for Cloudflare Workers with ESNext modules.
 */
export function generateTsConfig(): string {
	const tsconfig = {
		compilerOptions: {
			target: 'esnext',
			module: 'esnext',
			moduleResolution: 'bundler',
			lib: ['esnext'],
			types: ['@cloudflare/workers-types'],
			strict: true,
			skipLibCheck: true,
			noEmit: true
		},
		include: ['src/**/*', 'drizzle.config.ts']
	};
	return JSON.stringify(tsconfig, null, 2) + '\n';
}

/**
 * Generates a clean .gitignore covering node_modules, wrangler cache, and secrets.
 */
export function generateGitignore(): string {
	return `node_modules/
.wrangler/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
`;
}

/**
 * Generates a starter Worker entrypoint (src/index.ts) exposing standard handlers.
 */
export function generateWorkerEntrypoint(projectName: string, nodes: Node[], rawCode: string = ''): string {
	const doNodes = nodes.filter(n => (n.data as any)?.target === 'do');
	const hasD1 = nodes.some(n => {
		const target = (n.data as any)?.target;
		return n.type !== 'identity' && (!target || target === 'd1');
	}) || rawCode.includes('sqliteTable');

	let code = `import { drizzle } from "drizzle-orm/d1";\n`;
	code += `import * as schema from "./schema";\n\n`;

	if (doNodes.length > 0) {
		for (const doNode of doNodes) {
			const strata = (doNode.data as any)?.strata || {};
			const className = strata.class || strata.binding || doNode.id;
			code += `export { ${className} } from "./do/${className}";\n`;
		}
		code += `\n`;
	}

	code += `export interface Env {\n`;
	if (hasD1) {
		code += `  DB: D1Database;\n`;
	}
	const kvNodes = nodes.filter(n => (n.data as any)?.target === 'kv');
	for (const kv of kvNodes) {
		const strata = (kv.data as any)?.strata || {};
		const b = sanitizeBinding(strata.binding || kv.id);
		code += `  ${b}: KVNamespace;\n`;
	}
	for (const doNode of doNodes) {
		const strata = (doNode.data as any)?.strata || {};
		const b = sanitizeBinding(strata.binding || doNode.id);
		code += `  ${b}: DurableObjectNamespace;\n`;
	}
	const r2Nodes = nodes.filter(n => (n.data as any)?.target === 'r2');
	for (const r2 of r2Nodes) {
		const strata = (r2.data as any)?.strata || {};
		const b = sanitizeBinding(strata.binding || r2.id);
		code += `  ${b}: R2Bucket;\n`;
	}
	code += `}\n\n`;

	code += `export default {\n`;
	code += `  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {\n`;
	if (hasD1) {
		code += `    const db = drizzle(env.DB, { schema });\n`;
	}
	code += `    return new Response(JSON.stringify({\n`;
	code += `      message: "Welcome to ${projectName}!",\n`;
	code += `      status: "online",\n`;
	code += `      entities: ${nodes.length}\n`;
	code += `    }), {\n`;
	code += `      headers: { "Content-Type": "application/json" }\n`;
	code += `    });\n`;
	code += `  }\n`;
	code += `};\n`;

	return code;
}

/**
 * Generates an empty stub class for a Durable Object.
 */
export function generateDurableObjectClass(className: string, methods: string[] = []): string {
	let code = `import { DurableObject } from "cloudflare:workers";\n\n`;
	code += `export class ${className} extends DurableObject {\n`;
	code += `  constructor(ctx: DurableObjectState, env: any) {\n`;
	code += `    super(ctx, env);\n`;
	code += `  }\n\n`;

	if (methods.length > 0) {
		for (const method of methods) {
			const cleanName = method.replace(/\(.*\)$/, '').trim();
			code += `  async ${cleanName}(): Promise<any> {\n`;
			code += `    return { status: "ok", method: "${cleanName}" };\n`;
			code += `  }\n\n`;
		}
	} else {
		code += `  async ping(): Promise<string> {\n`;
		code += `    return "pong";\n`;
		code += `  }\n`;
	}

	code += `}\n`;
	return code;
}

/**
 * Generates a comprehensive README.md.
 */
export function generateReadme(projectName: string, nodes: Node[]): string {
	const safeName = sanitizeProjectName(projectName);
	return `# ${safeName}

Architected with [Strata](https://github.com/cntrvsy/strata) — Visual ERD & Cloudflare Edge Studio.

## Architecture Entities
- **Total Entities:** ${nodes.length}
- **Database Dialect:** SQLite (Cloudflare D1)
- **ORM:** Drizzle ORM

## Getting Started

1. **Install Dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Generate Database Migrations:**
   \`\`\`bash
   npm run db:generate
   \`\`\`

3. **Start Local Edge Development:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Deploy to Cloudflare:**
   \`\`\`bash
   npm run deploy
   \`\`\`

## Visual Editing with Strata
To visually edit this architecture again, open \`src/schema.ts\` in Strata.
`;
}

/**
 * Constructs the complete bundle of files to write for a new project.
 */
export function generateBootstrapBundle(
	projectName: string,
	rawCode: string,
	nodes: Node[]
): Record<string, string> {
	const safeName = sanitizeProjectName(projectName);
	const files: Record<string, string> = {
		'package.json': generatePackageJson(safeName, nodes, rawCode),
		'wrangler.jsonc': generateWranglerConfig(nodes, safeName),
		'drizzle.config.ts': generateDrizzleConfig(safeName, './src/schema.ts'),
		'tsconfig.json': generateTsConfig(),
		'.gitignore': generateGitignore(),
		'README.md': generateReadme(safeName, nodes),
		'src/schema.ts': rawCode,
		'src/index.ts': generateWorkerEntrypoint(safeName, nodes, rawCode)
	};

	// Generate stub DO files if any DO nodes exist
	const doNodes = nodes.filter(n => (n.data as any)?.target === 'do');
	for (const doNode of doNodes) {
		const strata = (doNode.data as any)?.strata || {};
		const className = strata.class ? sanitizeBinding(strata.class) : sanitizeBinding(strata.binding || doNode.id);
		const methods = Array.isArray(strata.methods) ? strata.methods : [];
		files[`src/do/${className}.ts`] = generateDurableObjectClass(className, methods);
	}

	return files;
}

/**
 * Writes the entire project scaffold to disk in a dedicated subfolder.
 */
export async function bootstrapProjectToDisk(
	targetDirectory: string,
	projectName: string,
	rawCode: string,
	nodes: Node[]
): Promise<{ projectPath: string; schemaPath: string }> {
	const safeName = sanitizeProjectName(projectName);
	const normalizedTargetDir = targetDirectory.replace(/\\/g, '/').replace(/\/+$/, '');
	const projectPath = `${normalizedTargetDir}/${safeName}`;
	const schemaPath = `${projectPath}/src/schema.ts`;

	const bundle = generateBootstrapBundle(safeName, rawCode, nodes);

	for (const [relativePath, content] of Object.entries(bundle)) {
		const filePath = `${projectPath}/${relativePath}`;
		await PlatformService.writeText(filePath, content);
	}

	return { projectPath, schemaPath };
}
