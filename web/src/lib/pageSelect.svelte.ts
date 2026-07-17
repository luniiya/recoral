// Bin needs its own Restore/Delete-forever selection (see bin/+page.svelte),
// separate from the global multi-select in selection.svelte.ts used by
// Recordings/Favourites/Archive, but still wants its "Select" button to live
// in the same shared top-bar spot as those pages, not buried in its own page
// body. Same bridging idea as mobileBack.svelte.ts/tabTap.svelte.ts: the page
// registers a callback here, the shared (main)/+layout.svelte header calls it.
let onStartSelecting = $state<(() => void) | null>(null);

function register(fn: () => void) {
	onStartSelecting = fn;
}

function clear() {
	onStartSelecting = null;
}

export const pageSelectStore = {
	get onStartSelecting() {
		return onStartSelecting;
	},
	register,
	clear
};
