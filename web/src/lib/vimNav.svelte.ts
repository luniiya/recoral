import type RecordingDetail from './components/RecordingDetail.svelte';
import type VirtualTimeline from './components/VirtualTimeline.svelte';
import { vimMode } from './vimMode.svelte';
import { vimZone } from './vimZone.svelte';
import { onMount } from 'svelte';

interface VimNavOptions {
	// The current visible list's id order (only the page knows this, it owns
	// the filtered/sorted list), same shape RecordingCard already takes for
	// shift+click range-select.
	orderedIds: () => string[];
	getSelectedId: () => string | null;
	setSelectedId: (id: string | null) => void;
}

const GG_WINDOW_MS = 500;

// j/k move a lightweight "cursor" through the list without opening anything
// (real vim motion vs action semantics), l opens the detail panel for
// whatever's under the cursor, h closes it again (or, with nothing open,
// hands focus to the Sidebar navbar instead, see vimZone.svelte.ts for the
// full navbar > list > detail picture), gg/G jump to the first/last item,
// Space toggles play/pause once a detail panel is actually open. Escape
// turns the whole thing off, it's a keyboard-shortcut easter egg some people
// won't want running at all, not a real mode a document needs.
// Desktop-only in spirit (nothing stops a bluetooth keyboard on mobile, but
// there's no touch equivalent so it's not something to design around
// there), gated off entirely while vimMode.isTyping so it never steals keys
// from a real text field. Also owns the RecordingDetail/VirtualTimeline
// instance refs and the auto-scroll-into-view effect, so each page using
// this only needs to bind:this={vim.detailRef}/{vim.timelineRef} instead of
// re-declaring and re-wiring all of that itself.
export function useVimNav(options: VimNavOptions) {
	let cursorId = $state<string | null>(null);
	let detailRef: RecordingDetail | undefined = $state();
	let timelineRef: VirtualTimeline | undefined = $state();
	let lastGPressAt = 0;

	function closeDetail() {
		if (detailRef) void detailRef.handleClose();
		else options.setSelectedId(null);
	}

	// In list zone (nothing open yet), moving is just moving, l is the
	// explicit "commit" to actually open something, real vim motion vs
	// action semantics. But once something IS open, you're already in the
	// detail pane, past that threshold, so there's no separate commit step
	// left to make: moving here also opens, same as e.g. Gmail/Superhuman's
	// reading pane advancing as you go up/down a message list.
	function moveCursor(direction: 'first' | 'last' | 'next' | 'prev') {
		const ids = options.orderedIds();
		if (ids.length === 0) return;
		if (direction === 'first') cursorId = ids[0];
		else if (direction === 'last') cursorId = ids[ids.length - 1];
		else if (cursorId === null || !ids.includes(cursorId)) cursorId = ids[0];
		else {
			const idx = ids.indexOf(cursorId);
			cursorId = direction === 'next' ? ids[Math.min(ids.length - 1, idx + 1)] : ids[Math.max(0, idx - 1)];
		}
		if (cursorId && options.getSelectedId() !== null) options.setSelectedId(cursorId);
	}

	$effect(() => {
		if (cursorId) void timelineRef?.scrollToRecording(cursorId);
	});

	// The cursor ring is purely a `cursorId` prop match on RecordingCard, so
	// turning the feature off (Escape) has to actually clear it here too, or
	// the last-highlighted card just stays ringed forever with no cursor
	// keys left that do anything to it.
	$effect(() => {
		if (!vimZone.enabled) cursorId = null;
	});

	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (vimMode.isTyping) return;

			// Starts off (recoral shouldn't open already "in vim mode"): the
			// first actual nav key both turns it on and performs the action in
			// the same keypress, rather than needing a separate no-op press
			// just to activate. Escape toggles it off same as vim's own Escape
			// always returns to Normal (see VimEscapeHandler.svelte); pressing
			// a nav key again afterwards turns it right back on, same as here.
			if (!vimZone.enabled) {
				const isVimKey = ['j', 'k', 'l', 'h', 'g', 'G'].includes(event.key);
				if (!isVimKey) return;
				vimZone.enable();
			}
			if (vimZone.sidebarFocused) return;

			if (event.key === 'g') {
				const now = performance.now();
				if (now - lastGPressAt < GG_WINDOW_MS) {
					event.preventDefault();
					moveCursor('first');
					lastGPressAt = 0;
				} else {
					lastGPressAt = now;
				}
			} else if (event.key === 'G') {
				event.preventDefault();
				moveCursor('last');
			} else if (event.key === 'j') {
				event.preventDefault();
				moveCursor('next');
			} else if (event.key === 'k') {
				event.preventDefault();
				moveCursor('prev');
			} else if (event.key === 'l') {
				if (!cursorId) return;
				event.preventDefault();
				options.setSelectedId(cursorId);
			} else if (event.key === 'h') {
				event.preventDefault();
				if (options.getSelectedId() !== null) closeDetail();
				else vimZone.focusSidebar();
			} else if (event.key === ' ') {
				if (options.getSelectedId() === null) return;
				event.preventDefault();
				detailRef?.togglePlayback();
			}
		}

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	return {
		get cursorId() {
			return cursorId;
		},
		get detailRef() {
			return detailRef;
		},
		set detailRef(value) {
			detailRef = value;
		},
		get timelineRef() {
			return timelineRef;
		},
		set timelineRef(value) {
			timelineRef = value;
		},
		closeDetail
	};
}
