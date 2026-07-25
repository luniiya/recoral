// Shared (not local component state) so the hardware/gesture back-button
// priority chain in listBack.svelte.ts can close this before anything else,
// the same way it already does for an open detail panel or an active search.
let open = $state(false);

function set(value: boolean) {
	open = value;
}

export const filterPanelStore = {
	get open() {
		return open;
	},
	set
};
