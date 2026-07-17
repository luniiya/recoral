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
	// Shorter than HOLD_MS: once already selecting, the deliberate-intent bar
	// is lower (you're already committed to picking things), it just needs to
	// be enough to tell "pausing to drag-select" apart from "swiping to
	// scroll" before locking touch-action, not a full fresh-entry hold.
	const DRAG_ARM_MS = 180;
	const MOVE_CANCEL_PX = 10;
	const EDGE_ZONE_PX = 72;
	const EDGE_SCROLL_MAX_SPEED = 14;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;

	// Card-wide drag-select (touching and dragging over other cards while
	// already selecting extends the selection to them, Google Photos/Gmail-
	// style, with auto-scroll near the top/bottom edge to reach further ones).
	// This relies on touch-action:none being baked onto the card reactively
	// the moment selectionStore.active turns on (see the button's class below,
	// `touch-none` whenever active), not set mid-gesture: that's what actually
	// makes Android WebView honor it (a version that instead set touch-action
	// via JS partway into an already-started touch was not reliably honored,
	// native scroll kept winning underneath our own scrollTop resets). Because
	// native scroll for this touch is blocked from before it even started,
	// nothing else can move scrollTop during an armed drag except the
	// deliberate edge auto-scroll below.
	function startDragSelect(scrollEl: HTMLElement | null, baseline: string[], resetTouchAction?: () => void) {
		// Fixed to the card the drag actually started on, not reassigned as the
		// finger moves: each move re-selects the *whole* span from here to
		// wherever the finger is now (via rangeBetween, same helper shift+click
		// uses), so a fast drag that jumps straight from card A to card D in one
		// sampled pointermove still fills in B and C, instead of only adding
		// whichever single card elementFromPoint happened to catch that tick.
		// baseline is whatever was already selected *before* this drag (from
		// earlier actions, not this gesture), recomputing the whole selection as
		// baseline + current range every move (not merging into it) is what
		// lets dragging back up past cards this same drag added actually drop
		// them again instead of only ever growing.
		const startId = recording.id;
		let lastId = recording.id;
		let edgeScrollDirection = 0;
		let dragEnded = false;
		let edgeFrame: number | null = null;

		function runEdgeScroll() {
			if (dragEnded || !scrollEl) {
				edgeFrame = null;
				return;
			}
			if (edgeScrollDirection !== 0) {
				scrollEl.scrollTop = Math.max(
					0,
					Math.min(scrollEl.scrollHeight - scrollEl.clientHeight, scrollEl.scrollTop + edgeScrollDirection)
				);
			}
			edgeFrame = requestAnimationFrame(runEdgeScroll);
		}
		edgeFrame = requestAnimationFrame(runEdgeScroll);

		function updateEdgeScroll(clientY: number) {
			if (!scrollEl) return;
			const rect = scrollEl.getBoundingClientRect();
			const distanceFromTop = clientY - rect.top;
			const distanceFromBottom = rect.bottom - clientY;
			if (distanceFromTop < EDGE_ZONE_PX) {
				const strength = 1 - Math.max(0, distanceFromTop) / EDGE_ZONE_PX;
				edgeScrollDirection = -Math.ceil(strength * EDGE_SCROLL_MAX_SPEED);
			} else if (distanceFromBottom < EDGE_ZONE_PX) {
				const strength = 1 - Math.max(0, distanceFromBottom) / EDGE_ZONE_PX;
				edgeScrollDirection = Math.ceil(strength * EDGE_SCROLL_MAX_SPEED);
			} else {
				edgeScrollDirection = 0;
			}
		}

		function onMove(event: PointerEvent) {
			console.log('[drag] move, scrollTop:', Math.round(scrollEl?.scrollTop ?? -1));
			updateEdgeScroll(event.clientY);
			// elementsFromPoint (plural), not elementFromPoint: the floating
			// mobile search bar and the bottom nav are fixed-position overlays
			// that sit visually on top of the list, so a plain elementFromPoint
			// hits *them* instead of the card underneath whenever the finger
			// passes over that screen region, silently skipping cards there.
			// The full z-order stack lets this see straight through to the card
			// without needing those overlays to become click-through/invisible.
			const stack = document.elementsFromPoint(event.clientX, event.clientY);
			const el = stack.map((hit) => (hit as HTMLElement).closest<HTMLElement>('[data-recording-id]')).find((hit) => hit);
			const id = el?.dataset.recordingId;
			if (!id || id === lastId) return;
			lastId = id;
			// One short pulse per newly-selected card, not one pulse per move
			// event: a fast drag can sweep several new cards into the range in a
			// single sampled pointermove, and a lone vibrate(2) there would
			// under-represent that compared to dragging slowly across the same
			// cards one at a time.
			const previouslySelected = new Set(selectionStore.selectedIds);
			const nextSelection = [...baseline, ...rangeBetween(orderedIds, startId, id)];
			const newlyAdded = nextSelection.filter((sid) => !previouslySelected.has(sid)).length;
			if (newlyAdded > 0) {
				const pulses = Math.min(newlyAdded, 6);
				navigator.vibrate?.(Array.from({ length: pulses }, () => [2, 40]).flat());
			}
			selectionStore.setSelection(nextSelection);
		}
		function onUp() {
			dragEnded = true;
			edgeScrollDirection = 0;
			if (edgeFrame !== null) cancelAnimationFrame(edgeFrame);
			resetTouchAction?.();
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		}
		// passive: touch-action:none already blocks the browser's own default
		// handling of this touch, no preventDefault needed to fight it.
		window.addEventListener('pointermove', onMove, { passive: true });
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	let armCancelled = false;

	// Single mechanism for both "first hold to enter selection mode" (550ms,
	// deliberate, so a normal tap-to-open-detail never mistakenly arms) and
	// "already selecting, press-and-pause to extend by dragging" (180ms,
	// lower bar since intent's already established): stay still for the
	// delay and it arms (touch-none locked for the rest of this gesture); move
	// more than MOVE_CANCEL_PX before that and it's read as a scroll attempt
	// instead. Entering fresh, that just means letting the still-untouched
	// browser handle it; already selecting, touch-none is already baked onto
	// the card (see the class below), so onEarlyMove has to scroll it by hand
	// instead (see manualScrolling below). Without the delay/threshold at all,
	// *any* touch-and-move on a card while already selecting would lock into
	// drag-select immediately, unscrollable the whole time selection is on.
	function onPointerDown(event: PointerEvent) {
		held = false;
		armCancelled = false;
		const target = event.currentTarget as HTMLElement;
		const scrollEl = target.closest<HTMLElement>('.no-native-scrollbar');
		const startX = event.clientX;
		const startY = event.clientY;
		let lastY = event.clientY;
		const enteringFresh = !selectionStore.active;
		const delay = enteringFresh ? HOLD_MS : DRAG_ARM_MS;
		// While already selecting, this card has touch-action:none baked in
		// reactively before this touch even started (see the button's class
		// below), so the browser never scrolls it natively. A plain swipe here
		// (moved past the threshold before the arm timer fired) has to be
		// scrolled by hand instead, or the list would just look frozen for any
		// normal swipe while selecting. Entering fresh (first hold, nothing
		// selected yet) skips this entirely: touch-action is still default
		// then, so a cancelled arm just lets the browser's own scroll take over
		// like always.
		let manualScrolling = false;

		console.log('[arm] pointerdown, delay', delay, 'active', selectionStore.active);

		function onEarlyMove(moveEvent: PointerEvent) {
			if (manualScrolling) {
				if (scrollEl) {
					const dy = moveEvent.clientY - lastY;
					scrollEl.scrollTop = Math.max(
						0,
						Math.min(scrollEl.scrollHeight - scrollEl.clientHeight, scrollEl.scrollTop - dy)
					);
				}
				lastY = moveEvent.clientY;
				return;
			}
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;
			const dist = Math.hypot(dx, dy);
			if (dist <= MOVE_CANCEL_PX) return;
			console.log('[arm] cancelled by move, dist', Math.round(dist));
			armCancelled = true;
			if (holdTimer) clearTimeout(holdTimer);
			holdTimer = null;
			if (enteringFresh || !scrollEl) {
				cleanupArm();
				return;
			}
			console.log('[scroll] manual mode engaged');
			manualScrolling = true;
			lastY = moveEvent.clientY;
		}
		function onEarlyRelease(releaseEvent: PointerEvent) {
			console.log('[arm] cancelled by', releaseEvent.type);
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
			console.log('[arm] timer fired, cancelled?', armCancelled);
			if (armCancelled) return;
			held = true;
			console.log('[arm] ARMED');
			// Direct, synchronous style mutation, not a reactive class: a class
			// only lands in the real DOM on Svelte's next render flush, a
			// fraction too late for Android WebView to still honor it if a
			// touchmove for this same gesture is already in flight by then.
			target.style.touchAction = 'none';
			navigator.vibrate?.(2);
			const baseline = selectionStore.selectedIds;
			if (enteringFresh) {
				selectionStore.enter(recording.id);
			} else {
				selectionStore.add(recording.id);
			}
			startDragSelect(scrollEl, baseline, () => {
				target.style.touchAction = '';
			});
		}, delay);
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
		{selected || multiSelected
		? 'border-accent-400 bg-accent-50 dark:bg-accent-500/10'
		: previewed
			? 'border-accent-200 bg-accent-50/50 dark:border-accent-500/20 dark:bg-accent-500/5'
			: 'hover:bg-gray-50 dark:hover:bg-white/5'}
		{selectionStore.active ? 'touch-none' : ''}
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
