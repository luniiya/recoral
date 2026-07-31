// Whether a recording detail/live-recording panel is currently open on one of
// the list+detail pages (Recordings/Favourites/Archive). The main layout
// reads this to auto-collapse the primary Sidebar on desktop widths that are
// too narrow to fit sidebar + list rail + detail panel side by side without
// cramping the detail view, see (app)/(main)/+layout.svelte.
let open = $state(false);

export const detailPanelStore = {
	get open() {
		return open;
	},
	set(value: boolean) {
		open = value;
	}
};
