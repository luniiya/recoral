// Three horizontal "panes" in a row (navbar > recordings list > detail
// panel), matching the actual on-screen layout: h/l move focus one pane
// left/right, j/k move a cursor within whichever pane currently has focus.
// "Detail has focus" is just derived from whether a detail panel is open
// (each page's own useVimNav call already knows that), so the only extra
// state genuinely needed here is whether the *sidebar* currently owns j/k
// instead of the page's own list, since that's not otherwise derivable and
// has to survive page navigation (pressing l from the sidebar navigates to
// a different page's list entirely). `enabled` is the whole feature's own
// on/off switch: starts off (recoral shouldn't open already "in vim mode"),
// turned on only by actually pressing a nav key, j/k/l/h/g/G (see
// vimNav.svelte.ts). Escape only ever turns it *off* (VimEscapeHandler.svelte,
// same one-way trip as vim's own Escape always returning to Normal, never
// itself entering a mode), a no-op if it's already off; pressing a nav key
// again afterwards is what turns it back on, not Escape a second time.
// `isTyping` (focus currently inside a text field, app-wide) lives here too
// rather than its own separate file: the two are only ever consulted
// together (every vim keydown handler gates on both), keeping them apart
// was two files to open to understand one piece of behavior. Tracked via
// focusin/focusout in routes/+layout.svelte.
let enabled = $state(false);
let sidebarFocused = $state(false);
let sidebarCursorIndex = $state(0);
let isTyping = $state(false);

export const vimZone = {
	get enabled() {
		return enabled;
	},
	get isTyping() {
		return isTyping;
	},
	setTyping(value: boolean) {
		isTyping = value;
	},
	enable() {
		enabled = true;
	},
	disable() {
		enabled = false;
		sidebarFocused = false;
	},
	get sidebarFocused() {
		return sidebarFocused;
	},
	get sidebarCursorIndex() {
		return sidebarCursorIndex;
	},
	focusSidebar() {
		sidebarFocused = true;
	},
	focusList() {
		sidebarFocused = false;
	},
	setSidebarCursorIndex(index: number) {
		sidebarCursorIndex = index;
	}
};
