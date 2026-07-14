// Empty string means same-origin (the desktop webUI's normal behavior,
// unchanged): '/api/...' resolves against whatever origin served the page.
// On mobile this gets set to the server URL the user picked at setup, since
// the app itself is loaded from a bundled local WebView, not from a server.
const BASE_URL_STORAGE_KEY = 'recoral_api_base_url';

function readStoredBaseUrl(): string {
	if (typeof localStorage === 'undefined') return '';
	return localStorage.getItem(BASE_URL_STORAGE_KEY) ?? '';
}

let baseUrl = $state(readStoredBaseUrl());

function setBaseUrl(url: string | null) {
	const trimmed = url?.trim().replace(/\/+$/, '') || null;
	baseUrl = trimmed ?? '';
	if (typeof localStorage === 'undefined') return;
	if (trimmed) localStorage.setItem(BASE_URL_STORAGE_KEY, trimmed);
	else localStorage.removeItem(BASE_URL_STORAGE_KEY);
}

// Session cookies only work same-origin (desktop, unaffected). Cross-origin
// requests (mobile, a genuinely different origin than the app itself) can't
// rely on SameSite=Lax cookies being sent, so auth also works via a bearer
// token captured from login/register and attached to every request here.
// Desktop ends up storing one too, harmless, the server accepts either.
const TOKEN_STORAGE_KEY = 'recoral_session_token';

function readStoredToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_STORAGE_KEY);
}

let token = $state<string | null>(readStoredToken());

function setToken(next: string | null) {
	token = next;
	if (typeof localStorage === 'undefined') return;
	if (next) localStorage.setItem(TOKEN_STORAGE_KEY, next);
	else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function apiUrl(path: string): string {
	return `${baseUrl}${path}`;
}

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	if (!token) return fetch(apiUrl(path), init);
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${token}`);
	return fetch(apiUrl(path), { ...init, headers });
}

export const api = {
	get baseUrl() {
		return baseUrl;
	},
	get token() {
		return token;
	},
	setBaseUrl,
	setToken,
	url: apiUrl,
	fetch: apiFetch
};
