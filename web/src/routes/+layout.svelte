<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import { onboarding } from '$lib/onboarding.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { themeStore } from '$lib/theme.svelte';
	import { wavySeekStore } from '$lib/wavySeek.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Mobile only: before anything else loads, make sure a server is picked
	// (or "go offline" was chosen) at least once. Desktop webUI always talks
	// to its own origin, so there's nothing to pick, this never fires there.
	$effect(() => {
		if (!isNativePlatform()) return;
		if (onboarding.mode === null && page.url.pathname !== '/setup') {
			goto('/setup');
		} else if (onboarding.mode === 'offline' && page.url.pathname !== '/setup/offline') {
			goto('/setup/offline');
		}
	});

	// There's no server to ask yet until onboarding picks one (mobile only,
	// always true immediately on desktop), so don't fire this too early, it'd
	// just hit a URL that doesn't exist and throw parsing the response.
	$effect(() => {
		if (isNativePlatform() && onboarding.mode === null) {
			auth.skipRefresh();
			return;
		}
		auth.refresh();
	});

	onMount(() => {
		themeStore.init();
		wavySeekStore.init();

		if (!isNativePlatform() && 'serviceWorker' in navigator) {
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
