import { type Node, type Edge } from '@xyflow/svelte';

class SchemaState {
	nodes = $state.raw([] as Node[]);
	edges = $state.raw([] as Edge[]);
	filePath = $state(
		typeof window !== 'undefined' 
			? localStorage.getItem('strata-last-file') 
			: null
	);
	rawCode = $state('');
	isSaving = $state(false);
	isValid = $state(true);
	error = $state<string | null>(null);

	constructor() {
		$effect.root(() => {
			$effect(() => {
				if (typeof window !== 'undefined') {
					if (this.filePath) {
						localStorage.setItem('strata-last-file', this.filePath);
					} else {
						localStorage.removeItem('strata-last-file');
					}
				}
			});
		});
	}
}

export const schemaState = new SchemaState();
