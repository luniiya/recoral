<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { tagsStore } from '$lib/tags.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	$effect(() => {
		if (!auth.loading && !auth.user) goto('/login');
	});

	onMount(() => {
		tagsStore.load();
		recordingsStore.load();
	});
</script>

{#if auth.user}
	{@render children()}
{/if}
