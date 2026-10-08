import * as A from 'astronomy-engine';

export interface NightWindow {
	duskUtc: string | null;
	dawnUtc: string | null;
	darkMinutes: number | null;
}

const ASTRO_TWILIGHT_ALTITUDE = -18;
const DAY_MS = 86_400_000;

/**
 * Dusk and dawn of the night that contains `from`.
 *
 * The night may already be underway: at 14:00Z the sun can already sit 19
 * degrees below the horizon, which puts its dusk in the past. Searching
 * forward for a downward crossing would then find tomorrow's dusk, so we
 * start the backward search a day early when the sun is already down.
 */
export function twilight(obs: A.Observer, from: Date): NightWindow {
	const sunAltitude = A.Equator(A.Body.Sun, from, obs, true, true);
	const hor = A.Horizon(from, obs, sunAltitude.ra, sunAltitude.dec, 'normal');
	const inDarkness = hor.altitude <= ASTRO_TWILIGHT_ALTITUDE;

	const duskStart = inDarkness ? new Date(from.getTime() - DAY_MS) : from;

	const dusk = A.SearchAltitude(A.Body.Sun, obs, -1, duskStart, 1, ASTRO_TWILIGHT_ALTITUDE);
	const dawn = A.SearchAltitude(A.Body.Sun, obs, +1, from, 1, ASTRO_TWILIGHT_ALTITUDE);

	if (dusk === null || dawn === null) {
		return { duskUtc: null, dawnUtc: null, darkMinutes: null };
	}

	const duskMs = dusk.date.getTime();
	const dawnMs = dawn.date.getTime();
	if (dawnMs <= duskMs) return { duskUtc: null, dawnUtc: null, darkMinutes: null };

	return {
		duskUtc: dusk.date.toISOString(),
		dawnUtc: dawn.date.toISOString(),
		darkMinutes: Math.round((dawnMs - duskMs) / 60_000)
	};
}