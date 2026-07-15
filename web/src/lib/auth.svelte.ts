import type { User } from '@recoral/shared';
import { applyAccentHue, cacheAccentHue } from './accent';
import { api } from './api.svelte';
import { readLocalCache, writeLocalCache } from './localCache';

// Cached alongside the token so a native app opened with no network at all
// (local-first mobile's whole point) starts out logged in with last-known
// account info instead of bouncing to a login screen there'd be no way to
// actually submit while offline anyway.
const CACHED_USER_KEY = 'recoral_cached_user';

function cacheUser(next: User | null) {
	if (next) writeLocalCache(CACHED_USER_KEY, next);
	else if (typeof localStorage !== 'undefined') localStorage.removeItem(CACHED_USER_KEY);
}

let user = $state<User | null>(readLocalCache<User | null>(CACHED_USER_KEY, null));
let loading = $state(true);

function setUser(next: User | null) {
	user = next;
	cacheUser(next);
	applyAccentHue(next?.accentHue ?? 26);
	if (next) cacheAccentHue(next.accentHue);
}

async function refresh() {
	loading = true;
	try {
		const res = await api.fetch('/api/auth/me', { credentials: 'include' });
		if (res.ok) {
			setUser(await res.json());
		} else if (res.status === 401) {
			// Server explicitly says this session is invalid, a real logout.
			setUser(null);
		}
		// Any other non-ok response: leave the cached user alone rather than
		// logging out over a transient server error.
	} catch {
		// Couldn't reach the server at all. Stay logged in with whatever's
		// cached rather than forcing a login screen there'd be no way to
		// actually use offline anyway.
	} finally {
		loading = false;
	}
}

// Mobile, before a server is picked: there's nothing to check yet, but the
// loading gate still needs to clear or the whole app stays stuck behind a
// permanent "Loading…" screen, including the setup picker itself.
function skipRefresh() {
	loading = false;
}

async function submit(path: string, body: Record<string, unknown>) {
	const res = await api.fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body)
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
	const { token, ...userData } = data as User & { token?: string };
	if (token) api.setToken(token);
	setUser(userData as User);
}

async function login(identifier: string, password: string) {
	await submit('/api/auth/login', { identifier, password });
}

async function register(username: string, password: string, email: string, accentHue: number) {
	await submit('/api/auth/register', { username, password, email: email || null, accentHue });
}

async function updateAccount(updates: { accentHue?: number; avatar?: string | null }) {
	const res = await api.fetch('/api/account', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(updates)
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
	setUser(data as User);
}

async function logout() {
	await api.fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
	api.setToken(null);
	setUser(null);
}

export const auth = {
	get user() {
		return user;
	},
	get loading() {
		return loading;
	},
	refresh,
	skipRefresh,
	login,
	register,
	updateAccount,
	logout
};
