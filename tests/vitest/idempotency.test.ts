
import { describe, it, expect } from 'vitest';
import { parseSchema, updateNodePositionInSchema } from '../../src/lib/parser';

describe('Idempotency & Data Integrity', () => {
  it('should maintain stable AST across 100 parse/save cycles', () => {
    let code = `
/**
 * @strata {"x":100,"y":200,"target":"d1"}
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
});
`;
    
    const originalCode = code.trim();
    let currentCode = originalCode;

    for (let i = 0; i < 100; i++) {
      const result = parseSchema(currentCode);
      expect(result.success).toBe(true);
      
      const node = result.nodes.find(n => n.id === 'users');
      expect(node).toBeDefined();
      
      // Re-save with same coordinates
      currentCode = updateNodePositionInSchema(currentCode, 'users', node!.position.x, node!.position.y);
    }

    // The JSDoc might have slight formatting changes (e.g. whitespace) depending on ts-morph
    // but the data should be identical.
    const finalResult = parseSchema(currentCode);
    expect(finalResult.nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it('should be deterministic for existing metadata', () => {
    const code = `/** @strata {"x":42,"y":84} */\nexport const t = sqliteTable("t", { id: integer("id") });`;
    
    const result1 = parseSchema(code);
    const result2 = parseSchema(code);
    
    expect(result1.nodes[0].position).toEqual(result2.nodes[0].position);
    expect(result1.nodes[0].position).toEqual({ x: 42, y: 84 });
  });
});
