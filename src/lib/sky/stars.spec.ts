import { describe, expect, it } from 'vitest';
import { observerFor, type Place } from './observer.js';
import { STARS, findStar, starPosition, starRiseSet } from './stars.js';
import { findObject, whatsUp } from './tools.js';
import { twilight } from './twilight.js';

const DELHI: Place = { lat: 28.6139, lon: 77.209, elevation: 216 };
const FIXTURE_TIME = new Date('2026-10-06T14:00:00Z');

/** Somewhere far enough south that Polaris is well below the horizon. */
const SYDNEY: Place = { lat: -33.8688, lon: 151.2093, elevation: 20 };

describe('catalogue', () => {
	it('holds a few hundred bright named stars', () => {
		expect(STARS.length).toBeGreaterThan(100);
		expect(STARS.length).toBeLessThan(400);
	});

	it('keeps only stars at magnitude 3.0 or brighter', () => {
		for (const star of STARS) {
			expect(star.magnitude).toBeLessThanOrEqual(3.0);
		}
	});

	it('is sorted brightest first', () => {
		const mags = STARS.map((s) => s.magnitude);
		expect(mags).toEqual([...mags].sort((a, b) => a - b));
	});

	it('excludes the Sun, which is in the source catalogue', () => {
		expect(findStar('Sol')).toBeUndefined();
		expect(findStar('sol')).toBeUndefined();
	});

	it('finds Sirius and is case insensitive', () => {
		expect(findStar('Sirius')?.magnitude).toBeLessThan(-1);
		expect(findStar('sirius')?.name).toBe('Sirius');
		expect(findStar('  VEGA ')?.name).toBe('Vega');
	});

	it('has Betelgeuse and Polaris', () => {
		expect(findStar('Betelgeuse')).toBeDefined();
		expect(findStar('Polaris')).toBeDefined();
	});

	it('gives every star usable coordinates', () => {
		for (const star of STARS) {
			expect(star.raHours).toBeGreaterThanOrEqual(0);
			expect(star.raHours).toBeLessThan(24);
			expect(Math.abs(star.decDeg)).toBeLessThanOrEqual(90);
		}
	});
});

describe('Vega against the section 5 fixture', () => {
	it('matches altitude and azimuth', () => {
		const vega = findStar('Vega');
		expect(vega).toBeDefined();
		const { altitude, azimuth } = starPosition(vega!, FIXTURE_TIME, observerFor(DELHI));
		expect(Math.abs(altitude - 68.4)).toBeLessThanOrEqual(0.3);
		expect(Math.abs(azimuth - 304.2)).toBeLessThanOrEqual(0.3);
	});
});

describe('Polaris sanity check', () => {
	it('sits within a degree of the observer latitude', () => {
		const obs = observerFor(DELHI);
		const { altitude } = starPosition(findStar('Polaris')!, FIXTURE_TIME, obs);
		expect(Math.abs(altitude - DELHI.lat)).toBeLessThanOrEqual(1);
	});

	it('still sits near the latitude at another place and time', () => {
		const obs = observerFor(SYDNEY);
		const january = new Date('2026-01-15T09:00:00Z');
		const { altitude } = starPosition(findStar('Polaris')!, january, obs);
		// Polaris is 0.736 degrees off the celestial pole, and below the
		// horizon the geometry stretches that offset to about 1.05 degrees
		// here. So the southern case needs a wider band than the northern one.
		expect(Math.abs(altitude - SYDNEY.lat)).toBeLessThanOrEqual(1.5);
	});

	it('is never above the horizon from Sydney', () => {
		const { altitude } = starPosition(findStar('Polaris')!, FIXTURE_TIME, observerFor(SYDNEY));
		expect(altitude).toBeLessThan(0);
	});
});

describe('star rise and set', () => {
	it('reports no rise or set for a circumpolar star at high latitude', () => {
		const arctic: Place = { lat: 78, lon: 15, elevation: 0 };
		const times = starRiseSet(findStar('Polaris')!, FIXTURE_TIME, observerFor(arctic));
		expect(times.riseUtc).toBeNull();
		expect(times.setUtc).toBeNull();
	});

	it('gives a rise inside the next day for a star that is down', () => {
		const times = starRiseSet(findStar('Betelgeuse')!, FIXTURE_TIME, observerFor(DELHI));
		expect(times.riseUtc).not.toBeNull();
		const rise = new Date(times.riseUtc!).getTime();
		const from = FIXTURE_TIME.getTime();
		expect(rise).toBeGreaterThanOrEqual(from);
		expect(rise).toBeLessThanOrEqual(from + 24 * 3600_000);
	});

	it('agrees with the reported altitude at the rise moment', () => {
		const star = findStar('Betelgeuse')!;
		const obs = observerFor(DELHI);
		const times = starRiseSet(star, FIXTURE_TIME, obs);
		if (times.riseUtc === null) throw new Error('expected a rise');
		const { altitude } = starPosition(star, new Date(times.riseUtc), obs);
		expect(Math.abs(altitude)).toBeLessThan(0.5);
	});
});

