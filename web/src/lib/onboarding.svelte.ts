import { api } from './api.svelte';
import { isNativePlatform } from './platform';

// Only meaningful on mobile: the desktop webUI always talks to its own
// origin, so there's nothing to pick. Persisted so the choice sticks across
// app restarts, exactly once, not re-asked every launch.
const STORAGE_KEY = 'recoral_onboarding_mode';
type OnboardingMode = 'server' | 'offline';

function readStored(): OnboardingMode | null {
	if (typeof localStorage === 'undefined') return null;
	const value = localStorage.getItem(STORAGE_KEY);
	return value === 'server' || value === 'offline' ? value : null;
}

let mode = $state<OnboardingMode | null>(readStored());

function completeWithServer(serverUrl: string) {
	api.setBaseUrl(serverUrl);
	mode = 'server';
	if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'server');
}

function completeOffline() {
	mode = 'offline';
	if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'offline');
}

function reset() {
	mode = null;
	api.setBaseUrl(null);
	if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}

export const onboarding = {
	get mode() {
		return mode;
	},
	get needsSetup() {
		return isNativePlatform() && mode === null;
	},
	completeWithServer,
	completeOffline,
	reset
};
