<script lang="ts">
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import Scrubber from '$lib/components/Scrubber.svelte';
	import { buildScrubberSegments, buildTimeline } from '$lib/dateGroups';
	import { recordingDisplayTitle } from '$lib/format';
	import { mobileBack } from '$lib/mobileBack.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { recordingsStore } from '$lib/recordings.svelte';

	let scrollEl: HTMLDivElement | undefined = $state();
	let selectedId = $state<string | null>(null);

	$effect(() => {
		if (selectedId) mobileBack.set(() => (selectedId = null));
		else mobileBack.clear();
		return () => mobileBack.clear();
	});

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
	let timeline = $derived(buildTimeline(visibleRecordings));
	let scrubberSegments = $derived(buildScrubberSegments(visibleRecordings));
</script>

<svelte:head>
	<title>{selectedRecording ? recordingDisplayTitle(selectedRecording) : 'recoral - Favourites'}</title>
</svelte:head>

<div class="flex h-full">
	<div
		class="relative h-full w-full md:transition-[width] md:duration-300 {selectedRecording
			? 'md:w-[26rem] md:shrink-0'
			: 'md:w-full'}"
	>
		<div bind:this={scrollEl} class="no-native-scrollbar h-full overflow-y-auto">
			<div class="mx-auto max-w-xl px-6 pt-10 pb-36 md:pb-10">
			<p class="mb-3 text-xs font-medium text-gray-400">
				{#if recordingsStore.search.trim() || recordingsStore.selectedTagIds.length > 0}
					{visibleRecordings.length} {visibleRecordings.length === 1 ? 'result' : 'results'}
				{:else}
					{recordingsStore.favorites.length} {recordingsStore.favorites.length === 1 ? 'favourite' : 'favourites'}
				{/if}
			</p>

			<div class="flex flex-col gap-3">
				{#each timeline as row (row.key)}
					{#if row.kind === 'recording'}
						<RecordingCard
							recording={row.recording}
							selected={selectedId === row.recording.id}
							onselect={() => (selectedId = row.recording.id)}
						/>
					{:else}
						<DateSeparator level={row.kind} label={row.label} />
					{/if}
				{:else}
					<EmptyState
						message={recordingsStore.favorites.length > 0 ? 'No recordings match your search' : 'No favourites yet'}
					/>
				{/each}
			</div>
		</div>
		</div>

		<Scrubber {scrollEl} segments={scrubberSegments} />
		{#if isNativePlatform()}
			<PullToRefresh {scrollEl} onrefresh={() => recordingsStore.load()} />
		{/if}
	</div>

	{#if selectedRecording}
		<div class="fixed inset-0 z-40 bg-white dark:bg-black md:static md:inset-auto md:z-auto md:min-w-0 md:flex-1 md:border-l md:border-gray-200 md:dark:border-white/10">
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
