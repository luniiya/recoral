<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';

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
			<p class="mb-3 text-xs font-medium text-gray-400">
				{#if recordingsStore.search.trim() || recordingsStore.selectedTagIds.length > 0}
					{visibleRecordings.length} {visibleRecordings.length === 1 ? 'result' : 'results'}
				{:else}
					{recordingsStore.favorites.length} {recordingsStore.favorites.length === 1 ? 'favourite' : 'favourites'}
				{/if}
			</p>

			<ul class="flex flex-col gap-3">
				{#each visibleRecordings as recording (recording.id)}
					<li>
						<RecordingCard {recording} selected={selectedId === recording.id} onselect={() => (selectedId = recording.id)} />
					</li>
				{:else}
					<li>
						<EmptyState
							message={recordingsStore.favorites.length > 0 ? 'No recordings match your search' : 'No favourites yet'}
						/>
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
