const STORAGE_KEY = 'recoral-wavy-seek';

let enabled = $state(false);

function init() {
	const stored = localStorage.getItem(STORAGE_KEY);
	enabled = stored === null ? false : stored === 'true';
}

function set(value: boolean) {
	enabled = value;
	localStorage.setItem(STORAGE_KEY, String(value));
}

export const wavySeekStore = {
	get enabled() {
		return enabled;
	},
	init,
	set
};
