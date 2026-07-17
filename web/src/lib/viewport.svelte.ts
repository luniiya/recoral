// Reactive "are we in the desktop/wide layout" signal, matching Tailwind's
// default `md` breakpoint (768px), the same cutoff already used everywhere
// else in the app to switch from the mobile single-column layout to the
// desktop sidebar+list+detail one (see the `md:` classes throughout
// web/src/routes). Needed as JS, not just CSS, for behavior that has to
// differ by layout too, not only appearance: RecordingCard's touch-only
// hold-to-select-drag gesture is deliberately desktop-never (mouse users get
// click and shift/ctrl+click only, holding a mouse button and dragging to
// sweep-select isn't a desktop pattern here).
const QUERY = '(min-width: 768px)';

let isDesktop = $state(typeof window !== 'undefined' && matchMedia(QUERY).matches);

if (typeof window !== 'undefined') {
	matchMedia(QUERY).addEventListener('change', (event) => {
		isDesktop = event.matches;
	});
}

export const viewportStore = {
	get isDesktop() {
		return isDesktop;
	}
};
