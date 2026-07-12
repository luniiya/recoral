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

function applyClass(pref: ThemePreference) {
	document.documentElement.classList.toggle('dark', resolve(pref) === 'dark');
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
	cycle
};
