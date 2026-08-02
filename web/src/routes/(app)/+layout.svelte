<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { bootLog } from '$lib/bootLog';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	$effect(() => {
		if (!auth.loading && !auth.user) {
			bootLog('(app) layout: no user after auth settled, redirecting to /login');
			goto('/login');
		}
	});

	onMount(() => {
		bootLog('(app) layout: onMount fired, loading tags + recordings');
		const tagsStart = Date.now();
		tagsStore.load().then(() => bootLog(`(app) layout: tagsStore.load() done (${Date.now() - tagsStart}ms)`));
		const recordingsStart = Date.now();
		recordingsStore
			.load()
			.then(() => bootLog(`(app) layout: recordingsStore.load() done (${Date.now() - recordingsStart}ms)`));
	});
</script>

{#if auth.user}
	{@render children()}
{/if}
