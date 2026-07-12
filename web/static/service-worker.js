const CACHE = 'recoral-v1';

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

// Network-first with a cache fallback, so the app shell still loads offline
// once it's been opened at least once. API requests are never cached.
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				const copy = response.clone();
				caches.open(CACHE).then((cache) => cache.put(event.request, copy));
				return response;
			})
			.catch(() => caches.match(event.request))
	);
});
