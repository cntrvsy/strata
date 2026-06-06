<script lang="ts">
	import './layout.css';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import Navbar from '$lib/components/Navbar.svelte';

	const { children } = $props();
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans overflow-hidden flex flex-col">
	<Titlebar />
	<Navbar />
	<main class="grow w-full relative">
		{@render children()}
	</main>
</div>
