<script lang="ts">
	import './layout.css';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';

	import { PlatformService } from '$lib/services/platform';

	const { children } = $props();

	onMount(() => {
		// Prevent context menu (right-click) in production builds except on editable text fields
		document.addEventListener('contextmenu', (e) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.isContentEditable ||
					Boolean(target.closest('input, textarea, [contenteditable="true"]')))
			) {
				return; // Allow native context menu on input fields for Copy/Paste/Cut
			}
			if (import.meta.env.PROD) {
				e.preventDefault();
			}
		});

		// Explicit Ctrl+C / Ctrl+V fallback handler for input fields
		document.addEventListener('keydown', async (e) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
			if (
				!activeEl ||
				(activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA')
			) {
				return;
			}

			const key = e.key.toLowerCase();
			if (key === 'v' && !activeEl.readOnly && !activeEl.disabled) {
				try {
					const text = await navigator.clipboard.readText();
					if (text) {
						const start = activeEl.selectionStart ?? activeEl.value.length;
						const end = activeEl.selectionEnd ?? activeEl.value.length;
						const val = activeEl.value;
						activeEl.value = val.substring(0, start) + text + val.substring(end);
						activeEl.selectionStart = activeEl.selectionEnd = start + text.length;
						activeEl.dispatchEvent(new Event('input', { bubbles: true }));
						activeEl.dispatchEvent(new Event('change', { bubbles: true }));
					}
				} catch (err) {
					// Fallback to browser native paste
				}
			} else if (key === 'c') {
				const selection = activeEl.value.substring(
					activeEl.selectionStart ?? 0,
					activeEl.selectionEnd ?? 0
				);
				if (selection) {
					try {
						await navigator.clipboard.writeText(selection);
					} catch (err) {
						// Fallback to browser native copy
					}
				}
			}
		});

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
	});
</script>

<div class="h-screen w-screen bg-base-100 text-base-content font-sans overflow-hidden flex flex-col">
	<Toaster
		theme="dark"
		position="bottom-right"
		toastOptions={{
			classes: {
				toast: 'bg-base-200 border border-base-300 shadow-2xl rounded-2xl p-4 font-sans text-xs text-base-content',
				title: 'font-bold text-xs text-base-content leading-tight mb-0.5',
				description: 'text-[11px] text-base-content/90 leading-relaxed font-sans',
				actionButton: 'btn btn-primary btn-xs rounded-xl font-semibold text-[10px]',
				cancelButton: 'btn btn-ghost btn-xs rounded-xl font-semibold text-[10px]',
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

