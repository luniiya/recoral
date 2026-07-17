// Multi-select mode for the recordings list (Recordings/Favourites/Archive
// all share RecordingCard, so this one store covers all three, and the
// bulk-action toolbar lives in (main)/+layout.svelte's header since that's
// shared across those pages too). Not gated to native, this is desktop and
// mobile web as much as the app.
let selectedIds = $state<string[]>([]);

function isSelected(id: string) {
	return selectedIds.includes(id);
}

function enter(id: string) {
	selectedIds = [id];
}

function toggle(id: string) {
	selectedIds = isSelected(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
}

function clear() {
	selectedIds = [];
}

export const selectionStore = {
	get selectedIds() {
		return selectedIds;
	},
	get active() {
		return selectedIds.length > 0;
	},
	get count() {
		return selectedIds.length;
	},
	isSelected,
	enter,
	toggle,
	clear
};
