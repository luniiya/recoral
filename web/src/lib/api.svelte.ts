// Empty string means same-origin (the desktop webUI's normal behavior,
// unchanged): '/api/...' resolves against whatever origin served the page.
// On mobile this gets set to the server URL the user picked at setup, since
// the app itself is loaded from a bundled local WebView, not from a server.
const STORAGE_KEY = 'recoral_api_base_url';

function readStoredBaseUrl(): string {
	if (typeof localStorage === 'undefined') return '';
	return localStorage.getItem(STORAGE_KEY) ?? '';
}

let baseUrl = $state(readStoredBaseUrl());

function setBaseUrl(url: string | null) {
	const trimmed = url?.trim().replace(/\/+$/, '') || null;
	baseUrl = trimmed ?? '';
	if (typeof localStorage === 'undefined') return;
	if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
	else localStorage.removeItem(STORAGE_KEY);
}

function apiUrl(path: string): string {
	return `${baseUrl}${path}`;
}

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	return fetch(apiUrl(path), init);
}

export const api = {
	get baseUrl() {
		return baseUrl;
	},
	setBaseUrl,
	url: apiUrl,
	fetch: apiFetch
};
