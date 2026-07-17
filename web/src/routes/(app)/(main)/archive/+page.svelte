<script lang="ts">
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import Scrubber from '$lib/components/Scrubber.svelte';
	import VirtualTimeline from '$lib/components/VirtualTimeline.svelte';
	import { buildScrubberSegments, buildTimeline } from '$lib/dateGroups';
	import { recordingDisplayTitle } from '$lib/format';
	import { useListBackHandler } from '$lib/listBack.svelte';
	import { isNativePlatform } from '$lib/platform';
	import { recordingsStore } from '$lib/recordings.svelte';

	let scrollEl: HTMLDivElement | undefined = $state();
	let selectedId = $state<string | null>(null);

	useListBackHandler(
		() => selectedId,
		() => (selectedId = null)
	);

	let selectedRecording = $derived(recordingsStore.archived.find((r) => r.id === selectedId) ?? null);
	let timeline = $derived(buildTimeline(recordingsStore.archived));
	let scrubberSegments = $derived(buildScrubberSegments(recordingsStore.archived));
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
				<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive</h1>

				{#if timeline.length === 0}
					<EmptyState message="Nothing archived yet" />
				{:else}
					<VirtualTimeline {timeline} {scrollEl}>
						{#snippet recordingRow(row)}
							<RecordingCard
								recording={row.recording}
								selected={selectedId === row.recording.id}
								onselect={() => (selectedId = row.recording.id)}
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
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
