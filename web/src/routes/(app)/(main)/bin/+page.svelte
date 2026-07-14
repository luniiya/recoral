<script lang="ts">
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import RecordingCardHeader from '$lib/components/RecordingCardHeader.svelte';
	import TagChip from '$lib/components/TagChip.svelte';
	import { recordingsStore } from '$lib/recordings.svelte';
	import { groupTrashedTags, type TrashedTagGroup } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';

	type BinItem =
		| { kind: 'recording'; trashedAt: string; recording: (typeof recordingsStore.trashed)[number] }
		| { kind: 'tagGroup'; trashedAt: string; group: TrashedTagGroup };

	let items = $derived(
		[
			...recordingsStore.trashed.map(
				(recording) => ({ kind: 'recording', trashedAt: recording.trashedAt!, recording }) as BinItem
			),
			...groupTrashedTags(tagsStore.trashed).map(
				(group) => ({ kind: 'tagGroup', trashedAt: group.root.trashedAt!, group }) as BinItem
			)
		].sort((a, b) => b.trashedAt.localeCompare(a.trashedAt))
	);
</script>

<svelte:head>
	<title>recoral - Bin</title>
</svelte:head>

<div class="mx-auto h-full max-w-xl overflow-y-auto px-6 pt-10 pb-36 md:pb-10">
	<h1 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Bin</h1>
	<p class="mb-6 text-sm text-gray-500 dark:text-gray-400">Items here are deleted for good after 30 days.</p>

	<ul class="flex flex-col gap-3">
		{#each items as item (item.kind + (item.kind === 'recording' ? item.recording.id : item.group.root.id))}
			<li class="card p-4">
				{#if item.kind === 'recording'}
					{@const recording = item.recording}
					<div class="mb-1">
						<RecordingCardHeader {recording} />
					</div>
					<p class="mb-3 text-xs text-gray-400">
						{recordingsStore.daysLeft(recording)} day{recordingsStore.daysLeft(recording) === 1 ? '' : 's'} left
					</p>
					<div class="mb-3">
						<AudioPlayer src={recordingsStore.audioUrl(recording.id)} />
					</div>
					<div class="flex gap-2">
						<button
							class="flex-1 rounded-full bg-accent-500 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600"
							onclick={() => recordingsStore.restore(recording.id)}
						>
							Restore
						</button>
						<button
							class="flex-1 rounded-full py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40"
							onclick={() => recordingsStore.deleteForever(recording.id)}
						>
							Delete forever
						</button>
					</div>
				{:else}
					{@const group = item.group}
					<div class="mb-1 flex flex-wrap items-center gap-1.5">
						<TagChip tag={group.root} interactive={false} />
						{#each group.descendants as descendant (descendant.id)}
							<TagChip tag={descendant} interactive={false} parentHue={group.root.hue} />
						{/each}
					</div>
					<p class="mb-3 text-xs text-gray-400">
						{tagsStore.daysLeft(group.root)} day{tagsStore.daysLeft(group.root) === 1 ? '' : 's'} left
					</p>
					<div class="flex gap-2">
						<button
							class="flex-1 rounded-full bg-accent-500 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-600"
							onclick={() => tagsStore.restore(group.root.id)}
						>
							Restore
						</button>
						<button
							class="flex-1 rounded-full py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40"
							onclick={() => tagsStore.deleteForever(group.root.id)}
						>
							Delete forever
						</button>
					</div>
				{/if}
			</li>
		{:else}
			<li><EmptyState message="Bin is empty" /></li>
		{/each}
	</ul>
</div>
