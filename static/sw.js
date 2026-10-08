/*
 * Stargrass offline shell.
 *
 * The app is fully prerendered by adapter-static, so once one page has loaded
 * on wifi every file it needs is already in the cache and nothing else is
 * required. Hashed asset filenames change on every build, so they are cached
 * as they are requested rather than listed here. Only the stable entry points
 * are precached up front.
 */

const CACHE = 'stargrass-v1';

const PRECACHE = ['/', '/index.html', '/prepare.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) =>
			// addAll rejects as a group, so one wrong path would leave the app
			// with no cache at all. Add each entry on its own and let a missing
			// one fail quietly.
			Promise.all(
				PRECACHE.map((url) =>
					cache.match(url).then((hit) => (hit !== undefined ? undefined : cache.add(url).catch(() => undefined)))
				)
			).then(() => self.skipWaiting())
		)
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

/*
 * A first visit loads its own assets over the network before this worker is
 * controlling anything, so those requests never pass through the fetch
 * handler and never reach the cache. The page sends us the list of everything
 * it loaded and we fetch it into the cache deliberately, which is what makes
 * a single visit on wifi enough for airplane mode.
 */
self.addEventListener('message', (event) => {
	const data = event.data;
	if (data === null || typeof data !== 'object') return;
	if (data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;

	event.waitUntil(
		caches.open(CACHE).then((cache) =>
			Promise.all(
				data.urls.map((url) =>
					cache.match(url).then((hit) => {
						if (hit !== undefined) return undefined;
						return fetch(new Request(url, { cache: 'reload' }))
							.then((response) => (response.ok ? cache.put(url, response) : undefined))
							.catch(() => undefined);
					})
				)
			)
		)
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;

	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// Pages are network first so a redeploy is picked up, with the cache as
	// the fallback that makes airplane mode work.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(request, copy));
					return response;
				})
				.catch(async () => {
					const cache = await caches.open(CACHE);
					return (await cache.match(request)) ?? (await cache.match('/index.html'));
				})
		);
		return;
	}

	// Everything else is content addressed, so cache first is safe and fast.
	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached !== undefined) return cached;
			return fetch(request).then((response) => {
				if (response.ok && response.type === 'basic') {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(request, copy));
				}
				return response;
			});
		})
	);
});