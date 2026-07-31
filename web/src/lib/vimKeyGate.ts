import { vimPreference } from './vimPreference.svelte';
import { vimZone } from './vimZone.svelte';

const NAV_KEYS = ['j', 'k', 'l', 'h', 'g', 'G'];

// The gating/lazy-activation preamble every vim keydown handler needs
// (useVimNav.svelte.ts and vimScroll.svelte.ts both had their own copy of
// this): never while a modifier's held, actually typing, or opted out
// entirely via Settings > Appearance; while off, only a real nav key is
// allowed to turn it on (Space etc. shouldn't); once on, the Sidebar zone
// owns its own keys instead. Plain functions, not vimZone.svelte.ts itself:
// vimPreference already depends on vimZone (to force-disable it when the
// setting's turned off), so this would be a circular import the other way
// around if it lived there instead.
export function shouldHandleVimKey(event: KeyboardEvent, activationKeys: string[] = NAV_KEYS): boolean {
	if (event.metaKey || event.ctrlKey || event.altKey) return false;
	if (vimZone.isTyping) return false;
	if (!vimPreference.allowed) return false;

	if (!vimZone.enabled) {
		if (!activationKeys.includes(event.key)) return false;
		vimZone.enable();
	}
	if (vimZone.sidebarFocused) return false;

	return true;
}

// The Sidebar's own counterpart: only while it actually has focus (the
// inverse of the guard above).
export function shouldHandleSidebarKey(event: KeyboardEvent): boolean {
	if (!vimZone.enabled || !vimZone.sidebarFocused) return false;
	if (event.metaKey || event.ctrlKey || event.altKey || vimZone.isTyping) return false;
	return true;
}

// A binding returns true if it actually did something, so the caller knows
// to event.preventDefault() instead of unconditionally swallowing every key
// that happens to have an entry (a binding can still decline, e.g. 'l' with
// no cursor yet, and let the browser's own default handling through).
export type VimKeyBindings = Record<string, () => boolean>;

// A declarative table instead of an if/else-if chain per key: adding a new
// binding later is one entry here, not a growing chain to slot into
// correctly. Shared by useVimNav, useVimScroll, and Sidebar's own keydown.
export function dispatchVimKey(event: KeyboardEvent, bindings: VimKeyBindings): void {
	if (bindings[event.key]?.()) event.preventDefault();
}

// The 'gg' double-press-within-a-window detection, also duplicated between
// the same two files.
export function createGgTracker(windowMs = 500) {
	let lastPressAt = 0;
	return {
		// True exactly on the keypress that completes a "gg" (the second g
		// within the window); resets so a third g starts a fresh pair rather
		// than immediately re-triggering.
		pressG(): boolean {
			const now = performance.now();
			if (now - lastPressAt < windowMs) {
				lastPressAt = 0;
				return true;
			}
			lastPressAt = now;
			return false;
		}
	};
}
