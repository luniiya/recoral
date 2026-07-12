<script lang="ts">
	import { recordingsStore } from '$lib/recordings.svelte';

	function formatDuration(totalSeconds: number) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>recoral - Archive</title>
</svelte:head>

<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive</h1>

<ul class="flex flex-col gap-3">
	{#each recordingsStore.archived as recording (recording.id)}
		<li class="card p-4">
			<div class="mb-1 flex items-baseline justify-between gap-3">
				<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
					{recording.title}
				</span>
				<span class="shrink-0 text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
			</div>
			<audio controls src={recording.url} class="mb-3 w-full"></audio>
			<button
				class="rounded-full border border-gray-200 px-3.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
				onclick={() => recordingsStore.unarchive(recording.id)}
			>
				Unarchive
			</button>
		</li>
	{:else}
		<li class="card border-dashed p-8 text-center text-sm text-gray-400">Nothing archived yet</li>
	{/each}
</ul>
