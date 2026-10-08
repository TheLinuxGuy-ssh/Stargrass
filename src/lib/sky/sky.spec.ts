import { describe, expect, it } from 'vitest';
import * as A from 'astronomy-engine';
import { horizonOf, magnitude, starHorizon } from './bodies.js';
import { phaseName } from './moon.js';
import { observerFor, type Place } from './observer.js';
import { twilight } from './twilight.js';
import { findObject, tonight, whatsUp } from './tools.js';

/**
 * Fixture from SPEC.md section 5. Every row of that table has a test below.
 * The numbers came from astronomy-engine itself, so they guard against
 * regressions, not against the library being wrong. Stellarium is the check
 * that matters (SPEC.md section 9).
 */
const DELHI: Place = { lat: 28.6139, lon: 77.2090, elevation: 216 };
const FIXTURE_TIME = new Date('2026-10-06T14:00:00Z');

const DEG_TOLERANCE = 0.3;
const TIME_TOLERANCE_MIN = 2;

const VEGA_RA_HOURS = 18.615649;
const VEGA_DEC_DEG = 38.783689;

const obs = observerFor(DELHI);

function expectDegrees(actual: number, expected: number): void {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(DEG_TOLERANCE);
}

function expectUtc(actual: string | null, expectedIso: string): void {
	expect(actual).not.toBeNull();
	const diffMin = Math.abs(new Date(actual as string).getTime() - new Date(expectedIso).getTime());
	expect(diffMin / 60_000).toBeLessThanOrEqual(TIME_TOLERANCE_MIN);
}

describe('fixture place and time', () => {
	it('uses the Delhi coordinates from the spec', () => {
		expect(DELHI.lat).toBe(28.6139);
		expect(DELHI.lon).toBe(77.209);
		expect(DELHI.elevation).toBe(216);
		expect(FIXTURE_TIME.toISOString()).toBe('2026-10-06T14:00:00.000Z');
	});

	it('builds an observer at that place', () => {
		expect(obs).toBeInstanceOf(A.Observer);
	});
});

describe('sun', () => {
	it('sits about 19.7 degrees below the horizon at fixture time', () => {
		const eq = A.Equator(A.Body.Sun, FIXTURE_TIME, obs, true, true);
		const hor = A.Horizon(FIXTURE_TIME, obs, eq.ra, eq.dec, 'normal');
		expectDegrees(hor.altitude, -19.7);
	});
});

describe('planets', () => {
	it('puts Saturn about 19.5 degrees up at azimuth 98.8', () => {
		const { altitude, azimuth } = horizonOf(A.Body.Saturn, FIXTURE_TIME, obs);
		expectDegrees(altitude, 19.5);
		expectDegrees(azimuth, 98.8);
	});

	it('puts Jupiter about 41.5 degrees below the horizon', () => {
		const { altitude } = horizonOf(A.Body.Jupiter, FIXTURE_TIME, obs);
		expectDegrees(altitude, -41.5);
		expect(altitude).toBeLessThan(0);
	});
});

describe('stars', () => {
	it('puts Vega about 68.4 degrees up at azimuth 304.2', () => {
		const { altitude, azimuth } = starHorizon(VEGA_RA_HOURS, VEGA_DEC_DEG, FIXTURE_TIME, obs);
		expectDegrees(altitude, 68.4);
		expectDegrees(azimuth, 304.2);
	});
});

describe('twilight', () => {
	it('finds dusk at 13:49:51Z even though that is before the fixture time', () => {
		const window = twilight(obs, FIXTURE_TIME);
		expectUtc(window.duskUtc, '2026-10-06T13:49:51Z');
	});

	it('finds the next dawn at 23:28:51Z', () => {
		const window = twilight(obs, FIXTURE_TIME);
		expectUtc(window.dawnUtc, '2026-10-06T23:28:51Z');
	});

	it('reports a dark window of about 9 hours 39 minutes', () => {
		const window = twilight(obs, FIXTURE_TIME);
		expect(window.darkMinutes).not.toBeNull();
		expect(Math.abs((window.darkMinutes as number) - 579)).toBeLessThanOrEqual(TIME_TOLERANCE_MIN);
	});

	it('keeps dawn after dusk when the night is already underway', () => {
		const window = twilight(obs, FIXTURE_TIME);
		expect(new Date(window.dawnUtc as string).getTime()).toBeGreaterThan(
			new Date(window.duskUtc as string).getTime()
		);
	});
});

