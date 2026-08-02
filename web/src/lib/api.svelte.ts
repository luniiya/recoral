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

// Same dev-only gating as bootLog.ts (dead-code-eliminated from production
// builds), so a real user's console isn't full of every request/response
// this app ever makes.
function apiLog(...args: unknown[]) {
	if (import.meta.env.DEV) console.log(...args);
}

// Diagnostic only, see bootLog.ts: every request through this wrapper
// (which is all of them, this is the only place fetch() gets called against
// the API) is timed and its outcome logged, so a hang or a slow server is
// visible without guessing. No timeout is applied here yet, deliberately,
// so the logs first show how long an unreachable server actually takes to
// fail on its own before deciding what timeout value would even make sense.
async function timedFetch(path: string, init: RequestInit): Promise<Response> {
	const url = apiUrl(path);
	const startedAt = Date.now();
	apiLog(`[api] -> ${init.method ?? 'GET'} ${url}`);
	try {
		const res = await fetch(url, init);
		apiLog(`[api] <- ${init.method ?? 'GET'} ${url} ${res.status} (${Date.now() - startedAt}ms)`);
		return res;
	} catch (err) {
		const kind = err instanceof DOMException && err.name === 'AbortError' ? 'aborted' : 'network error';
		apiLog(`[api] xx ${init.method ?? 'GET'} ${url} ${kind} after ${Date.now() - startedAt}ms:`, err);
		throw err;
	}
}

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	if (!token) return timedFetch(path, init);
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bearer ${token}`);
	return timedFetch(path, { ...init, headers });
}

// fetch() still has no reliable cross-browser way to observe upload (request
// body) progress, only download progress via the response stream, so a real
// "X% uploaded" indicator for a large file needs XMLHttpRequest specifically,
// the one place in the app that still reaches for it. Wraps the XHR response
// back into a real Response so every existing `res.ok`/`res.json()` call site
// (identical to what timedFetch already returns) keeps working unchanged.
function uploadWithProgress(
	path: string,
	form: FormData,
	opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}
): Promise<Response> {
	const url = apiUrl(path);
	apiLog(`[api] -> POST ${url} (upload)`);
	const startedAt = Date.now();
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', url);
		if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
		xhr.withCredentials = true;
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
		};
		xhr.onload = () => {
			apiLog(`[api] <- POST ${url} ${xhr.status} (${Date.now() - startedAt}ms, upload)`);
			resolve(new Response(xhr.response, { status: xhr.status, statusText: xhr.statusText }));
		};
		xhr.onerror = () => {
			apiLog(`[api] xx POST ${url} network error after ${Date.now() - startedAt}ms (upload)`);
			reject(new TypeError('Network error'));
		};
		xhr.onabort = () => {
			apiLog(`[api] xx POST ${url} aborted after ${Date.now() - startedAt}ms (upload)`);
			reject(new DOMException('The upload was aborted', 'AbortError'));
		};
		if (opts.signal) {
			if (opts.signal.aborted) {
				xhr.abort();
				return;
			}
			opts.signal.addEventListener('abort', () => xhr.abort());
		}
		xhr.send(form);
	});
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
	fetch: apiFetch,
	uploadWithProgress
};
