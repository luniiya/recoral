<script lang="ts">
	import { recordingsStore } from '$lib/recordings.svelte';

	function formatDuration(totalSeconds: number) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>recoral - Bin</title>
</svelte:head>

<h1 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Bin</h1>
<p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
	Recordings here are deleted for good after 30 days.
</p>

<ul class="flex flex-col gap-3">
	{#each recordingsStore.trashed as recording (recording.id)}
		<li class="card p-4">
			<div class="mb-1 flex items-baseline justify-between gap-3">
				<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
					{recording.title}
				</span>
				<span class="shrink-0 text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
			</div>
			<p class="mb-3 text-xs text-gray-400">
				{recordingsStore.daysLeft(recording)} day{recordingsStore.daysLeft(recording) === 1 ? '' : 's'} left
			</p>
			<audio controls src={recording.url} class="mb-3 w-full"></audio>
			<div class="flex gap-2">
				<button
					class="flex-1 rounded-full bg-accent-500 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600"
					onclick={() => recordingsStore.restore(recording.id)}
				>
					Restore
				</button>
				<button
					class="flex-1 rounded-full py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40"
					onclick={() => recordingsStore.deleteForever(recording.id)}
				>
					Delete forever
				</button>
			</div>
		</li>
	{:else}
		<li class="card border-dashed p-8 text-center text-sm text-gray-400">Bin is empty</li>
	{/each}
</ul>
