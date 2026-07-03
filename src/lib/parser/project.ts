/**
 * project.ts
 *
 * Summary: Instantiates and exposes the shared in-memory ts-morph Project context.
 * Expects: Raw typescript code strings.
 * Output: Synced ts-morph SourceFile object.
 */
import { Project, SourceFile } from 'ts-morph';

export const project = new Project({ useInMemoryFileSystem: true });
export const sourceFile = project.createSourceFile('schema.ts', '');

export function syncSourceFile(code: string): SourceFile {
	if (sourceFile.getFullText() !== code) {
		sourceFile.replaceWithText(code);
	}
	return sourceFile;
}
