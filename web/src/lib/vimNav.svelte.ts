import type RecordingDetail from './components/RecordingDetail.svelte';
import type VirtualTimeline from './components/VirtualTimeline.svelte';
import { createGgTracker, dispatchVimKey, shouldHandleVimKey, type VimKeyBindings } from './vimKeyGate';
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

// j/k move a lightweight "cursor" through the list without opening anything
// (real vim motion vs action semantics), l opens the detail panel for
// whatever's under the cursor, h closes it again (or, with nothing open,
// hands focus to the Sidebar navbar instead, see vimZone.svelte.ts for the
// full navbar > list > detail picture), gg/G jump to the first/last item,
// Space toggles play/pause once a detail panel is actually open. Escape
// turns the whole thing off (VimEscapeHandler.svelte), it's a keyboard-
// shortcut easter egg some people won't want running at all, not a real
// mode a document needs. Desktop-only in spirit (nothing stops a bluetooth
// keyboard on mobile, but there's no touch equivalent so it's not something
// to design around there). Also owns the RecordingDetail/VirtualTimeline
// instance refs and the auto-scroll-into-view effect, so each page using
// this only needs to bind:this={vim.detailRef}/{vim.timelineRef} instead of
// re-declaring and re-wiring all of that itself.
export function useVimNav(options: VimNavOptions) {
	let cursorId = $state<string | null>(null);
	let detailRef: RecordingDetail | undefined = $state();
	let timelineRef: VirtualTimeline | undefined = $state();
	const gg = createGgTracker();

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
		else {
			// No cursor yet (never moved with j/k/gg/G): start from whatever's
			// already open instead of jumping to the top of the list out of
			// nowhere, e.g. a recording opened by a plain mouse click before
			// ever touching a vim key.
			let idx: number;
			if (cursorId !== null && ids.includes(cursorId)) {
				idx = ids.indexOf(cursorId);
			} else {
				const selected = options.getSelectedId();
				idx = selected && ids.includes(selected) ? ids.indexOf(selected) : -1;
			}
			cursorId = direction === 'next' ? ids[Math.min(ids.length - 1, idx + 1)] : ids[Math.max(0, idx - 1)];
		}
		if (cursorId && options.getSelectedId() !== null) options.setSelectedId(cursorId);
	}

	$effect(() => {
		if (cursorId) void timelineRef?.scrollToRecording(cursorId);
	});

	// The cursor bar is purely a `cursorId` prop match on RecordingCard, so
	// turning the feature off (Escape) has to actually clear it here too, or
	// the last-highlighted card just stays marked forever with no cursor
	// keys left that do anything to it.
	$effect(() => {
		if (!vimZone.enabled) cursorId = null;
	});

	// One entry per binding instead of an if/else-if chain: adding a new
	// shortcut later (or changing what a key does) is a one-line change
	// here, not finding the right spot in a growing chain.
	const bindings: VimKeyBindings = {
		g: () => {
			if (!gg.pressG()) return false;
			moveCursor('first');
			return true;
		},
		G: () => {
			moveCursor('last');
			return true;
		},
		j: () => {
			moveCursor('next');
			return true;
		},
		k: () => {
			moveCursor('prev');
			return true;
		},
		l: () => {
			if (!cursorId) return false;
			options.setSelectedId(cursorId);
			return true;
		},
		h: () => {
			if (options.getSelectedId() !== null) closeDetail();
			else vimZone.focusSidebar();
			return true;
		},
		' ': () => {
			if (options.getSelectedId() === null) return false;
			detailRef?.togglePlayback();
			return true;
		}
	};

	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (!shouldHandleVimKey(event)) return;
			dispatchVimKey(event, bindings);
		}

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	return {
		// null while the Sidebar zone has focus: cursorId itself stays set (so
		// it's right there when h/l hand focus back to the list), but showing
		// its card-level cursor bar at the same time as the Sidebar's own made
		// it look like two different things were "current" simultaneously,
		// one of the three navbar/list/detail panes should be it at a time.
		get cursorId() {
			return vimZone.sidebarFocused ? null : cursorId;
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
