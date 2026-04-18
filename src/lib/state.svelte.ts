import { type Node, type Edge } from '@xyflow/svelte';

class SchemaState {
	nodes = $state.raw([] as Node[]);
	edges = $state.raw([] as Edge[]);
	filePath = $state(null as string | null);
	rawCode = $state('');
}

export const schemaState = new SchemaState();
