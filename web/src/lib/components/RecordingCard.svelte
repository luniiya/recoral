<script lang="ts">
	import { formatTimestamp } from '$lib/format';
	import type { DisplayRecording } from '$lib/recordings.svelte';
	import { rangeBetween, selectionStore } from '$lib/selection.svelte';
	import { parentTag } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import RecordingCardHeader from './RecordingCardHeader.svelte';
	import TagChip from './TagChip.svelte';

	let {
		recording,
		selected = false,
		onselect,
		// The current visible list's id order, for shift+click range-select and
		// its hover preview. Only the page knows this (it owns the filtered/
		// sorted list), so it's threaded down rather than computed in here.
		orderedIds = []
	}: {
		recording: DisplayRecording;
		selected?: boolean;
		onselect: () => void;
		orderedIds?: string[];
	} = $props();

	const HOLD_MS = 550;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;

	// After the hold enters selection mode, staying pressed and dragging the
	// finger up/down over other cards selects them too, without lifting and
	// re-tapping each one, same gesture Google Photos/Gmail use for touch
	// multi-select. touch-action: none (not overflow: hidden, which was
	// mutating the scroll container's own scrollability mid-touch and seems to
	// make WebView cancel the touch sequence outright, silently killing these
	// listeners before any drag movement was ever processed) on both the
	// origin card and its scroll container, plus preventDefault in pointermove
	// itself as the actual scroll-blocking mechanism.
	function startDragSelect(originEl: HTMLElement) {
		console.log('[dragselect] start, scrollEl found:', !!originEl.closest('.no-native-scrollbar'));
		let lastId = recording.id;
		const scrollEl = originEl.closest<HTMLElement>('.no-native-scrollbar');
		const previousCardTouchAction = originEl.style.touchAction;
		const previousScrollTouchAction = scrollEl?.style.touchAction ?? '';
		originEl.style.touchAction = 'none';
		if (scrollEl) scrollEl.style.touchAction = 'none';

		function onMove(event: PointerEvent) {
			console.log('[dragselect] move', event.clientX, event.clientY);
			event.preventDefault();
			const el = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>(
				'[data-recording-id]'
			);
			console.log('[dragselect] elementFromPoint hit:', el?.dataset.recordingId ?? 'none');
			const id = el?.dataset.recordingId;
			if (!id || id === lastId) return;
			lastId = id;
			navigator.vibrate?.(2);
			console.log('[dragselect] adding', id);
			selectionStore.add(id);
		}
		function onUp() {
			console.log('[dragselect] end');
			originEl.style.touchAction = previousCardTouchAction;
			if (scrollEl) scrollEl.style.touchAction = previousScrollTouchAction;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		}
		window.addEventListener('pointermove', onMove, { passive: false });
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	function onPointerDown(event: PointerEvent) {
		held = false;
		const target = event.currentTarget as HTMLElement;
		holdTimer = setTimeout(() => {
			held = true;
			holdTimer = null;
			navigator.vibrate?.(2);
			// enter() replaces the whole selection with just this card, correct
			// for starting a fresh one but not when selection mode's already
			// active (holding an already-selected card to start a new drag-select
			// from there shouldn't wipe out everything else already picked).
			if (selectionStore.active) selectionStore.add(recording.id);
			else selectionStore.enter(recording.id);
			startDragSelect(target);
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
		if (selectionStore.active && event.shiftKey && selectionStore.anchorId) {
			navigator.vibrate?.(2);
			selectionStore.selectRange(rangeBetween(orderedIds, selectionStore.anchorId, recording.id));
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

	// While shift is held and the pointer is over some card with an anchor
	// already set, preview exactly what a shift+click right now would select,
	// a lighter tint than the real "selected" state below.
	let previewed = $derived(
		selectionStore.active &&
			selectionStore.shiftHeld &&
			selectionStore.anchorId !== null &&
			!multiSelected &&
			rangeBetween(orderedIds, selectionStore.anchorId, selectionStore.hoveredId ?? '').includes(recording.id)
	);
</script>

<button
	data-recording-id={recording.id}
	class="card relative w-full p-4 text-left transition
		{selected || multiSelected
		? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10'
		: previewed
			? 'border-accent-200 bg-accent-50/50 dark:border-accent-500/20 dark:bg-accent-500/5'
			: 'hover:bg-gray-50 dark:hover:bg-white/5'}
		{recording.syncStatus === 'uploading' ? 'syncing-ring' : ''}"
	onclick={handleClick}
	onpointerdown={onPointerDown}
	onpointerup={cancelHold}
	onpointerenter={() => selectionStore.setHovered(recording.id)}
	onpointerleave={() => {
		cancelHold();
		if (selectionStore.hoveredId === recording.id) selectionStore.setHovered(null);
	}}
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
