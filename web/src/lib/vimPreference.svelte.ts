import { vimZone } from './vimZone.svelte';

// Whether vim-style navigation is allowed to activate at all, a persisted
// user preference (Settings > Appearance), distinct from vimZone.enabled
// (the current session's actual on/off state, toggled by pressing a nav key
// or Escape). Defaults to true: the feature is entirely passive until
// someone actually presses j/k/l/h/g/G, so leaving it on doesn't change
// anything about how the app behaves for someone who never touches those
// keys. This toggle exists for the person who'd rather it never trigger at
// all, e.g. if they use those letters for something else.
const STORAGE_KEY = 'recoral-vim-nav-allowed';

let allowed = $state(true);

function init() {
	const stored = localStorage.getItem(STORAGE_KEY);
	allowed = stored === null ? true : stored === 'true';
}

function set(value: boolean) {
	allowed = value;
	localStorage.setItem(STORAGE_KEY, String(value));
	// Turning this off mid-session while it happens to be active right now
	// should actually stop it immediately, not just block the *next* attempt
	// to turn it on.
	if (!value) vimZone.disable();
}

export const vimPreference = {
	get allowed() {
		return allowed;
	},
	init,
	set
};
