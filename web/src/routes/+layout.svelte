<script lang="ts">
	import '../app.css';
	import { auth } from '$lib/auth.svelte';
	import { themeStore } from '$lib/theme.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		auth.refresh();
		themeStore.init();

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js');
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/logo.png" />
</svelte:head>

{#if auth.loading}
	<div class="flex min-h-dvh items-center justify-center text-sm text-gray-400">Loading&hellip;</div>
{:else}
	{@render children()}
{/if}
