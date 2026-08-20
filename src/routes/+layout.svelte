<script lang="ts">
	import './layout.css';
	import Titlebar from '$lib/components/layout/Titlebar.svelte';
	import Navbar from '$lib/components/layout/Navbar.svelte';
	import BottomBar from '$lib/components/layout/BottomBar.svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { PlatformService } from '$lib/services/platform';
	import { initDesktopEvents } from '$lib/services/desktopEvents';

	const { children } = $props();

	onMount(() => {
		const cleanupDesktop = initDesktopEvents();

		if (PlatformService.isTauri()) {
			import('@tauri-apps/api/core')
				.then(({ invoke }) => {
					invoke('close_splashscreen').catch((err) => {
						console.warn('[Strata] Splashscreen close failed:', err);
					});
				})
				.catch((err) => {
					console.warn('[Strata] Tauri APIs not found (running in browser/test):', err);
				});
		}

		return () => {
			cleanupDesktop();
		};
	});
</script>

<div class="h-dvh w-full overflow-hidden flex flex-col">
	<Toaster
		theme="dark"
		position="bottom-right"
		toastOptions={{
			classes: {
				toast: 'bg-base-200 border border-base-300 shadow-2xl rounded-box p-4 text-xs text-base-content',
				title: 'font-bold text-xs text-base-content leading-tight mb-0.5',
				description: 'text-[11px] opacity-90 leading-relaxed',
				actionButton: 'btn btn-primary btn-xs rounded-field font-semibold text-[10px]',
				cancelButton: 'btn btn-ghost btn-xs rounded-field font-semibold text-[10px]',
				error: '!border-error',
				success: '!border-success',
				info: '!border-info',
				warning: '!border-warning'
			}
		}}
	/>
	<Titlebar />
	<Navbar />
	<main class="flex-1 min-h-0 w-full relative overflow-hidden">
		{@render children()}
	</main>
	<BottomBar />
</div>


