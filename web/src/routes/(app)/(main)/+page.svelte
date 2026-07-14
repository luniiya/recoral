<script lang="ts">
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LiveRecordingPanel from '$lib/components/LiveRecordingPanel.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import Scrubber from '$lib/components/Scrubber.svelte';
	import { buildScrubberSegments, buildTimeline } from '$lib/dateGroups';
	import { formatDuration } from '$lib/format';
	import { liveRecordingStore } from '$lib/liveRecording.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';

	let scrollEl: HTMLDivElement | undefined = $state();
	let selectedId = $state<string | null>(null);

	$effect(() => {
		if (!liveRecordingStore.lastRecordingId) return;
		selectedId = liveRecordingStore.consumeLastRecordingId();
	});

	let visibleRecordings = $derived(
		recordingsStore.active.filter((r) => {
			const query = recordingsStore.search.trim().toLowerCase();
			const matchesQuery =
				!query || r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query);

			const filterTags = recordingsStore.selectedTagIds;
			const matchesTags = filterTags.length === 0 || filterTags.some((id) => r.tagIds.includes(id));

			return matchesQuery && matchesTags;
		})
	);

	let selectedRecording = $derived(recordingsStore.active.find((r) => r.id === selectedId) ?? null);
	let timeline = $derived(buildTimeline(visibleRecordings));
	let scrubberSegments = $derived(buildScrubberSegments(visibleRecordings));

	// A recording can now start from the mobile floating button in the
	// layout too, not just this page's own button, so clear the open detail
	// panel reactively rather than only when this page's button is clicked.
	$effect(() => {
		if (liveRecordingStore.isRecording) selectedId = null;
	});
</script>

<svelte:head>
	<title>recoral</title>
</svelte:head>

<div class="flex h-full">
	<div
		class="relative h-full transition-[width] duration-300 {selectedRecording ||
		liveRecordingStore.isRecording ||
		liveRecordingStore.savingRecording
			? 'w-[26rem] shrink-0'
			: 'w-full'}"
	>
		<div bind:this={scrollEl} class="no-native-scrollbar h-full overflow-y-auto">
			<div class="mx-auto max-w-xl px-6 pt-10 pb-36 md:pb-10">
			<div class="hidden flex-col items-center gap-3 pb-10 md:flex">
				<button
					class="flex size-16 items-center justify-center rounded-full text-white shadow-sm transition
						{liveRecordingStore.isRecording ? 'bg-accent-700' : 'bg-accent-500 hover:bg-accent-600'}"
					onclick={() => liveRecordingStore.toggle()}
					aria-label={liveRecordingStore.isRecording ? 'Stop recording' : 'Start recording'}
				>
					{#if liveRecordingStore.isRecording}
						<span class="size-4 rounded-sm bg-white"></span>
					{:else}
						<span class="size-6 rounded-full bg-white"></span>
					{/if}
				</button>
				<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
					{#if liveRecordingStore.isRecording}
						<span class="size-1.5 animate-pulse rounded-full bg-accent-500"></span>
					{/if}
					<span class="tabular-nums">
						{liveRecordingStore.isRecording ? formatDuration(liveRecordingStore.elapsedSeconds) : 'Tap to record'}
					</span>
				</div>
			</div>

			<p class="mb-3 text-xs font-medium text-gray-400">
				{#if recordingsStore.search.trim() || recordingsStore.selectedTagIds.length > 0}
					{visibleRecordings.length} {visibleRecordings.length === 1 ? 'result' : 'results'}
				{:else}
					{recordingsStore.active.length} {recordingsStore.active.length === 1 ? 'recording' : 'recordings'}
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
						message={recordingsStore.active.length > 0 ? 'No recordings match your search' : 'No recordings yet'}
					/>
				{/each}
			</div>
		</div>
		</div>

		<Scrubber {scrollEl} segments={scrubberSegments} />
	</div>

	{#if liveRecordingStore.isRecording || liveRecordingStore.savingRecording}
		<div class="fixed inset-0 z-40 bg-white dark:bg-black md:static md:inset-auto md:z-auto md:min-w-0 md:flex-1 md:border-l md:border-gray-200 md:dark:border-white/10">
			<LiveRecordingPanel
				stream={liveRecordingStore.recordingStream}
				elapsedSeconds={liveRecordingStore.elapsedSeconds}
				saving={liveRecordingStore.savingRecording}
				onStop={() => liveRecordingStore.stop()}
			/>
		</div>
	{:else if selectedRecording}
		<div class="fixed inset-0 z-40 bg-white dark:bg-black md:static md:inset-auto md:z-auto md:min-w-0 md:flex-1 md:border-l md:border-gray-200 md:dark:border-white/10">
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
