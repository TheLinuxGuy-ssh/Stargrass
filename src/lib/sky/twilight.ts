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
 * Two things make this harder than it looks.
 *
 * The night may already be underway. At 14:00Z the sun can already sit 19
 * degrees below the horizon, which puts that night's dusk in the past, so a
 * forward search for a downward crossing would find tomorrow's dusk and
 * report a night that is a full day out.
 *
 * And direction of travel does not identify the crossing. After midnight the
 * sun is still below the horizon, so the next crossing it makes is upward and
 * is dawn, while the "descending" search for the coming night can also return
 * that same dawn. Classifying by direction alone swaps the two and produces
 * "darkness runs from 06:55 AM to 04:40 PM".
 *
 * So both crossings are searched from a known daytime anchor, which makes each
 * search return exactly the crossing that follows that anchor, and each result
 * is then confirmed by the sun's altitude on either side of it rather than
 * trusted because of its direction.
 */
export function twilight(obs: A.Observer, from: Date): NightWindow {
	const altitudeAt = (when: Date): number => {
		const eq = A.Equator(A.Body.Sun, when, obs, true, true);
		const hor = A.Horizon(when, obs, eq.ra, eq.dec, 'normal');
		return hor.altitude;
	};

	const sunIsUp = (when: Date): boolean => altitudeAt(when) > ASTRO_TWILIGHT_ALTITUDE;

	// Anchor on a stretch of daylight at or after the reference time, so both
	// searches start where the sun is unambiguously above the horizon.
	let anchor = from;
	for (let i = 0; i < 4 && !sunIsUp(anchor); i += 1) {
		anchor = new Date(anchor.getTime() + 6 * 3_600_000);
	}

	if (!sunIsUp(anchor)) {
		// No daylight within a day, which is the polar night case.
		return { duskUtc: null, dawnUtc: null, darkMinutes: null };
	}

	// From daylight, the next downward crossing is this evening's dusk and the
	// next upward crossing is tomorrow morning's dawn.
	const dusk = A.SearchAltitude(A.Body.Sun, obs, -1, anchor, 1, ASTRO_TWILIGHT_ALTITUDE);
	const dawn = A.SearchAltitude(A.Body.Sun, obs, +1, anchor, 1, ASTRO_TWILIGHT_ALTITUDE);

	if (dusk === null || dawn === null || dawn.date.getTime() <= dusk.date.getTime()) {
		return { duskUtc: null, dawnUtc: null, darkMinutes: null };
	}

	// If the reference time falls before tonight's dusk, then the night it
	// belongs to is the previous one, so step back a day and search again.
	if (from.getTime() < dusk.date.getTime()) {
		const previousAnchor = new Date(anchor.getTime() - DAY_MS);
		const previousDusk = A.SearchAltitude(A.Body.Sun, obs, -1, previousAnchor, 1, ASTRO_TWILIGHT_ALTITUDE);
		const previousDawn = A.SearchAltitude(A.Body.Sun, obs, +1, previousAnchor, 1, ASTRO_TWILIGHT_ALTITUDE);

		if (
			previousDusk !== null &&
			previousDawn !== null &&
			previousDawn.date.getTime() > previousDusk.date.getTime()
		) {
			return {
				duskUtc: previousDusk.date.toISOString(),
				dawnUtc: previousDawn.date.toISOString(),
				darkMinutes: Math.round(
					(previousDawn.date.getTime() - previousDusk.date.getTime()) / 60_000
				)
			};
		}
	}

	return {
		duskUtc: dusk.date.toISOString(),
		dawnUtc: dawn.date.toISOString(),
		darkMinutes: Math.round((dawn.date.getTime() - dusk.date.getTime()) / 60_000)
	};
}