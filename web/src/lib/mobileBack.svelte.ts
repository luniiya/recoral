// Hardware/gesture back button on Android has nothing to "go back" to when a
// detail panel is open (it's local component state, not a route change), so
// Capacitor's default behavior falls through to exiting the app. Pages with a
// closeable panel register a handler here while it's open; the root layout's
// backButton listener calls it instead of exiting.
let handler = $state<(() => void) | null>(null);

function set(fn: () => void) {
	handler = fn;
}

function clear() {
	handler = null;
}

export const mobileBack = {
	get handler() {
		return handler;
	},
	set,
	clear
};
