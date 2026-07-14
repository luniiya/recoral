<script lang="ts">
	import DateSeparator from '$lib/components/DateSeparator.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import RecordingCard from '$lib/components/RecordingCard.svelte';
	import RecordingDetail from '$lib/components/RecordingDetail.svelte';
	import Scrubber from '$lib/components/Scrubber.svelte';
	import { buildScrubberSegments, buildTimeline } from '$lib/dateGroups';
	import { mobileBack } from '$lib/mobileBack.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';

	let scrollEl: HTMLDivElement | undefined = $state();
	let selectedId = $state<string | null>(null);

	$effect(() => {
		if (selectedId) mobileBack.set(() => (selectedId = null));
		else mobileBack.clear();
		return () => mobileBack.clear();
	});

	let selectedRecording = $derived(recordingsStore.archived.find((r) => r.id === selectedId) ?? null);
	let timeline = $derived(buildTimeline(recordingsStore.archived));
	let scrubberSegments = $derived(buildScrubberSegments(recordingsStore.archived));
</script>

<svelte:head>
	<title>recoral - Archive</title>
</svelte:head>

<div class="flex h-full">
	<div
		class="relative h-full transition-[width] duration-300 {selectedRecording
			? 'w-[26rem] shrink-0'
			: 'w-full'}"
	>
		<div bind:this={scrollEl} class="no-native-scrollbar h-full overflow-y-auto">
			<div class="mx-auto max-w-xl px-6 pt-10 pb-36 md:pb-10">
				<h1 class="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive</h1>

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
						<EmptyState message="Nothing archived yet" />
					{/each}
				</div>
			</div>
		</div>

		<Scrubber {scrollEl} segments={scrubberSegments} />
	</div>

	{#if selectedRecording}
		<div class="fixed inset-0 z-40 bg-white dark:bg-black md:static md:inset-auto md:z-auto md:min-w-0 md:flex-1 md:border-l md:border-gray-200 md:dark:border-white/10">
			<RecordingDetail recording={selectedRecording} onclose={() => (selectedId = null)} />
		</div>
	{/if}
</div>
