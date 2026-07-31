// Whether focus is currently inside a text field, app-wide. Used both to
// gate vimNav.svelte.ts's j/k/l/h shortcuts (never fire while actually
// typing a title/description/search) and to drive VimModeIndicator's little
// NORMAL/INSERT easter egg. Tracked once here via focusin/focusout (see
// routes/+layout.svelte), rather than duplicated per page.
let isTyping = $state(false);

export const vimMode = {
	get isTyping() {
		return isTyping;
	},
	set(value: boolean) {
		isTyping = value;
	}
};
