import { filterPanelStore } from './filterPanel.svelte';
import { mobileBack } from './mobileBack.svelte';
import { recordingsStore } from './recordings.svelte';
import { selectionStore } from './selection.svelte';

// Shared by every list+detail page (Recordings, Favourites, Archive): the
// hardware/gesture back button should close the filter dialog first (it's
// the topmost thing on screen when open), then exit multi-select mode, then
// close an open detail panel, then clear an active search, before ever
// falling through to Capacitor's default (leave the page / exit the app).
// Same priority order as tapping the already-active bottom-nav tab, see
// tabTap.svelte.ts.
export function useListBackHandler(getSelectedId: () => string | null, closeSelected: () => void) {
	$effect(() => {
		if (filterPanelStore.open) mobileBack.set(() => filterPanelStore.set(false));
		else if (selectionStore.active) mobileBack.set(() => selectionStore.clear());
		else if (getSelectedId()) mobileBack.set(closeSelected);
		else if (recordingsStore.search.trim()) mobileBack.set(() => recordingsStore.setSearch(''));
		else mobileBack.clear();
		return () => mobileBack.clear();
	});
}
