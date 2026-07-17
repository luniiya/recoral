<script lang="ts">
	import { formatTimestamp } from '$lib/format';
	import type { DisplayRecording } from '$lib/recordings.svelte';
	import { selectionStore } from '$lib/selection.svelte';
	import { parentTag } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import RecordingCardHeader from './RecordingCardHeader.svelte';
	import TagChip from './TagChip.svelte';

	let {
		recording,
		selected = false,
		onselect
	}: { recording: DisplayRecording; selected?: boolean; onselect: () => void } = $props();

	const HOLD_MS = 550;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;

	function onPointerDown() {
		held = false;
		holdTimer = setTimeout(() => {
			held = true;
			holdTimer = null;
			navigator.vibrate?.(2);
			selectionStore.enter(recording.id);
		}, HOLD_MS);
	}

	function cancelHold() {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}

	function handleClick(event: MouseEvent) {
		if (held) {
			held = false;
			return;
		}
		// Ctrl/Cmd+click is the desktop mouse shortcut for toggling a card into
		// selection instantly, same idea as a file manager, without waiting out
		// the hold (which still works with a mouse too, held-mousedown, but
		// feels sluggish compared to touch where it's the natural gesture).
		if (selectionStore.active || event.ctrlKey || event.metaKey) {
			navigator.vibrate?.(2);
			selectionStore.toggle(recording.id);
			return;
		}
		onselect();
	}

	let multiSelected = $derived(selectionStore.isSelected(recording.id));
</script>

<button
	class="card relative w-full p-4 text-left transition
		{selected || multiSelected ? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}
		{recording.syncStatus === 'uploading' ? 'syncing-ring' : ''}"
	onclick={handleClick}
	onpointerdown={onPointerDown}
	onpointerup={cancelHold}
	onpointerleave={cancelHold}
	onpointercancel={cancelHold}
>
	{#if selectionStore.active}
		<span
			class="absolute top-4 left-4 flex size-5 items-center justify-center rounded-full border-2 transition-colors
				{multiSelected ? 'border-accent-500 bg-accent-500 text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-neutral-900'}"
		>
			{#if multiSelected}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="size-3">
					<path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7" />
				</svg>
			{/if}
		</span>
	{/if}
	<div class={selectionStore.active ? 'pl-8' : ''}>
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
	</div>
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
