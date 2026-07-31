import { vimMode } from './vimMode.svelte';
import { vimPreference } from './vimPreference.svelte';
import { vimZone } from './vimZone.svelte';
import { onMount } from 'svelte';

interface VimScrollOptions {
	scrollEl: () => HTMLElement | undefined;
}

const SCROLL_STEP_PX = 120;
const GG_WINDOW_MS = 500;

// A lighter cousin of vimNav.svelte.ts, for a page with no recordings list to
// browse a cursor through (Tags): j/k just scroll a step at a time, gg/G jump
// to the very top/bottom, h still hands focus to the Sidebar navbar (same
// navbar > list > detail picture from vimZone.svelte.ts, Tags counts as "the
// list" here even though there's nothing to open into a detail pane on the
// right). Same lazy-activation-on-first-keypress and gating (never while
// vimMode.isTyping, never while vimZone.sidebarFocused) as useVimNav.
export function useVimScroll(options: VimScrollOptions) {
	let lastGPressAt = 0;

	onMount(() => {
		function onKeydown(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (vimMode.isTyping) return;
			if (!vimPreference.allowed) return;

			if (!vimZone.enabled) {
				const isVimKey = ['j', 'k', 'h', 'g', 'G'].includes(event.key);
				if (!isVimKey) return;
				vimZone.enable();
			}
			if (vimZone.sidebarFocused) return;

			const el = options.scrollEl();

			if (event.key === 'j') {
				if (!el) return;
				event.preventDefault();
				// 'auto' (instant), not 'smooth': holding the key fires this many
				// times a second, faster than a smooth-scroll animation can ease
				// out, so each new call was fighting the still-running previous
				// one instead of just tracking the key repeat cleanly.
				el.scrollBy({ top: SCROLL_STEP_PX, behavior: 'auto' });
			} else if (event.key === 'k') {
				if (!el) return;
				event.preventDefault();
				el.scrollBy({ top: -SCROLL_STEP_PX, behavior: 'auto' });
			} else if (event.key === 'g') {
				const now = performance.now();
				if (now - lastGPressAt < GG_WINDOW_MS) {
					event.preventDefault();
					el?.scrollTo({ top: 0, behavior: 'smooth' });
					lastGPressAt = 0;
				} else {
					lastGPressAt = now;
				}
			} else if (event.key === 'G') {
				if (!el) return;
				event.preventDefault();
				el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
			} else if (event.key === 'h') {
				event.preventDefault();
				vimZone.focusSidebar();
			}
		}

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
}
