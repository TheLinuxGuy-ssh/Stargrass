import { describe, expect, it } from 'vitest';
import swText from '/static/sw.js?raw';
import pageText from '/src/routes/+page.svelte?raw';
import { CACHE_NAME } from './offline.js';

/**
 * The service worker and the app shell have to agree on which URLs exist, and
 * a bare static file server cannot tell you that. Vercel serves a prerendered
 * route at its extensionless path and answers 404 for the .html file, while
 * Python's http.server does the exact opposite. Getting this wrong produced a
 * 404 on the live site that every local test had missed, so the paths are
 * pinned here instead.
 */
describe('service worker precache paths', () => {
	it('precaches the prepare route at its extensionless path', () => {
		expect(swText).toContain("'/prepare'");
		expect(swText).not.toContain("'/prepare.html'");
	});

	it('precaches both forms of the root, since the navigate fallback uses one', () => {
		expect(swText).toContain("'/'");
		expect(swText).toContain("'/index.html'");
	});

	it('keeps the cache name in step with the app code', () => {
		expect(swText).toContain(CACHE_NAME);
	});
});

describe('the deployed routes', () => {
	it('links to the extensionless prepare route', () => {
		expect(pageText).toContain('href="/prepare"');
		expect(pageText).not.toContain('href="/prepare.html"');
	});
});
