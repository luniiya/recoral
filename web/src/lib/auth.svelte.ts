import type { User } from '@recoral/shared';
import { api } from './api.svelte';
import { bootLog } from './bootLog';
import { readLocalCache, writeLocalCache } from './localCache';
import { isNativePlatform } from './platform';

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
// Only true when there's genuinely nothing to show yet (first-ever login on
// this device/browser). A cached user means the app renders instantly with
// that stale-but-usable state while refresh() reconciles with the server in
// the background, same "cache first, reconcile after" treatment tags and
// recordings already get, rather than blocking the entire app behind a
// network round trip that (confirmed via bootLog while chasing the
// slow-loading bug) can take anywhere from milliseconds to minutes when the
// server is unreachable, since nothing timed it out.
let loading = $state(user === null);

// Doesn't apply the accent itself: the root layout's effect owns that,
// since the effective hue also depends on systemAccentStore (Android system
// color can override the user's own accentHue), which this module doesn't
// know about.
function setUser(next: User | null) {
	user = next;
	cacheUser(next);
}

async function refresh() {
	// Only block rendering when there's no cached user to show meanwhile, see
	// the comment on `loading`'s declaration above. A background reconcile
	// (there's already a user shown) must never flip this back to true, or
	// every refresh would blank the whole app again.
	const hadUser = user !== null;
	if (!hadUser) loading = true;
	const startedAt = Date.now();
	bootLog('auth.refresh: start, baseUrl =', JSON.stringify(api.baseUrl) || '(same-origin)');

	// Diagnostic only, see bootLog.ts: distinguishes "device has no network at
	// all" from "device is online but the server specifically isn't
	// responding", which look identical from a plain fetch() rejection alone.
	if (isNativePlatform()) {
		try {
			const { Network } = await import('@capacitor/network');
			const status = await Network.getStatus();
			bootLog('auth.refresh: device network status =', JSON.stringify(status));
		} catch (err) {
			bootLog('auth.refresh: could not read device network status:', err);
		}
	}

	try {
		// Bounded so a background reconcile against an unreachable server
		// settles in a predictable ~8s (matching the setup page's own
		// server-check timeout) instead of however long the OS network stack
		// takes to give up on its own, confirmed to range from milliseconds to
		// over two minutes.
		const res = await api.fetch('/api/auth/me', { credentials: 'include', signal: AbortSignal.timeout(8000) });
		if (res.ok) {
			setUser(await res.json());
			bootLog(`auth.refresh: ok, logged in (${Date.now() - startedAt}ms total)`);
		} else if (res.status === 401) {
			// Server explicitly says this session is invalid, a real logout.
			setUser(null);
			bootLog(`auth.refresh: 401, session invalid (${Date.now() - startedAt}ms total)`);
		} else {
			bootLog(`auth.refresh: unexpected status ${res.status}, keeping cached user (${Date.now() - startedAt}ms total)`);
		}
		// Any other non-ok response: leave the cached user alone rather than
		// logging out over a transient server error.
	} catch (err) {
		// Couldn't reach the server at all. Stay logged in with whatever's
		// cached rather than forcing a login screen there'd be no way to
		// actually use offline anyway.
		bootLog(`auth.refresh: unreachable, keeping cached user (${Date.now() - startedAt}ms total):`, err);
	} finally {
		loading = false;
		bootLog(`auth.refresh: done, loading = false (${Date.now() - startedAt}ms total)`);
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

async function updateAccount(updates: {
	accentHue?: number;
	avatar?: string | null;
	username?: string;
	email?: string | null;
	password?: string;
	currentPassword?: string;
}) {
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

function logout() {
	// Telling the server is best-effort and must never block clearing the
	// local session, which has to work instantly even fully offline (this was
	// exactly the "sign out button does nothing offline" bug: the old code
	// awaited this call first, so an unreachable server just hung forever
	// with no timeout). Fired before setToken(null) below so the request
	// still captures the real Authorization header while it's building, not
	// after it's already been cleared.
	api
		.fetch('/api/auth/logout', { method: 'POST', credentials: 'include', signal: AbortSignal.timeout(8000) })
		.catch(() => {
			// Couldn't reach the server to invalidate the session there.
			// Nothing more to do locally, already logged out below regardless.
		});
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
