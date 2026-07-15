// Small shared helper for "show the last-known value immediately, refresh
// from the server when possible" stores (auth, recordings, tags), so a
// native app opened with no network shows what it last saw rather than an
// empty/logged-out state there'd be no way to fix without network anyway.
export function readLocalCache<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	const raw = localStorage.getItem(key);
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function writeLocalCache<T>(key: string, value: T) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage full or unavailable, not worth failing over
	}
}