describe('moon', () => {
	it('is a waning crescent about 18 percent lit', () => {
		const result = tonight(DELHI, FIXTURE_TIME).moon;
		expect(result.phaseName).toBe('Waning Crescent');
		expect(Math.abs(result.illuminationPct - 18)).toBeLessThanOrEqual(1);
	});

	it('rises at 21:17Z', () => {
		expectUtc(tonight(DELHI, FIXTURE_TIME).moon.riseUtc, '2026-10-06T21:17Z');
	});

	it('reaches the next new moon at 15:50Z on October 10', () => {
		expectUtc(tonight(DELHI, FIXTURE_TIME).moon.nextNewMoonUtc, '2026-10-10T15:50Z');
	});
});

describe('phase names', () => {
	it('maps the eight standard phases', () => {
		expect(phaseName(0)).toBe('New Moon');
		expect(phaseName(45)).toBe('Waxing Crescent');
		expect(phaseName(90)).toBe('First Quarter');
		expect(phaseName(135)).toBe('Waxing Gibbous');
		expect(phaseName(180)).toBe('Full Moon');
		expect(phaseName(225)).toBe('Waning Gibbous');
		expect(phaseName(270)).toBe('Last Quarter');
		expect(phaseName(315)).toBe('Waning Crescent');
	});

	it('wraps around 360', () => {
		expect(phaseName(359)).toBe('New Moon');
		expect(phaseName(360)).toBe('New Moon');
	});
});

describe('magnitude', () => {
	it('reports a plausible magnitude for Saturn', () => {
		const mag = magnitude(A.Body.Saturn, FIXTURE_TIME);
		expect(mag).not.toBeNull();
		expect(mag as number).toBeGreaterThan(-2);
		expect(mag as number).toBeLessThan(2);
	});
});

describe('tonight', () => {
	it('returns the fixture dusk, dawn and planets together', () => {
		const result = tonight(DELHI, FIXTURE_TIME);

		expectUtc(result.astroDuskUtc, '2026-10-06T13:49:51Z');
		expectUtc(result.astroDawnUtc, '2026-10-06T23:28:51Z');

		const saturn = result.planets.find((p) => p.name === 'Saturn');
		expect(saturn).toBeDefined();
		expectDegrees((saturn as { altitude: number }).altitude, 19.5);
		expect((saturn as { aboveHorizon: boolean }).aboveHorizon).toBe(true);
		expect((saturn as { compass: string }).compass).toBe('E');
	});

	it('sorts planets by altitude, highest first', () => {
		const altitudes = tonight(DELHI, FIXTURE_TIME).planets.map((p) => p.altitude);
		const sorted = [...altitudes].sort((a, b) => b - a);
		expect(altitudes).toEqual(sorted);
	});

	it('lists exactly the five naked eye planets', () => {
		expect(tonight(DELHI, FIXTURE_TIME).planets.map((p) => p.name).sort()).toEqual([
			'Jupiter',
			'Mars',
			'Mercury',
			'Saturn',
			'Venus'
		]);
	});
});

describe('whatsUp', () => {
	it('returns only planets above the horizon by default', () => {
		const up = whatsUp(DELHI, FIXTURE_TIME);
		expect(up.every((o) => o.aboveHorizon)).toBe(true);
		expect(up.map((o) => o.name)).toContain('Saturn');
		expect(up.map((o) => o.name)).not.toContain('Jupiter');
	});

	it('filters by compass direction', () => {
		expect(whatsUp(DELHI, FIXTURE_TIME, { direction: 'E' }).map((o) => o.name)).toEqual([
			'Saturn'
		]);
	});

	it('filters by minimum altitude', () => {
		expect(whatsUp(DELHI, FIXTURE_TIME, { minAltitude: 30 })).toHaveLength(0);
	});

	it('returns an empty list when nothing matches', () => {
		expect(whatsUp(DELHI, FIXTURE_TIME, { direction: 'N' })).toHaveLength(0);
	});
});

describe('findObject', () => {
	it('finds Saturn above the horizon with no rise or set needed', () => {
		const result = findObject(DELHI, FIXTURE_TIME, 'Saturn');
		expect(result.found).toBe(true);
		if (!result.found) return;
		expectDegrees(result.altitude, 19.5);
		expect(result.aboveHorizon).toBe(true);
	});

	it('reports rise and set for a planet below the horizon', () => {
		const result = findObject(DELHI, FIXTURE_TIME, 'Jupiter');
		expect(result.found).toBe(true);
		if (!result.found) return;
		expect(result.aboveHorizon).toBe(false);
		expect(result.riseUtc).not.toBeNull();
		expect(result.setUtc).not.toBeNull();
	});

	it('is case insensitive', () => {
		expect(findObject(DELHI, FIXTURE_TIME, 'saturn').found).toBe(true);
		expect(findObject(DELHI, FIXTURE_TIME, 'SATURN').found).toBe(true);
	});

	it('says it does not know an unknown name', () => {
		expect(findObject(DELHI, FIXTURE_TIME, 'Betelgeuse')).toEqual({
			found: false,
			name: 'Betelgeuse'
		});
	});
});