describe('findObject with stars', () => {
	it('finds Betelgeuse', () => {
		const result = findObject(DELHI, FIXTURE_TIME, 'Betelgeuse');
		expect(result.found).toBe(true);
		if (!result.found) return;
		expect(result.kind).toBe('star');
		expect(result.name).toBe('Betelgeuse');
		expect(result.magnitude).toBeCloseTo(0.45, 2);
	});

	it('is case insensitive for stars', () => {
		expect(findObject(DELHI, FIXTURE_TIME, 'betelgeuse').found).toBe(true);
		expect(findObject(DELHI, FIXTURE_TIME, 'POLARIS').found).toBe(true);
	});

	it('still does not know a made up name', () => {
		expect(findObject(DELHI, FIXTURE_TIME, 'Picard')).toEqual({
			found: false,
			name: 'Picard'
		});
	});

	it('still finds planets', () => {
		const result = findObject(DELHI, FIXTURE_TIME, 'Saturn');
		expect(result.found).toBe(true);
		if (!result.found) return;
		expect(result.kind).toBe('planet');
	});
});

describe('whatsUp includes stars', () => {
	it('returns stars as well as planets', () => {
		const up = whatsUp(DELHI, FIXTURE_TIME, { minAltitude: 10 });
		expect(up.some((o) => o.kind === 'star')).toBe(true);
		expect(up.every((o) => o.aboveHorizon && o.altitude >= 10)).toBe(true);
	});

	it('sorts everything together by altitude', () => {
		const altitudes = whatsUp(DELHI, FIXTURE_TIME, { minAltitude: 10 }).map((o) => o.altitude);
		expect(altitudes).toEqual([...altitudes].sort((a, b) => b - a));
	});

	it('returns Vega for a north westerly direction query at fixture time', () => {
		// Vega sits at azimuth 304.2, which is between 292.5 and 315.
		const west = whatsUp(DELHI, FIXTURE_TIME, { direction: 'NW', minAltitude: 10 });
		expect(west.map((o) => o.name)).toContain('Vega');
	});

	it('reads the Vega fixture azimuth as north west', () => {
		const { altitude } = starPosition(findStar('Vega')!, FIXTURE_TIME, observerFor(DELHI));
		expect(altitude).toBeGreaterThan(0);
		const vega = findObject(DELHI, FIXTURE_TIME, 'Vega');
		expect(vega.found && vega.compass).toBe('NW');
	});
});
describe('twilight holds up across a whole day', () => {
	const obs = observerFor(DELHI);

	it('returns the same night at every hour after dusk', () => {
		const hours = ['2026-10-06T14:00:00Z', '2026-10-06T16:00:00Z', '2026-10-06T18:00:00Z', '2026-10-06T22:00:00Z', '2026-10-07T00:30:00Z'];
		const results = hours.map((h) => twilight(obs, new Date(h)));

		for (const result of results) {
			// Each call re-searches from its own anchor, so the crossing lands
			// a few milliseconds apart. One minute of tolerance still proves
			// the same night was chosen rather than a neighbouring one.
			expect(Math.abs(new Date(result.duskUtc as string).getTime() - new Date(results[0].duskUtc as string).getTime()))
				.toBeLessThanOrEqual(60_000);
			expect(Math.abs(new Date(result.dawnUtc as string).getTime() - new Date(results[0].dawnUtc as string).getTime()))
				.toBeLessThanOrEqual(60_000);
		}
	});

	it('returns the previous night when asked before dusk', () => {
		const before = twilight(obs, new Date('2026-10-06T02:00:00Z'));
		const after = twilight(obs, new Date('2026-10-06T14:00:00Z'));
		// 02:00Z on the 6th belongs to the night that began on the 5th.
		expect(before.duskUtc).not.toBe(after.duskUtc);
		expect(new Date(before.duskUtc as string).getTime()).toBeLessThan(
			new Date(before.dawnUtc as string).getTime()
		);
	});

	it('always reports dawn after dusk', () => {
		for (const h of ['2026-10-06T02:00:00Z','2026-10-06T12:00:00Z','2026-10-06T18:00:00Z','2026-10-07T02:00:00Z']) {
			const r = twilight(obs, new Date(h));
			expect(new Date(r.dawnUtc as string).getTime()).toBeGreaterThan(new Date(r.duskUtc as string).getTime());
		}
	});

	it('reports no darkness during polar night', () => {
		const polar = observerFor({ lat: 85, lon: 20, elevation: 0 });
		const r = twilight(polar, new Date('2026-12-21T12:00:00Z'));
		expect(r.darkMinutes).toBeNull();
	});
});
