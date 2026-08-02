import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemaState } from '$lib/state';

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
    expect(schemaState.nodes.find(n => n.id === 'audit_logs')).toBeDefined();
    expect(schemaState.nodes.length).toBe(initialCount + 1);

    await schemaState.addTable('rate_limiter', 'kv');
    expect(schemaState.nodes.find(n => n.id === 'rate_limiter')).toBeDefined();

    await schemaState.addTable('chat_room', 'do', { class: 'ChatRoomDO', path: './src/do/ChatRoom.ts' });
    const doNode = schemaState.nodes.find(n => n.id === 'chat_room');
    expect(doNode).toBeDefined();
    expect((doNode?.data as any).target).toBe('do');

    await schemaState.addTable('media_bucket', 'r2');
    const r2Node = schemaState.nodes.find(n => n.id === 'media_bucket');
    expect(r2Node).toBeDefined();
    expect((r2Node?.data as any).target).toBe('r2');
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
    const cols = (ordersNode?.data as any).columns;
    expect(cols.some((c: any) => c.name === 'total_amount')).toBe(true);
    expect(cols.some((c: any) => c.name === 'status')).toBe(true);
  });

  it('5. should rename columns in sandbox mode', async () => {
    await schemaState.addTable('products', 'd1');
    await schemaState.addColumn('products', 'cost', 'integer');

    await schemaState.renameColumn('products', 'cost', 'price');
    const node = schemaState.nodes.find(n => n.id === 'products');
    const cols = (node?.data as any).columns;
    expect(cols.some((c: any) => c.name === 'cost')).toBe(false);
    expect(cols.some((c: any) => c.name === 'price')).toBe(true);
  });

  it('6. should update column modifiers (PK, NotNull, Default) in sandbox mode', async () => {
    await schemaState.addTable('tokens', 'd1');
    await schemaState.addColumn('tokens', 'token_str', 'text');

    await schemaState.updateColumnModifiers('tokens', 'token_str', {
      notNull: true,
      defaultVal: '"active"'
    });

    const node = schemaState.nodes.find(n => n.id === 'tokens');
    const col = (node?.data as any).columns.find((c: any) => c.name === 'token_str');
    expect(col).toBeDefined();
    expect(col.notNull).toBe(true);
  });

  it('7. should delete a column in sandbox mode', async () => {
    await schemaState.addTable('settings', 'd1');
    await schemaState.addColumn('settings', 'obsolete_setting', 'text');

    await schemaState.deleteColumn('settings', 'obsolete_setting');

    const node = schemaState.nodes.find(n => n.id === 'settings');
    const cols = (node?.data as any).columns;
    expect(cols.some((c: any) => c.name === 'obsolete_setting')).toBe(false);
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
    const strata = (r2Node?.data as any).strata;
    expect(strata.public).toBe(true);
    expect(strata.customDomain).toBe('cdn.example.com');
  });

  it('11. should load all 4 EduStrata progressive learning templates cleanly', async () => {
    await schemaState.loadSandboxDemo('basic');
    expect(schemaState.nodes.some(n => n.id === 'classrooms')).toBe(true);

    await schemaState.loadSandboxDemo('academics');
    expect(schemaState.nodes.some(n => n.id === 'teachers')).toBe(true);

    await schemaState.loadSandboxDemo('infrastructure');
    expect(schemaState.nodes.some(n => n.id === 'BELL_SCHEDULE_KV')).toBe(true);

    await schemaState.loadSandboxDemo('fullstack');
    expect(schemaState.nodes.some(n => n.id === 'ClassroomSmartBoardDO')).toBe(true);
  });
});
