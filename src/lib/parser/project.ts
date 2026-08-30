/**
 * project.ts
 *
 * Summary: Helper to instantiate and expose isolated in-memory ts-morph Project contexts.
 * Expects: Raw typescript code strings.
 * Output: Isolated Project and SourceFile context.
 */
import { Project, SourceFile } from 'ts-morph';

/**
 * Creates a fresh, lightweight, fully isolated in-memory ts-morph Project and SourceFile.
 * skipLoadingLibFiles: true and useInMemoryFileSystem: true ensure instant instantiation (<2ms)
 * while providing complete isolation across asynchronous parser calls to prevent forgotten node collisions.
 */
export function createIsolatedProject(filename: string, code: string): { project: Project; sourceFile: SourceFile } {
	const project = new Project({
		useInMemoryFileSystem: true,
		skipLoadingLibFiles: true
	});
	const sourceFile = project.createSourceFile(filename, code, { overwrite: true });
	return { project, sourceFile };
}

/**
 * Executes an operation on a SourceFile within an isolated project context.
 */
export function withSourceFile<T>(
	filename: string, 
	code: string, 
	fn: (sourceFile: SourceFile, project: Project) => T
): T {
	const { project, sourceFile } = createIsolatedProject(filename, code);
	return fn(sourceFile, project);
}
