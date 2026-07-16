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
	const [l500, c500] = STEPS['500'];
	currentAccentHex = oklchToHex(l500, c500, hue);
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

function srgbToLinear(channel: number): number {
	const c = channel / 255;
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Android's Material You system accent color (see systemAccent.svelte.ts)
// comes back as an arbitrary sRGB hex, but the rest of the app only ever
// varies accent by *hue* through the fixed lightness/chroma steps above, same
// as the custom-hue picker. So this only needs to extract the hue angle, via
// the standard sRGB -> linear -> OKLab conversion (Björn Ottosson's published
// matrices), not reproduce the system color's own lightness/chroma exactly.
export function hexToOklchHue(hex: string): number | null {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) return null;
	const int = parseInt(match[1], 16);
	const r = srgbToLinear((int >> 16) & 255);
	const g = srgbToLinear((int >> 8) & 255);
	const b = srgbToLinear(int & 255);

	const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

	const l_ = Math.cbrt(l);
	const m_ = Math.cbrt(m);
	const s_ = Math.cbrt(s);

	const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
	const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

	const hueDeg = (Math.atan2(bLab, a) * 180) / Math.PI;
	return hueDeg < 0 ? hueDeg + 360 : hueDeg;
}

function linearToSrgb(channel: number): number {
	const c = Math.min(1, Math.max(0, channel));
	return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// The inverse of hexToOklchHue above, at the accent-500 step's own
// lightness/chroma: needed to hand the Android media notification (which
// wants a plain ARGB color int, not a CSS custom property) the same accent
// color the rest of the app is using, see nativePlayback.ts.
export function oklchToHex(lightnessPct: number, chroma: number, hueDeg: number): string {
	const L = lightnessPct / 100;
	const hueRad = (hueDeg * Math.PI) / 180;
	const a = chroma * Math.cos(hueRad);
	const b = chroma * Math.sin(hueRad);

	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;

	const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const bChannel = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

	const toHex = (c: number) =>
		Math.round(linearToSrgb(c) * 255)
			.toString(16)
			.padStart(2, '0');

	return `#${toHex(r)}${toHex(g)}${toHex(bChannel)}`;
}

// The current accent-500 as a plain hex, kept in sync by applyAccentHue()
// below, for native code that needs a real color int rather than a CSS
// custom property (the Android media notification, see nativePlayback.ts).
let currentAccentHex = '#e2664a';

export function getAccentColorHex(): string {
	return currentAccentHex;
}
