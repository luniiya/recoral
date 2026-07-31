<script lang="ts">
	import { formatTimestamp } from '$lib/format';
	import type { DisplayRecording } from '$lib/recordings.svelte';
	import { rangeBetween, selectionStore } from '$lib/selection.svelte';
	import { parentTag, visibleTagIds } from '$lib/tagPath';
	import { tagsStore } from '$lib/tags.svelte';
	import { viewportStore } from '$lib/viewport.svelte';
	import RecordingCardHeader from './RecordingCardHeader.svelte';
	import TagChip from './TagChip.svelte';

	let {
		recording,
		selected = false,
		onselect,
		// The current visible list's id order, for shift+click range-select and
		// its hover preview. Only the page knows this (it owns the filtered/
		// sorted list), so it's threaded down rather than computed in here.
		orderedIds = [],
		// vimNav.svelte.ts's j/k cursor: a distinct, lighter outline from
		// `selected` (which means "this one's actually open in the detail
		// panel"), since the cursor can sit on a card without opening it.
		cursor = false
	}: {
		recording: DisplayRecording;
		selected?: boolean;
		onselect: () => void;
		orderedIds?: string[];
		cursor?: boolean;
	} = $props();

	// Read-only display: hides a tag if a more specific one already shown
	// covers it (e.g. only "voiceacting/certainvoice" shows, not also its
	// parent "voiceacting"), see tagPath.ts's visibleTagIds().
	let visibleTags = $derived(
		tagsStore.list.filter((t) => visibleTagIds(recording.tagIds, tagsStore.list).includes(t.id))
	);

	const HOLD_MS = 550;
	const MOVE_CANCEL_PX = 10;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;
	let armCancelled = false;

	// DRAG-SELECT FINDINGS (2026-07-31): this card used to support Google
	// Photos/Gmail-style drag-select on mobile (hold a card, then keep
	// dragging over others to sweep-select them, with auto-scroll near the
	// list edges). It's gone, deliberately, and here's why, so nobody re-adds
	// it without reading this first.
	//
	// The whole feature fought the browser for control of the same touch, and
	// lost. To make an ordinary scroll swipe feel native (real OS momentum,
	// not something hand-rolled in JS), a card has to allow native scrolling
	// via touch-action:pan-y from the very first frame of a touch, since that
	// value is locked in once a touch starts and can't be swapped mid-gesture
	// (confirmed: a version that waited for a hold to arm before flipping
	// touch-action lost the race every time, the WebView had already
	// committed the touch to its own scroll before the flip happened). But
	// that same pan-y is exactly what makes a "press and pause, then drag to
	// extend the selection" gesture impossible to arm reliably: real fingers
	// always have a little contact jitter, which is enough for the OS's pan
	// recognizer (instant, no delay) to claim the touch as a scroll before
	// our own few-hundred-ms arm timer ever gets a chance to decide anything.
	// Once native scrolling has started, calling preventDefault() afterwards
	// doesn't undo it. The only way found to avoid that race entirely was
	// switching the card to touch-none (no native scroll at all) for the
	// whole time selection mode was open, hand-rolling every scroll during
	// that mode instead, which just reintroduced the original dead, no-
	// momentum scrolling feeling, just scoped to selection mode instead of
	// everywhere. Neither option was acceptable.
	//
	// This turns out to be a real, unresolved gap in the web platform itself,
	// not a mistake in this code: there's a still-open W3C Pointer Events
	// spec issue about exactly this ("touch-action doesn't allow for
	// press-hold-drag UX", github.com/w3c/pointerevents/issues/178), and
	// mobile Immich's own web app can't drag-select either, only its native
	// (Flutter) app can, same story for Google Photos' web app vs. its native
	// app. Two teams with a lot more resources hit the same wall.
	//
	// Current behavior instead: holding a card (HOLD_MS, below) still enters
	// selection mode for that one card, exactly as before. From there,
	// selecting more is a plain tap per card (handleClick's
	// `selectionStore.toggle`, further down), one at a time, no drag. Revisit
	// this only if either the platform actually fixes the underlying
	// limitation above, or recoral builds a real native Android gesture
	// plugin for it (same category as the custom RecorderService this app
	// already has for background recording, see CLAUDE.md), not before.
	function onPointerDown(event: PointerEvent) {
		// Desktop never gets the hold-to-select gesture at all, mouse users
		// select via plain click and shift/ctrl+click only (see handleClick
		// below).
		if (viewportStore.isDesktop) return;
		// Already selecting: further selection is deliberately plain-tap-only
		// now (see the findings above), nothing left to arm on a hold here.
		if (selectionStore.active) return;
		held = false;
		armCancelled = false;
		const startX = event.clientX;
		const startY = event.clientY;

		function onEarlyMove(moveEvent: PointerEvent) {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;
			const dist = Math.hypot(dx, dy);
			if (dist <= MOVE_CANCEL_PX) return;
			// This was an ordinary scroll, not a hold: nothing to do here,
			// touch-action:pan-y already let native scrolling start running in
			// parallel the instant the OS itself recognized the pan, with full
			// native momentum. Just stop listening.
			armCancelled = true;
			cleanupArm();
		}
		function onEarlyRelease() {
			armCancelled = true;
			cleanupArm();
		}
		function cleanupArm() {
			if (holdTimer) clearTimeout(holdTimer);
			holdTimer = null;
			window.removeEventListener('pointermove', onEarlyMove);
			window.removeEventListener('pointerup', onEarlyRelease);
			window.removeEventListener('pointercancel', onEarlyRelease);
		}

		window.addEventListener('pointermove', onEarlyMove, { passive: true });
		window.addEventListener('pointerup', onEarlyRelease);
		window.addEventListener('pointercancel', onEarlyRelease);

		holdTimer = setTimeout(() => {
			holdTimer = null;
			cleanupArm();
			if (armCancelled) return;
			held = true;
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
		if (selectionStore.active && event.shiftKey && selectionStore.anchorId) {
			navigator.vibrate?.(2);
			selectionStore.selectRange(rangeBetween(orderedIds, selectionStore.anchorId, recording.id));
			return;
		}
		if (selectionStore.active) {
			// held stays false here, meaning the arm timer never fired (this
			// was a plain quick tap, not a press-and-pause-to-drag), so nothing
			// pre-added this card yet, a plain toggle is exactly right.
			navigator.vibrate?.(2);
			selectionStore.toggle(recording.id);
			return;
		}
		// Ctrl/Cmd+click is the desktop mouse shortcut for toggling a card into
		// selection instantly, same idea as a file manager, without waiting out
		// the hold (which still works with a mouse too, held-mousedown, but
		// feels sluggish compared to touch where it's the natural gesture).
		if (event.ctrlKey || event.metaKey) {
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
		{viewportStore.isDesktop ? '' : 'touch-pan-y'}
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
	{#if cursor && !selected}
		<!-- The vim nav cursor (vimNav.svelte.ts): a short gutter-marker pill
		     instead of a ring around the whole card, which fought with the
		     card's own border and read as heavy-handed. A full-height bar with
		     rounded corners doesn't work either, a corner radius this size
		     can't render on something this narrow, so it comes out as a tight
		     cap that pokes out past the card's own much wider corner curve;
		     inset and vertically centered sidesteps that entirely. Green, not
		     the app's accent color, since green is already "vim mode"
		     everywhere else in this feature (the Sidebar's NORMAL badge),
		     keeping it visually distinct from the accent-colored "this one's
		     actually open" fill above. Shows through multi-select mode too
		     (checkbox-selected or not), the cursor is a separate concept from
		     what's bulk-selected. -->
		<span class="absolute top-1/2 left-1.5 h-8 w-1 -translate-y-1/2 rounded-full bg-green-500"></span>
	{/if}
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
		{#if visibleTags.length > 0}
			<div class="mt-2 flex flex-wrap gap-1">
				{#each visibleTags as tag (tag.id)}
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
