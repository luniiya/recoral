import { Capacitor, registerPlugin } from '@capacitor/core';
import { hexToOklchHue } from './accent';

interface SystemColorPlugin {
	// hex is null below Android 12 (no Material You dynamic color exists) or
	// if the OEM build doesn't populate the resource for any reason, either
	// way the caller just falls back to the per-user accent, see effectiveHue.
	getAccentColor(): Promise<{ hex: string | null }>;
}

const SystemColor = registerPlugin<SystemColorPlugin>('SystemColor');

const STORAGE_KEY = 'recoral-use-system-accent';

// Defaults on: a Material Design app should follow the phone's own palette
// out of the box, matching most other Material You-aware apps, the user
// opts *out* via the toggle in Account Settings, not in.
let enabled = $state(true);
let systemHue = $state<number | null>(null);
let initialized = false;

async function init() {
	if (initialized) return;
	initialized = true;
	const stored = localStorage.getItem(STORAGE_KEY);
	enabled = stored === null ? true : stored === 'true';
	if (Capacitor.getPlatform() !== 'android') return;
	try {
		const { hex } = await SystemColor.getAccentColor();
		systemHue = hex ? hexToOklchHue(hex) : null;
	} catch {
		systemHue = null;
	}
}

function set(value: boolean) {
	enabled = value;
	localStorage.setItem(STORAGE_KEY, String(value));
}

// The Android system accent takes priority over the user's own picked color
// whenever both are available and the toggle is on (a deliberate priority
// order, see CLAUDE.md's accent-color decision), not the other way around.
function effectiveHue(userHue: number): number {
	if (enabled && systemHue !== null) return systemHue;
	return userHue;
}

export const systemAccentStore = {
	get enabled() {
		return enabled;
	},
	// Only true on Android 12+ once the native color has actually resolved,
	// used to decide whether the toggle is even worth showing in Settings.
	get available() {
		return systemHue !== null;
	},
	init,
	set,
	effectiveHue
};
