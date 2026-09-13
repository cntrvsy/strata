import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSchema } from '../../src/lib/parser/core';
import { detectPackageWrapper, findCorrectedRelativePath } from '../../src/lib/parser/helpers';
import { updateTableMetadataInSchema } from '../../src/lib/parser/mutators';
import { schemaState } from '../../src/lib/state';

describe('Monorepo Diagnostics & Actionable Quick-Fixes', () => {
  beforeEach(() => {
    schemaState.reset();
  });

  describe('detectPackageWrapper', () => {
    it('should identify a package export wrapper and detect schema barrel candidate', () => {
      const wrapperCode = `
        export * as schema from './schema/index';
        export * from './schema/index';
        export * from './client';
      `;

      const info = detectPackageWrapper(wrapperCode, '/repo/packages/db/src/index.ts');
      expect(info).not.toBeNull();
      expect(info?.reExports).toContain('./schema/index');
      expect(info?.candidateSchemaPath).toBe('/repo/packages/db/src/schema/index.ts');
      expect(info?.candidateSchemaLabel).toBe('schema/index');
      expect(info?.drizzleConfigPath).toBe('/repo/packages/db/drizzle.config.ts');
    });

    it('should return null if the file defines direct Drizzle tables', () => {
      const tableCode = `
        import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
        export const users = sqliteTable('users', { id: text('id') });
      `;

      const info = detectPackageWrapper(tableCode, '/repo/packages/db/src/schema/users.ts');
      expect(info).toBeNull();
    });

    it('should return null for files without any re-exports', () => {
      const helperCode = `
        export function helper() { return 42; }
      `;

      const info = detectPackageWrapper(helperCode, '/repo/packages/db/src/utils.ts');
      expect(info).toBeNull();
    });
  });

  describe('findCorrectedRelativePath', () => {
    it('should find the actual file from monorepo root and compute exact relative path', () => {
      const baseFile = '/repo/packages/db/src/schema/index.ts';
      const badRel = '../../apps/api/src/durable-objects/TelemetrySessionDO.ts';

      const mockExists = (p: string) => {
        return p === '/repo/apps/api/src/durable-objects/TelemetrySessionDO.ts';
      };

      const corrected = findCorrectedRelativePath(baseFile, badRel, mockExists);
      expect(corrected).toBe('../../../../apps/api/src/durable-objects/TelemetrySessionDO.ts');
    });

    it('should return null if the target file cannot be found anywhere in the tree', () => {
      const baseFile = '/repo/packages/db/src/schema/index.ts';
      const badRel = '../../apps/api/src/durable-objects/NonExistent.ts';

      const corrected = findCorrectedRelativePath(baseFile, badRel, () => false);
      expect(corrected).toBeNull();
    });
  });

  describe('parseSchema Diagnostics', () => {
    it('should attach packageWrapperInfo and descriptive error when opening a wrapper', () => {
      const wrapperCode = `
        export * as schema from './schema/index';
        export * from './schema/index';
      `;

      const result = parseSchema(wrapperCode, undefined, undefined, undefined, '/repo/packages/db/src/index.ts');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Package wrapper detected');
      expect(result.packageWrapperInfo).toBeDefined();
      expect(result.packageWrapperInfo?.candidateSchemaPath).toBe('/repo/packages/db/src/schema/index.ts');
    });

    it('should emit MISCALCULATED_PATH_DEPTH audit issue when a path correction is available', () => {
      const schemaCode = `
        /**
         * @strata {
         *   "target": "do",
         *   "path": "../../apps/api/src/durable-objects/TelemetrySessionDO.ts",
         *   "class": "TelemetrySessionDO"
         * }
         */
        export const TELEMETRY_BUFFER = {};
      `;

      const externalMap = new Map<string, string>();
      // Content loaded via fallback
      externalMap.set('../../apps/api/src/durable-objects/TelemetrySessionDO.ts', 'export class TelemetrySessionDO { fetch() {} }');
      // Correction recorded
      externalMap.set('__correction__../../apps/api/src/durable-objects/TelemetrySessionDO.ts', '../../../../apps/api/src/durable-objects/TelemetrySessionDO.ts');

      const result = parseSchema(schemaCode, externalMap, undefined, undefined, '/repo/packages/db/src/schema/index.ts');
      expect(result.success).toBe(true);

      const pathIssue = result.auditIssues?.find(i => i.code === 'MISCALCULATED_PATH_DEPTH');
      expect(pathIssue).toBeDefined();
      expect(pathIssue?.suggestedFix?.action).toBe('fix_path');
      expect(pathIssue?.suggestedFix?.payload?.correctedPath).toBe('../../../../apps/api/src/durable-objects/TelemetrySessionDO.ts');
    });

    it('should emit MISSING_EXTERNAL_FILE when an external file is completely missing without crashing sync', () => {
      const schemaCode = `
        /**
         * @strata {
         *   "target": "do",
         *   "path": "./MissingDO.ts",
         *   "methods": ["fetch"]
         * }
         */
        export const TELEMETRY_BUFFER = {};
      `;

      const externalMap = new Map<string, string>();
      const result = parseSchema(schemaCode, externalMap, undefined, undefined, '/repo/packages/db/src/schema/index.ts');
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);

      const missingIssue = result.auditIssues?.find(i => i.code === 'MISSING_EXTERNAL_FILE');
      expect(missingIssue).toBeDefined();
    });
  });

  describe('updateTableMetadataInSchema path mutation', () => {
    it('should rewrite the @strata path attribute directly in code', () => {
      const initialCode = `
/**
 * @strata {
 *   "target": "do",
 *   "path": "../../apps/api/src/durable-objects/TelemetrySessionDO.ts",
 *   "class": "TelemetrySessionDO"
 * }
 */
export const TELEMETRY_BUFFER = {};
`;

      const updated = updateTableMetadataInSchema(initialCode, 'TELEMETRY_BUFFER', {
        path: '../../../../apps/api/src/durable-objects/TelemetrySessionDO.ts'
      });

      expect(updated).toContain('"path":"../../../../apps/api/src/durable-objects/TelemetrySessionDO.ts"');
      expect(updated).not.toContain('"path": "../../apps/api/src/durable-objects/TelemetrySessionDO.ts"');
    });
  });
});
