<script lang="ts">
	import { recordingsStore } from '$lib/recordings.svelte';

	function formatDuration(totalSeconds: number) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>recoral - Favourites</title>
</svelte:head>

<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Favourites</h1>

<ul class="flex flex-col gap-3">
	{#each recordingsStore.favorites as recording (recording.id)}
		<li class="card p-4">
			<div class="mb-1 flex items-baseline justify-between gap-3">
				<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
					{recording.title}
				</span>
				<span class="shrink-0 text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
				<button
					class="flex size-6 shrink-0 items-center justify-center rounded-full text-accent-500 transition hover:bg-gray-100 dark:hover:bg-white/5"
					aria-label="Unfavourite"
					title="Unfavourite"
					onclick={() => recordingsStore.toggleFavorite(recording.id)}
				>
					<svg viewBox="0 0 24 24" fill="currentColor" class="size-4">
						<path
							d="M12 6.3C10.4 4.6 8 4 6.2 5.5 4.4 7 4.1 9.7 5.6 11.5L12 19l6.4-7.5c1.5-1.8 1.2-4.5-.6-6C16 4 13.6 4.6 12 6.3Z"
						/>
					</svg>
				</button>
			</div>
			<audio controls src={recording.url} class="w-full"></audio>
		</li>
	{:else}
		<li class="card border-dashed p-8 text-center text-sm text-gray-400">No favourites yet</li>
	{/each}
</ul>
