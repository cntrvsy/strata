import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from '#lib/state';

// Mock localStorage globally
const mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { for (const k in mockStorage) delete mockStorage[k]; }),
    length: 0,
    key: vi.fn(() => null),
  },
  writable: true,
  configurable: true,
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Sandbox Playground Mode CRUD Operations', () => {
  beforeEach(async () => {
    schemaState.reset();
    vi.resetAllMocks();
    await schemaState.loadSandboxDemo('fullstack');
  });

  it('1. should create new D1, KV, DO, and R2 entities in sandbox mode', async () => {
    const initialCount = schemaState.nodes.length;

    await schemaState.addTable('audit_logs', 'd1');
    const d1Node = schemaState.nodes.find(n => n.id === 'audit_logs');
    expect(d1Node).toBeDefined();
    expect(d1Node?.type).toBe('table');
    expect(d1Node?.data.target).toBe('d1');
    expect(schemaState.nodes.length).toBe(initialCount + 1);

    await schemaState.addTable('rate_limiter', 'kv');
    const kvNode = schemaState.nodes.find(n => n.id === 'rate_limiter');
    expect(kvNode).toBeDefined();
    expect(kvNode?.type).toBe('kv');
    expect(kvNode?.data.target).toBe('kv');

    await schemaState.addTable('chat_room', 'do', { class: 'ChatRoomDO', path: './src/do/ChatRoom.ts' });
    const doNode = schemaState.nodes.find(n => n.id === 'chat_room');
    expect(doNode).toBeDefined();
    expect(doNode?.type).toBe('do');
    expect(doNode?.data.target).toBe('do');

    await schemaState.addTable('media_bucket', 'r2');
    const r2Node = schemaState.nodes.find(n => n.id === 'media_bucket');
    expect(r2Node).toBeDefined();
    expect(r2Node?.type).toBe('r2');
    expect(r2Node?.data.target).toBe('r2');
  });

  it('2. should rename an existing table in sandbox mode', async () => {
    await schemaState.addTable('temp_table', 'd1');
    expect(schemaState.nodes.find(n => n.id === 'temp_table')).toBeDefined();

    await schemaState.renameTable('temp_table', 'persistent_table');
    expect(schemaState.nodes.find(n => n.id === 'temp_table')).toBeUndefined();
    expect(schemaState.nodes.find(n => n.id === 'persistent_table')).toBeDefined();
  });

  it('3. should delete an entity in sandbox mode', async () => {
    await schemaState.addTable('doomed_table', 'd1');
    expect(schemaState.nodes.find(n => n.id === 'doomed_table')).toBeDefined();

    await schemaState.deleteTable('doomed_table');
    expect(schemaState.nodes.find(n => n.id === 'doomed_table')).toBeUndefined();
  });

  it('4. should add columns to D1 tables in sandbox mode', async () => {
    await schemaState.addTable('orders', 'd1');
    await schemaState.addColumn('orders', 'total_amount', 'integer');
    await schemaState.addColumn('orders', 'status', 'text');

    const ordersNode = schemaState.nodes.find(n => n.id === 'orders');
    expect(ordersNode).toBeDefined();
    const cols = ordersNode?.data.columns || [];
    expect(cols.some(c => c.name === 'total_amount')).toBe(true);
    expect(cols.some(c => c.name === 'status')).toBe(true);
  });

  it('5. should rename columns in sandbox mode', async () => {
    await schemaState.addTable('products', 'd1');
    await schemaState.addColumn('products', 'cost', 'integer');

    await schemaState.renameColumn('products', 'cost', 'price');
    const node = schemaState.nodes.find(n => n.id === 'products');
    const cols = node?.data.columns || [];
    expect(cols.some(c => c.name === 'cost')).toBe(false);
    expect(cols.some(c => c.name === 'price')).toBe(true);
  });

  it('6. should update column modifiers (PK, NotNull, Default) in sandbox mode', async () => {
    await schemaState.addTable('tokens', 'd1');
    await schemaState.addColumn('tokens', 'token_str', 'text');

    await schemaState.updateColumnModifiers('tokens', 'token_str', {
      notNull: true,
      defaultVal: '"active"'
    });

    const node = schemaState.nodes.find(n => n.id === 'tokens');
    const col = node?.data.columns?.find(c => c.name === 'token_str');
    expect(col).toBeDefined();
    expect(col?.notNull).toBe(true);
  });

  it('7. should delete a column in sandbox mode', async () => {
    await schemaState.addTable('settings', 'd1');
    await schemaState.addColumn('settings', 'obsolete_setting', 'text');

    await schemaState.deleteColumn('settings', 'obsolete_setting');

    const node = schemaState.nodes.find(n => n.id === 'settings');
    const cols = node?.data.columns || [];
    expect(cols.some(c => c.name === 'obsolete_setting')).toBe(false);
  });

  it('8. should add relations in sandbox mode', async () => {
    await schemaState.addTable('authors', 'd1');
    await schemaState.addTable('books', 'd1');

    await schemaState.addRelation('books', 'authors');

    const edge = schemaState.edges.find(e => e.source === 'books' && e.target === 'authors');
    expect(edge).toBeDefined();
  });

  it('9. should delete relations in sandbox mode', async () => {
    await schemaState.addTable('users_a', 'd1');
    await schemaState.addTable('posts_a', 'd1');
    await schemaState.addRelation('posts_a', 'users_a');

    expect(schemaState.edges.some(e => e.source === 'posts_a' && e.target === 'users_a')).toBe(true);

    await schemaState.deleteRelation('posts_a', 'users_a');

    expect(schemaState.edges.some(e => e.source === 'posts_a' && e.target === 'users_a')).toBe(false);
  });

  it('10. should update DO and R2 table metadata in sandbox mode', async () => {
    await schemaState.addTable('bucket_assets', 'r2');
    await schemaState.updateTableMetadata('bucket_assets', {
      public: true,
      customDomain: 'cdn.example.com',
      cors: true
    });

    const r2Node = schemaState.nodes.find(n => n.id === 'bucket_assets');
    const strata = r2Node?.data.strata;
    expect(strata?.public).toBe(true);
    expect(strata?.customDomain).toBe('cdn.example.com');
  });

  it('11. should load all 5 production Cloudflare architecture templates cleanly', async () => {
    await schemaState.loadSandboxDemo('ai-agent-rag');
    expect(schemaState.nodes.some(n => n.id === 'AgentSessionDO')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'chatMessages')).toBe(true);

    await schemaState.loadSandboxDemo('b2b-saas');
    expect(schemaState.nodes.some(n => n.id === 'organizations')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'user')).toBe(true);
    expect(schemaState.nodes.some(n => n.data.isBetterAuth)).toBe(true);

    await schemaState.loadSandboxDemo('realtime-canvas');
    expect(schemaState.nodes.some(n => n.id === 'DocumentRoomDO')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'canvasDocuments')).toBe(true);

    await schemaState.loadSandboxDemo('ecommerce-edge');
    expect(schemaState.nodes.some(n => n.id === 'CartCheckoutLockDO')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'products')).toBe(true);

    await schemaState.loadSandboxDemo('starter-minimal');
    expect(schemaState.nodes.some(n => n.id === 'users')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'posts')).toBe(true);
    expect(schemaState.nodes.some(n => n.id === 'comments')).toBe(true);
  });

  it('12. should handle non-existent table deletion in sandbox mode gracefully', async () => {
    const initialCount = schemaState.nodes.length;
    await expect(schemaState.deleteTable('ghost_table_does_not_exist')).resolves.not.toThrow();
    expect(schemaState.nodes.length).toBe(initialCount);
  });

  it('13. should handle duplicate column addition safely in sandbox mode', async () => {
    await schemaState.addTable('users_dup_test', 'd1');
    await schemaState.addColumn('users_dup_test', 'email', 'text');
    await schemaState.addColumn('users_dup_test', 'email', 'text');

    const node = schemaState.nodes.find(n => n.id === 'users_dup_test');
    const cols = node?.data.columns || [];
    expect(cols.filter(c => c.name === 'email')).toHaveLength(1);
  });

  it('14. should add and remove Durable Object RPC methods with first-class domain mutators', async () => {
    await schemaState.loadSandboxDemo('ai-agent-rag');
    const doNode = schemaState.nodes.find(n => n.id === 'AgentSessionDO');
    expect(doNode).toBeDefined();
    expect(doNode?.type).toBe('do');

    // Add a new method with dedicated domain mutator
    await expect(schemaState.addMethod('AgentSessionDO', 'clearSessionHistory', 'Promise<void>')).resolves.not.toThrow();
    
    // Verify method presence in node.data.methods
    const updatedDoNode = schemaState.nodes.find(n => n.id === 'AgentSessionDO');
    const methods = updatedDoNode?.data.methods?.map(m => m.name) || [];
    expect(methods.some(m => m.startsWith('clearSessionHistory'))).toBe(true);

    // Delete method with dedicated domain mutator
    await expect(schemaState.deleteMethod('AgentSessionDO', 'clearSessionHistory')).resolves.not.toThrow();
    const finalDoNode = schemaState.nodes.find(n => n.id === 'AgentSessionDO');
    const remainingMethods = finalDoNode?.data.methods?.map(m => m.name) || [];
    expect(remainingMethods.some(m => m.startsWith('clearSessionHistory'))).toBe(false);
  });

  it('15. should add and remove KV key patterns with first-class domain mutators', async () => {
    await schemaState.addTable('rate_limiter_kv', 'kv');
    const kvNode = schemaState.nodes.find(n => n.id === 'rate_limiter_kv');
    expect(kvNode).toBeDefined();
    expect(kvNode?.type).toBe('kv');

    // Add pattern
    await schemaState.addPattern('rate_limiter_kv', 'user:ip:*', 'number', 60);
    const updatedKvNode = schemaState.nodes.find(n => n.id === 'rate_limiter_kv');
    const patterns = updatedKvNode?.data.patterns || [];
    expect(patterns.some(p => p.name === 'user:ip:*' && p.ttl === 60)).toBe(true);

    // Delete pattern
    await schemaState.deletePattern('rate_limiter_kv', 'user:ip:*');
    const finalKvNode = schemaState.nodes.find(n => n.id === 'rate_limiter_kv');
    const remainingPatterns = finalKvNode?.data.patterns || [];
    expect(remainingPatterns.some(p => p.name === 'user:ip:*')).toBe(false);
  });

  it('16. should add and remove R2 folder prefixes with first-class domain mutators', async () => {
    await schemaState.addTable('storage_vault', 'r2');
    const r2Node = schemaState.nodes.find(n => n.id === 'storage_vault');
    expect(r2Node).toBeDefined();
    expect(r2Node?.type).toBe('r2');

    // Add folder prefix
    await schemaState.addFolder('storage_vault', 'documents', 'application/pdf');
    const updatedR2Node = schemaState.nodes.find(n => n.id === 'storage_vault');
    const folders = updatedR2Node?.data.folders || [];
    expect(folders.some(f => f.name === 'documents/')).toBe(true);

    // Delete folder prefix
    await schemaState.deleteFolder('storage_vault', 'documents');
    const finalR2Node = schemaState.nodes.find(n => n.id === 'storage_vault');
    const remainingFolders = finalR2Node?.data.folders || [];
    expect(remainingFolders.some(f => f.name === 'documents/')).toBe(false);
  });
});
