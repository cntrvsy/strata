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
let sharedProject: Project | null = null;

function getSharedProject(): Project {
	if (!sharedProject) {
		sharedProject = new Project({
			useInMemoryFileSystem: true,
			skipLoadingLibFiles: true
		});
	}
	return sharedProject;
}

/**
 * Creates or updates a lightweight SourceFile in a cached ts-morph Project context.
 * Reuses the existing Project instance to eliminate compiler initialization overhead.
 */
export function createIsolatedProject(filename: string, code: string): { project: Project; sourceFile: SourceFile } {
	const project = getSharedProject();
	const existing = project.getSourceFile(filename);
	if (existing) {
		project.removeSourceFile(existing);
	}
	const sourceFile = project.createSourceFile(filename, code, { overwrite: true });
	return { project, sourceFile };
}

