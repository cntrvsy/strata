<script lang="ts">
	import './layout.css';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';

	const { children } = $props();

	onMount(() => {
		// Prevent context menu (right-click) in production builds
		if (import.meta.env.PROD) {
			document.addEventListener('contextmenu', (e) => e.preventDefault());
		}

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
	<Toaster theme="dark" richColors />
	<Titlebar />
	<Navbar />
	<main class="flex-1 min-h-0 w-full relative overflow-hidden">
		{@render children()}
	</main>
</div>
