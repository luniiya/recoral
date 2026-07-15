<script lang="ts">
	import { formatTimestamp } from '$lib/format';
	import type { DisplayRecording } from '$lib/recordings.svelte';
	import { parentTag } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import RecordingCardHeader from './RecordingCardHeader.svelte';
	import TagChip from './TagChip.svelte';

	let {
		recording,
		selected = false,
		onselect
	}: { recording: DisplayRecording; selected?: boolean; onselect: () => void } = $props();
</script>

<button
	class="card w-full p-4 text-left transition
		{selected ? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}
		{recording.syncStatus === 'uploading' ? 'syncing-ring' : ''}"
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

<style>
	/* box-shadow only, never border/outline, so this can't add a gap or
	   shift sibling cards, it just paints inside the card's own bounds. */
	.syncing-ring {
		animation: syncing-pulse 1.4s ease-in-out infinite;
	}

	@keyframes syncing-pulse {
		0%,
		100% {
			box-shadow: inset 0 0 0 1.5px var(--accent-500);
		}
		50% {
			box-shadow: inset 0 0 0 3px var(--accent-500);
		}
	}
</style>
