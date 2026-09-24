import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/svelte';
import {
	sanitizeProjectName,
	sanitizeBinding,
	sanitizeBucketName,
	generateWranglerConfig,
	generateDrizzleConfig,
	generatePackageJson,
	generateBootstrapBundle,
	generateWorkerEntrypoint
} from '#lib/services/projectBootstrap';
import { schemaState } from '#lib/state';

describe('Project Bootstrap Service', () => {
	describe('Sanitization Helpers', () => {
		it('should sanitize project names to clean directory and package names', () => {
			expect(sanitizeProjectName('My Awesome Project!')).toBe('my-awesome-project');
			expect(sanitizeProjectName('---Leading-Trailing---')).toBe('leading-trailing');
			expect(sanitizeProjectName('   ')).toBe('strata-app');
		});

		it('should sanitize Cloudflare binding identifiers', () => {
			expect(sanitizeBinding('my-kv-cache')).toBe('my_kv_cache');
			expect(sanitizeBinding('Agent Session DO')).toBe('Agent_Session_DO');
			expect(sanitizeBinding('')).toBe('BINDING');
		});

		it('should sanitize R2 bucket names to lowercase dashed strings', () => {
			expect(sanitizeBucketName('User_Uploads_Bucket')).toBe('user-uploads-bucket');
			expect(sanitizeBucketName('app assets 2026')).toBe('app-assets-2026');
		});
	});

	describe('Configuration Generators', () => {
		const mockNodes: Node[] = [
			{
				id: 'users',
				position: { x: 0, y: 0 },
				data: { target: 'd1', columns: [{ name: 'id', definition: 'text' }] }
			},
			{
				id: 'rateLimiter',
				position: { x: 100, y: 100 },
				data: {
					target: 'kv',
					strata: { binding: 'RATE_LIMITER_KV' }
				}
			},
			{
				id: 'ChatSessionDO',
				position: { x: 200, y: 200 },
				data: {
					target: 'do',
					strata: {
						binding: 'ChatSessionDO',
						class: 'ChatSessionDO',
						methods: ['sendMessage', 'getHistory']
					}
				}
			},
			{
				id: 'assetsBucket',
				position: { x: 300, y: 300 },
				data: {
					target: 'r2',
					strata: { binding: 'ASSETS_BUCKET' }
				}
			}
		];

		it('should generate valid wrangler.jsonc with all 4 storage targets detected', () => {
			const wranglerJsonc = generateWranglerConfig(mockNodes, 'agent-canvas');
			const parsed = JSON.parse(wranglerJsonc);

			expect(parsed.name).toBe('agent-canvas');
			expect(parsed.d1_databases).toHaveLength(1);
			expect(parsed.d1_databases[0].binding).toBe('DB');
			expect(parsed.d1_databases[0].database_name).toBe('agent-canvas-db');

			expect(parsed.kv_namespaces).toHaveLength(1);
			expect(parsed.kv_namespaces[0].binding).toBe('RATE_LIMITER_KV');

			expect(parsed.durable_objects.bindings).toHaveLength(1);
			expect(parsed.durable_objects.bindings[0].name).toBe('ChatSessionDO');
			expect(parsed.durable_objects.bindings[0].class_name).toBe('ChatSessionDO');

			expect(parsed.r2_buckets).toHaveLength(1);
			expect(parsed.r2_buckets[0].binding).toBe('ASSETS_BUCKET');
			expect(parsed.r2_buckets[0].bucket_name).toBe('assets-bucket');
		});

		it('should generate valid drizzle.config.ts pointing to the schema file', () => {
			const drizzleConfig = generateDrizzleConfig('my-app', './src/schema.ts');
			expect(drizzleConfig).toContain('dialect: "sqlite"');
			expect(drizzleConfig).toContain('schema: "./src/schema.ts"');
			expect(drizzleConfig).toContain('CLOUDFLARE_ACCOUNT_ID');
			expect(drizzleConfig).toContain('db:migrate:local');
		});

		it('should generate package.json with scripts and cloudflare dependencies', () => {
			const packageJson = generatePackageJson('cloud-app', mockNodes);
			const parsed = JSON.parse(packageJson);

			expect(parsed.name).toBe('cloud-app');
			expect(parsed.dependencies['drizzle-orm']).toBeDefined();
			expect(parsed.devDependencies['drizzle-kit']).toBeDefined();
			expect(parsed.devDependencies['wrangler']).toBeDefined();
			expect(parsed.scripts['dev']).toBe('wrangler dev');
			expect(parsed.scripts['db:generate']).toBe('drizzle-kit generate');
			expect(parsed.scripts['db:migrate:local']).toBe('wrangler d1 migrations apply DB --local');
			expect(parsed.scripts['db:migrate:remote']).toBe('wrangler d1 migrations apply DB --remote');
			expect(parsed.scripts['typecheck']).toBe('tsc --noEmit');
		});

		it('should dynamically include ecosystem dependencies based on schema and nodes', () => {
			// 1. Better Auth detection
			const authCode = 'export const user = sqliteTable("user", {});\nexport const session = sqliteTable("session", {});';
			const authPkg = JSON.parse(generatePackageJson('auth-app', [], authCode));
			expect(authPkg.dependencies['better-auth']).toBeDefined();

			// 2. Stripe detection
			const stripeCode = 'export const users = sqliteTable("users", { stripeCustomerId: text("stripe_customer_id") });';
			const stripePkg = JSON.parse(generatePackageJson('stripe-app', [], stripeCode));
			expect(stripePkg.dependencies['stripe']).toBeDefined();

			// 3. Webhook IdP (Clerk/WorkOS) detection
			const clerkCode = 'export const clerkUsers = sqliteTable("clerkUsers", { clerkUserId: text("clerk_user_id") });';
			const clerkPkg = JSON.parse(generatePackageJson('clerk-app', [], clerkCode));
			expect(clerkPkg.dependencies['svix']).toBeDefined();

			// 4. AI / Vectorize detection
			const aiCode = 'export const embeddings = sqliteTable("embeddings", {}); // @cloudflare/ai';
			const aiPkg = JSON.parse(generatePackageJson('ai-app', [], aiCode));
			expect(aiPkg.dependencies['@cloudflare/ai']).toBeDefined();
		});

		it('should generate worker entrypoint with typed Env interface for all bindings', () => {
			const workerCode = generateWorkerEntrypoint('chat-app', mockNodes);
			expect(workerCode).toContain('export { ChatSessionDO } from "./do/ChatSessionDO";');
			expect(workerCode).toContain('DB: D1Database;');
			expect(workerCode).toContain('RATE_LIMITER_KV: KVNamespace;');
			expect(workerCode).toContain('ChatSessionDO: DurableObjectNamespace;');
			expect(workerCode).toContain('ASSETS_BUCKET: R2Bucket;');
			expect(workerCode).toContain('drizzle(env.DB, { schema })');
		});

		it('should assemble a complete bootstrap bundle with stub DO classes', () => {
			const schemaCode = 'export const users = sqliteTable("users", {});';
			const bundle = generateBootstrapBundle('test-suite-app', schemaCode, mockNodes);

			expect(bundle['package.json']).toBeDefined();
			expect(bundle['wrangler.jsonc']).toBeDefined();
			const wrangler = JSON.parse(bundle['wrangler.jsonc']);
			expect(wrangler.migrations).toBeDefined();
			expect(wrangler.migrations[0].new_classes).toContain('ChatSessionDO');
			expect(wrangler.observability.enabled).toBe(true);

			expect(bundle['drizzle.config.ts']).toBeDefined();
			expect(bundle['tsconfig.json']).toBeDefined();
			expect(bundle['.gitignore']).toBeDefined();
			expect(bundle['README.md']).toBeDefined();
			expect(bundle['src/schema.ts']).toBe(schemaCode);
			expect(bundle['src/index.ts']).toBeDefined();
			expect(bundle['src/do/ChatSessionDO.ts']).toContain('export class ChatSessionDO extends DurableObject');
			expect(bundle['src/do/ChatSessionDO.ts']).toContain('async sendMessage(): Promise<any>');
		});
	});

	describe('Dynamic Project Naming', () => {
		it('should derive project name from sandbox template key', () => {
			schemaState.isSandboxMode = true;
			schemaState.sandboxTemplateKey = 'b2b-saas';
			expect(schemaState.suggestedProjectName).toBe('b2b-saas-starter');

			schemaState.sandboxTemplateKey = 'ai-agent-rag';
			expect(schemaState.suggestedProjectName).toBe('ai-agent-rag-starter');
		});

		it('should derive project name from open file path in disk mode', () => {
			schemaState.isSandboxMode = false;
			schemaState.filePath = '/home/user/projects/my-saas-platform/src/schema.ts';
			expect(schemaState.suggestedProjectName).toBe('my-saas-platform');
		});
	});
});
