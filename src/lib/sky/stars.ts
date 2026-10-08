import starData from '../data/stars.json';
import { starHorizon } from './bodies.js';
import type { Observer } from 'astronomy-engine';

export interface Star {
	name: string;
	constellation: string;
	raHours: number;
	decDeg: number;
	magnitude: number;
}

export const STARS: Star[] = (starData as Star[]).map((star) => ({
	name: star.name,
	constellation: star.constellation,
	raHours: star.raHours,
	decDeg: star.decDeg,
	magnitude: star.magnitude
}));

/** Names are matched loosely so "betelgeuse" and "Betelgeuse" both land. */
export function findStar(name: string): Star | undefined {
	const wanted = name.trim().toLowerCase();
	return STARS.find((star) => star.name.toLowerCase() === wanted);
}

export function starPosition(star: Star, date: Date, obs: Observer) {
	return starHorizon(star.raHours, star.decDeg, date, obs);
}

export interface StarTimes {
	riseUtc: string | null;
	setUtc: string | null;
}

const STEP_MIN = 5;
const HORIZON_STEPS = (24 * 60) / STEP_MIN;

/**
 * Rise and set for a fixed star.
 *
 * astronomy-engine's SearchRiseSet only accepts solar system bodies, so there
 * is no library helper for a catalogue star. Altitude is sampled across a
 * day instead and the zero crossing is interpolated, which is accurate to
 * roughly a minute and costs a couple of hundred evaluations.
 *
 * A circumpolar star never crosses, so both fields come back null rather
 * than guessing.
 */
export function starRiseSet(star: Star, from: Date, obs: Observer): StarTimes {
	const step = STEP_MIN * 60_000;
	const start = from.getTime();

	let rise: number | null = null;
	let set: number | null = null;

	let previousTime = start;
	let previousAltitude = starPosition(star, new Date(start), obs).altitude;

	for (let i = 1; i <= HORIZON_STEPS; i += 1) {
		const currentTime = start + i * step;
		const currentAltitude = starPosition(star, new Date(currentTime), obs).altitude;

		const crossedUp = previousAltitude <= 0 && currentAltitude > 0;
		const crossedDown = previousAltitude > 0 && currentAltitude <= 0;

		if (crossedUp && rise === null) {
			rise = interpolate(previousTime, previousAltitude, currentTime, currentAltitude);
		}
		if (crossedDown && set === null) {
			set = interpolate(previousTime, previousAltitude, currentTime, currentAltitude);
		}
		if (rise !== null && set !== null) break;

		previousTime = currentTime;
		previousAltitude = currentAltitude;
	}

	return {
		riseUtc: rise === null ? null : new Date(rise).toISOString(),
		setUtc: set === null ? null : new Date(set).toISOString()
	};
}

/** Linear interpolation of the moment altitude passed through zero. */
function interpolate(t0: number, a0: number, t1: number, a1: number): number {
	const span = a1 - a0;
	if (span === 0) return t1;
	return t0 + ((0 - a0) * (t1 - t0)) / span;
}