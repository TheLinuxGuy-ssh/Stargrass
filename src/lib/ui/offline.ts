/**
 * Makes the app usable with no signal after a single visit on wifi.
 *
 * A service worker cannot cache the assets of the visit that installs it,
 * because those requests are already in flight before it is in control. So
 * the page reports everything it actually loaded and the worker fetches those
 * URLs into the cache on purpose.
 */

export type OfflineState = 'unsupported' | 'preparing' | 'ready' | 'failed';

function loadedUrls(): string[] {
	const urls = new Set<string>([location.origin + '/']);

	for (const entry of performance.getEntriesByType('resource')) {
		if (!entry.name.startsWith(location.origin)) continue;
		// Only shell assets. Anything fetched with fetch() is data the app
		// re-requests when it needs it.
		const initiator = (entry as PerformanceResourceTiming).initiatorType;
		if (initiator === 'fetch' || initiator === 'xmlhttprequest') continue;
		urls.add(entry.name);
	}

	return [...urls];
}

function whenLoaded(): Promise<void> {
	if (document.readyState === 'complete') return Promise.resolve();
	return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}

export async function prepareOffline(): Promise<OfflineState> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';

	try {
		const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
		await navigator.serviceWorker.ready;

		await whenLoaded();

		const worker = registration.active ?? navigator.serviceWorker.controller;
		if (worker === null) return 'failed';

		// Include the shell itself so a cold offline start has something to serve.
		const urls = loadedUrls();
		worker.postMessage({ type: 'cache-urls', urls });

		// The post is fire and forget, so confirm afterwards rather than trust it.
		await confirmCached(urls);
		return 'ready';
	} catch {
		return 'failed';
	}
}

/** How many files the app has saved for offline use. Zero means not yet. */
export async function cacheCount(): Promise<number> {
	if (typeof caches === 'undefined') return 0;
	try {
		const keys = await caches.keys();
		let total = 0;
		for (const key of keys) {
			const cache = await caches.open(key);
			total += (await cache.keys()).length;
		}
		return total;
	} catch {
		return 0;
	}
}

/** Resolves once the named URLs are readable from the cache. */
async function confirmCached(urls: string[]): Promise<void> {
	const missing = urls.filter((url) => url.startsWith(location.origin));
	if (missing.length === 0) return;

	const cache = await caches.open('stargrass-v1');
	const results = await Promise.all(missing.map((url) => cache.match(url)));
	const absent = results.filter((hit) => hit === undefined).length;

	if (absent > 0) throw new Error(`${absent} of ${missing.length} files are not cached`);
}