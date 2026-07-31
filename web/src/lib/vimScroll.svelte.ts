import { createGgTracker, dispatchVimKey, shouldHandleVimKey, type VimKeyBindings } from './vimKeyGate';
import { vimZone } from './vimZone.svelte';
import { onMount } from 'svelte';

interface VimScrollOptions {
	scrollEl: () => HTMLElement | undefined;
}

const SCROLL_STEP_PX = 120;

// A lighter cousin of vimNav.svelte.ts, for a page with no recordings list to
// browse a cursor through (Tags, Bin): j/k just scroll a step at a time, gg/G
// jump to the very top/bottom, h still hands focus to the Sidebar navbar
// (same navbar > list > detail picture from vimZone.svelte.ts, these count
// as "the list" here even though there's nothing to open into a detail pane
// on the right). Same gating/lazy-activation as useVimNav, see
// vimKeyGate.ts.
export function useVimScroll(options: VimScrollOptions) {
	const gg = createGgTracker();

	const bindings: VimKeyBindings = {
		j: () => {
			const el = options.scrollEl();
			if (!el) return false;
			// 'auto' (instant), not 'smooth': holding the key fires this many
			// times a second, faster than a smooth-scroll animation can ease
			// out, so each new call was fighting the still-running previous
			// one instead of just tracking the key repeat cleanly.
			el.scrollBy({ top: SCROLL_STEP_PX, behavior: 'auto' });
			return true;
		},
		k: () => {
			const el = options.scrollEl();
			if (!el) return false;
			el.scrollBy({ top: -SCROLL_STEP_PX, behavior: 'auto' });
			return true;
		},
		g: () => {
			if (!gg.pressG()) return false;
			options.scrollEl()?.scrollTo({ top: 0, behavior: 'smooth' });
			return true;
		},
		G: () => {
			const el = options.scrollEl();
			if (!el) return false;
			el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
			return true;
		},
		h: () => {
			vimZone.focusSidebar();
			return true;
		}
	};

	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (!shouldHandleVimKey(event, ['j', 'k', 'h', 'g', 'G'])) return;
			dispatchVimKey(event, bindings);
		}

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
}
