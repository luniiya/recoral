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
	<title>recoral - Archive</title>
</svelte:head>

<div class="mx-auto h-full max-w-xl overflow-y-auto px-6 py-10">
	<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive</h1>

	<ul class="flex flex-col gap-3">
		{#each recordingsStore.archived as recording (recording.id)}
			<li class="card p-4">
				<div class="mb-1 flex items-baseline justify-between gap-3">
					<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
						{recording.title || formatTimestamp(recording.createdAt)}
					</span>
					<span class="shrink-0 text-xs tabular-nums text-gray-400">{formatDuration(recording.durationSeconds)}</span>
				</div>
				<div class="mb-3">
					<AudioPlayer src={recordingsStore.audioUrl(recording.id)} />
				</div>
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
</div>
