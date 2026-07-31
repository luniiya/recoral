<script lang="ts">
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FloatingVolumeControl from '$lib/components/FloatingVolumeControl.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import Scrubber from '$lib/components/Scrubber.svelte';
	import VirtualTimeline from '$lib/components/VirtualTimeline.svelte';
	import { buildScrubberSegments, buildTimeline } from '$lib/dateGroups';
	import { detailPanelStore } from '$lib/detailPanel.svelte';
	import { recordingDisplayTitle } from '$lib/format';
	import { useListBackHandler } from '$lib/listBack.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { hasActiveRecordingFilter, matchesRecordingFilter } from '$lib/recordingFilter';
	import { recordingsStore } from '$lib/recordings.svelte';

	let scrollEl: HTMLDivElement | undefined = $state();
	let selectedId = $state<string | null>(null);
	let detailRef: RecordingDetail | undefined = $state();

	// Fades playback out first if it's actively playing (same as the on-screen
	// close button, see RecordingDetail's exported handleClose), instead of
	// yanking selectedId straight to null and reproducing the same pop.
	useListBackHandler(
		() => selectedId,
		() => (detailRef ? void detailRef.handleClose() : (selectedId = null))
	);

	// The header filter panel is visible on this page too (same as
	// Recordings/Favourites), so it needs to actually apply here rather than
	// silently doing nothing, which is what happened before this list ever
	// consulted search/tag/date state.
	let visibleRecordings = $derived(
		recordingsStore.archived.filter((r) =>
			matchesRecordingFilter(r, {
				search: recordingsStore.search,
				searchFields: recordingsStore.searchFields,
				serverSearchIds: recordingsStore.serverSearchIds,
				tagIds: recordingsStore.selectedTagIds,
				dateFrom: recordingsStore.dateFrom,
				dateTo: recordingsStore.dateTo
			})
		)
	);

	let selectedRecording = $derived(recordingsStore.archived.find((r) => r.id === selectedId) ?? null);
	let timeline = $derived(buildTimeline(visibleRecordings));
	let scrubberSegments = $derived(buildScrubberSegments(visibleRecordings));
	let orderedIds = $derived(visibleRecordings.map((r) => r.id));

	// See detailPanel.svelte.ts: lets the layout auto-collapse the Sidebar on
	// narrow desktop widths while a detail panel is open here.
	$effect(() => detailPanelStore.set(!!selectedRecording));
	$effect(() => () => detailPanelStore.set(false));
</script>

<svelte:head>
	<title>{selectedRecording ? recordingDisplayTitle(selectedRecording) : 'recoral - Archive'}</title>
</svelte:head>

<div class="flex h-full">
	<div
		class="relative h-full w-full md:transition-[width] md:duration-300 {selectedRecording
			? 'md:w-[26rem] md:shrink-0'
			: 'md:w-full'}"
	>
		<div bind:this={scrollEl} class="no-native-scrollbar h-full overflow-y-auto">
			<div class="mx-auto max-w-xl px-6 pt-10 pb-36 md:pb-10">
				<h1 class="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive</h1>

				<p class="mb-5 text-xs font-medium text-gray-400">
					{#if recordingsStore.search.trim() || hasActiveRecordingFilter({ tagIds: recordingsStore.selectedTagIds, dateFrom: recordingsStore.dateFrom, dateTo: recordingsStore.dateTo })}
						{visibleRecordings.length} {visibleRecordings.length === 1 ? 'result' : 'results'}
					{:else}
						{recordingsStore.archived.length} archived
					{/if}
				</p>

				{#if timeline.length === 0}
					<EmptyState
						message={recordingsStore.archived.length > 0 ? 'No recordings match your search' : 'Nothing archived yet'}
					/>
				{:else}
					<VirtualTimeline {timeline} {scrollEl}>
						{#snippet recordingRow(row)}
							<RecordingCard
								recording={row.recording}
								selected={selectedId === row.recording.id}
								onselect={() => (selectedId = row.recording.id)}
								{orderedIds}
							/>
						{/snippet}
						{#snippet separatorRow(row)}
							<DateSeparator level={row.kind} label={row.label} />
						{/snippet}
					</VirtualTimeline>
				{/if}
			</div>
		</div>

		<Scrubber {scrollEl} segments={scrubberSegments} />
		{#if isNativePlatform()}
			<PullToRefresh {scrollEl} onrefresh={() => recordingsStore.load()} />
		{/if}
	</div>

	{#if selectedRecording}
		<div class="fixed inset-0 z-40 bg-white dark:bg-black md:static md:inset-auto md:z-auto md:min-w-0 md:flex-1 md:border-l md:border-gray-200 md:dark:border-white/10">
			<RecordingDetail bind:this={detailRef} recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>

{#if !selectedRecording && recordingsStore.archived.length > 0}
	<FloatingVolumeControl raised />
{/if}
