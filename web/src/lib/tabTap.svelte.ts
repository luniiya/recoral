import { recordingsStore } from './recordings.svelte';

// Tapping the bottom-nav tab you're already on should scroll that page's
// list back to top (or, if a search is active, just clear the search
// instead of also jumping the scroll position, same priority order as the
// hardware back button in listBack.svelte.ts). BottomNav lives in the
// layout, outside the page's own scroll container, so this is how the tap
// reaches whichever page is currently mounted.
let tapped = $state<{ path: string; token: number } | null>(null);

function tap(path: string) {
	tapped = { path, token: Date.now() };
}

export const tabTapStore = {
	get tapped() {
		return tapped;
	},
	tap
};

export function useTabTapScrollTop(path: string, getScrollEl: () => HTMLElement | undefined) {
	$effect(() => {
		if (!tapped || tapped.path !== path) return;
		if (recordingsStore.search.trim()) {
			recordingsStore.setSearch('');
			return;
		}
		getScrollEl()?.scrollTo({ top: 0, behavior: 'smooth' });
	});
}
