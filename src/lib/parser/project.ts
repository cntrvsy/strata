/**
 * project.ts
 *
 * Summary: Helper to instantiate and expose isolated in-memory ts-morph Project contexts.
 * Expects: Raw typescript code strings.
 * Output: Isolated Project and SourceFile context.
 */
import { Project, SourceFile } from 'ts-morph';

/**
 * Creates a fresh, lightweight, isolated ts-morph Project and SourceFile context.
 * skipLoadingLibFiles is set to true to ensure fast instantiation times (< 5ms).
 */
export function createIsolatedProject(filename: string, code: string): { project: Project; sourceFile: SourceFile } {
	const project = new Project({
		useInMemoryFileSystem: true,
		skipLoadingLibFiles: true
	});
	const sourceFile = project.createSourceFile(filename, code);
	return { project, sourceFile };
}
