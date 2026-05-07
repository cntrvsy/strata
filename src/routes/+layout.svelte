<script lang="ts">
	import './layout.css';
	import Navbar from '$lib/components/Navbar.svelte';

	const { children } = $props();
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans overflow-hidden">
	<Navbar />
	<main class="h-full w-full relative pt-16">
		{@render children()}
	</main>
</div>
