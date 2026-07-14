import { isNativePlatform } from './platform';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'recoral-theme';
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

let preference = $state<ThemePreference>('system');

function prefersDark() {
	return matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePreference): 'light' | 'dark' {
	return pref === 'system' ? (prefersDark() ? 'dark' : 'light') : pref;
}

// Status bar icons default to light (made for a dark app background), which
// is invisible against this app's white light-mode background. Overlay stays
// on (not opaque, doesn't push content down), only the icon color changes.
async function syncStatusBar(resolved: 'light' | 'dark') {
	if (!isNativePlatform()) return;
	const { StatusBar, Style } = await import('@capacitor/status-bar');
	await StatusBar.setOverlaysWebView({ overlay: true });
	await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
}

function applyClass(pref: ThemePreference) {
	const resolved = resolve(pref);
	document.documentElement.classList.toggle('dark', resolved === 'dark');
	syncStatusBar(resolved);
}

function set(pref: ThemePreference) {
	preference = pref;
	if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
	else localStorage.setItem(STORAGE_KEY, pref);
	applyClass(pref);
}

function init() {
	const stored = localStorage.getItem(STORAGE_KEY);
	preference = stored === 'light' || stored === 'dark' ? stored : 'system';
	applyClass(preference);

	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (preference === 'system') applyClass('system');
	});
}

function cycle() {
	set(ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]);
}

export const themeStore = {
	get preference() {
		return preference;
	},
	init,
	set,
	cycle
};
