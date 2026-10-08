import type { Place } from '#lib/sky/observer';

export type PlaceSource = 'gps' | 'manual' | 'default';

export interface SavedPlace {
	place: Place;
	source: PlaceSource;
}

const STORAGE_KEY = 'stargrass.place';

/**
 * SvelteKit 3 removed $app/environment, and every caller here runs from
 * onMount or an event handler, so the page can never be server rendering
 * when these functions are reached.
 */
const isBrowser = (): boolean => typeof window !== 'undefined';

/**
 * A place is a couple of numbers, so localStorage is the right tool for it.
 * Model weights never come near this file: those belong in IndexedDB or the
 * Cache API, and the browser can evict them from localStorage.
 */
export function loadPlace(): SavedPlace | null {
	if (!isBrowser()) return null;
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === null) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<SavedPlace>;
		const place = parsed.place;
		if (
			typeof place?.lat !== 'number' ||
			typeof place?.lon !== 'number' ||
			typeof place?.elevation !== 'number'
		) {
			return null;
		}
		if (!isValidPlace(place)) return null;
		const source: PlaceSource =
			parsed.source === 'gps' || parsed.source === 'manual' ? parsed.source : 'manual';
		return {
			place: { lat: place.lat, lon: place.lon, elevation: place.elevation },
			source
		};
	} catch {
		return null;
	}
}

export function savePlace(saved: SavedPlace): void {
	if (!isBrowser()) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function isValidPlace(place: Place): boolean {
	return (
		Number.isFinite(place.lat) &&
		Number.isFinite(place.lon) &&
		Number.isFinite(place.elevation) &&
		Math.abs(place.lat) <= 90 &&
		Math.abs(place.lon) <= 180
	);
}

export type GeoOutcome = { ok: true; place: Place; error: null } | { ok: false; place: null; error: string };

/**
 * One geolocation request. We never watch the position, so this does not
 * keep the location sensor running once the answer is in.
 */
export function requestGps(): Promise<GeoOutcome> {
	return new Promise((resolve) => {
		if (!isBrowser() || !('geolocation' in navigator)) {
			resolve({ ok: false, place: null, error: 'This device has no location service.' });
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const place: Place = {
					lat: position.coords.latitude,
					lon: position.coords.longitude,
					elevation: position.coords.altitude ?? 0
				};
				if (!isValidPlace(place)) {
					resolve({
						ok: false,
						place: null,
						error: 'The device returned an unusable position.'
					});
					return;
				}
				resolve({ ok: true, place, error: null });
			},
			(error) => resolve({ ok: false, place: null, error: describeGeoError(error) }),
			{ enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 }
		);
	});
}

function describeGeoError(error: GeolocationPositionError): string {
	switch (error.code) {
		case error.PERMISSION_DENIED:
			return 'Location permission was declined. Enter your coordinates by hand.';
		case error.POSITION_UNAVAILABLE:
			return 'No position is available here. Enter your coordinates by hand.';
		case error.TIMEOUT:
			return 'The location request timed out. Enter your coordinates by hand.';
		default:
			return 'Location failed. Enter your coordinates by hand.';
	}
}