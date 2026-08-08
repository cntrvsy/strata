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
	
	// Clean up stale or temporary files left behind to prevent memory bloat and AST engine soft-locks
	for (const sf of project.getSourceFiles()) {
		const filePath = sf.getFilePath();
		if (filePath.includes('temp_') || filePath.includes('dummy.ts') || filePath.endsWith(filename)) {
			try {
				project.removeSourceFile(sf);
			} catch (e) {}
		}
	}

	const sourceFile = project.createSourceFile(filename, code, { overwrite: true });
	return { project, sourceFile };
}

