// Same lightness/chroma steps as the default coral accent, hue swapped per user.
const STEPS: Record<string, [lightness: number, chroma: number]> = {
	'50': [97, 0.02],
	'100': [93, 0.05],
	'400': [75, 0.15],
	'500': [69, 0.17],
	'600': [60, 0.17],
	'700': [50, 0.16]
};

const CACHE_KEY = 'recoral-accent-hue';

export const ACCENT_PRESETS: { name: string; hue: number }[] = [
	{ name: 'Coral', hue: 26 },
	{ name: 'Amber', hue: 70 },
	{ name: 'Lime', hue: 130 },
	{ name: 'Teal', hue: 180 },
	{ name: 'Blue', hue: 250 },
	{ name: 'Indigo', hue: 280 },
	{ name: 'Purple', hue: 305 },
	{ name: 'Pink', hue: 345 }
];

export function applyAccentHue(hue: number) {
	const root = document.documentElement;
	for (const [step, [l, c]] of Object.entries(STEPS)) {
		root.style.setProperty(`--accent-${step}`, `oklch(${l}% ${c} ${hue})`);
	}
}

// Remembers the last known "correct" hue (a user's own color, or the admin's
// pinned login-page default) so the next page load can apply it in app.html
// before hydration, instead of flashing a random or default color first.
export function cacheAccentHue(hue: number | null) {
	if (hue === null) localStorage.removeItem(CACHE_KEY);
	else localStorage.setItem(CACHE_KEY, String(hue));
}

export function readCachedAccentHue(): number | null {
	const raw = localStorage.getItem(CACHE_KEY);
	if (raw === null) return null;
	const hue = Number(raw);
	return Number.isFinite(hue) ? hue : null;
}
