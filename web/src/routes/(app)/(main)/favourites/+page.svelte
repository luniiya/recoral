<script lang="ts">
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import TagChip from '$lib/components/TagChip.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { parentTag } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';

	let selectedId = $state<string | null>(null);

	let visibleRecordings = $derived(
		recordingsStore.favorites.filter((r) => {
			const query = recordingsStore.search.trim().toLowerCase();
			const matchesQuery =
				!query || r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query);

			const filterTags = recordingsStore.selectedTagIds;
			const matchesTags = filterTags.length === 0 || filterTags.some((id) => r.tagIds.includes(id));

			return matchesQuery && matchesTags;
		})
	);

	let selectedRecording = $derived(recordingsStore.favorites.find((r) => r.id === selectedId) ?? null);

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

<div class="flex h-full">
	<div
		class="h-full overflow-y-auto transition-[width] duration-300 {selectedRecording
			? 'w-[26rem] shrink-0'
			: 'w-full'}"
	>
		<div class="mx-auto max-w-xl px-6 py-10">
			<ul class="flex flex-col gap-3">
				{#each visibleRecordings as recording (recording.id)}
					<li>
						<button
							class="card w-full p-4 text-left transition
								{selectedId === recording.id
								? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10'
								: 'hover:bg-gray-50 dark:hover:bg-white/5'}"
							onclick={() => (selectedId = recording.id)}
						>
							<div class="flex items-baseline justify-between gap-3">
								<span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
									{recording.title || formatTimestamp(recording.createdAt)}
								</span>
								<span class="shrink-0 text-xs tabular-nums text-gray-400">
									{formatDuration(recording.durationSeconds)}
								</span>
							</div>
							{#if recording.title}
								<p class="mt-1 text-xs text-gray-400">{formatTimestamp(recording.createdAt)}</p>
							{/if}
							{#if recording.tagIds.length > 0}
								<div class="mt-2 flex flex-wrap gap-1">
									{#each tagsStore.list.filter((t) => recording.tagIds.includes(t.id)) as tag (tag.id)}
										<TagChip {tag} interactive={false} parentHue={parentTag(tag, tagsStore.list)?.hue ?? null} />
									{/each}
								</div>
							{/if}
						</button>
					</li>
				{:else}
					<li class="card border-dashed p-8 text-center text-sm text-gray-400">
						{recordingsStore.favorites.length > 0 ? 'No recordings match your search' : 'No favourites yet'}
					</li>
				{/each}
			</ul>
		</div>
	</div>

	{#if selectedRecording}
		<div class="min-w-0 flex-1 border-l border-gray-200 dark:border-white/10">
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
