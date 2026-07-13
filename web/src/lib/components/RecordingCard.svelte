<script lang="ts">
	import type { Recording } from '@recoral/shared';
	import { formatTimestamp } from '$lib/format';
	import { parentTag } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import RecordingCardHeader from './RecordingCardHeader.svelte';
	import TagChip from './TagChip.svelte';

	let { recording, selected = false, onselect }: { recording: Recording; selected?: boolean; onselect: () => void } =
		$props();
</script>

<button
	class="card w-full p-4 text-left transition
		{selected ? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}"
	onclick={onselect}
>
	<RecordingCardHeader {recording} />
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
