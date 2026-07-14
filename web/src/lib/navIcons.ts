// Single source for the icon paths shared between the desktop Sidebar and
// the mobile bottom nav / Library hub, so they can't silently drift apart.
export interface NavIcon {
	path: string;
	stroke: boolean;
}

export const navIcons = {
	recordings: {
		path: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z',
		stroke: false
	},
	favourites: {
		path: 'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
		stroke: true
	},
	tags: {
		path: 'M20.59 13.41 12 4.83A2 2 0 0 0 10.59 4.24L4 4a1 1 0 0 0-1 1l.24 6.59a2 2 0 0 0 .59 1.41l8.58 8.59a2 2 0 0 0 2.83 0l5.35-5.35a2 2 0 0 0 0-2.83ZM7.5 9A1.5 1.5 0 1 1 7.5 6a1.5 1.5 0 0 1 0 3Z',
		stroke: false
	},
	archive: {
		path: 'M4 4h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 6h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9Zm4.5 3a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2h-5Z',
		stroke: false
	},
	bin: {
		path: 'M4 7h16M9 7V4h6v3m-8 0 .8 12.4a2 2 0 0 0 2 1.6h4.4a2 2 0 0 0 2-1.6L18 7',
		stroke: true
	},
	// Well-known "folder" outline shape (not hand-drawn), safe bet for an icon
	// nobody can preview-render ahead of time.
	library: {
		path: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
		stroke: true
	}
} satisfies Record<string, NavIcon>;
