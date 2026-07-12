<script lang="ts">
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';

	function formatDuration(totalSeconds: number) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function formatTimestamp(iso: string) {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>recoral - Favourites</title>
</svelte:head>

<div class="mx-auto h-full max-w-xl overflow-y-auto px-6 py-10">
	<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Favourites</h1>

	<ul class="flex flex-col gap-3">
		{#each recordingsStore.favorites as recording (recording.id)}
			<li class="card p-4">
				<div class="mb-1 flex items-baseline justify-between gap-3">
					<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
						{recording.title || formatTimestamp(recording.createdAt)}
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
								d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
							/>
						</svg>
					</button>
				</div>
				<AudioPlayer src={recordingsStore.audioUrl(recording.id)} />
			</li>
		{:else}
			<li class="card border-dashed p-8 text-center text-sm text-gray-400">No favourites yet</li>
		{/each}
	</ul>
</div>
