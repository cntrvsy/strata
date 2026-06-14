<script lang="ts">
	import './layout.css';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { onMount } from 'svelte';

	const { children } = $props();

	onMount(() => {
		import('@tauri-apps/api/core')
			.then(({ invoke }) => {
				invoke('close_splashscreen').catch((err) => {
					console.warn('[Strata] Splashscreen close failed:', err);
				});
			})
			.catch((err) => {
				console.warn('[Strata] Tauri APIs not found (running in browser/test):', err);
			});
	});
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans overflow-hidden flex flex-col">
	<Titlebar />
	<Navbar />
	<main class="grow w-full relative">
		{@render children()}
	</main>
</div>
