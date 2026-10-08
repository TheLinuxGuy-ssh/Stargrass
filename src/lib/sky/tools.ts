import * as A from 'astronomy-engine';
import { PLANETS, horizonOf, magnitude } from './bodies.js';
import { compass, fists } from './format.js';
import { moonResult, type MoonResult } from './moon.js';
import { observerFor, type Place } from './observer.js';
import { twilight } from './twilight.js';

export type SkyKind = 'planet' | 'moon' | 'star';

export interface SkyObject {
	name: string;
	kind: SkyKind;
	altitude: number;
	azimuth: number;
	compass: string;
	fists: number;
	magnitude: number | null;
	aboveHorizon: boolean;
}

export interface TonightResult {
	date: string;
	astroDuskUtc: string | null;
	astroDawnUtc: string | null;
	darkWindowMinutes: number | null;
	moon: MoonResult;
	planets: SkyObject[];
}

export interface WhatsUpArgs {
	direction?: string;
	minAltitude?: number;
}

export type FindObjectResult =
	| ({ found: true } & SkyObject & { riseUtc: string | null; setUtc: string | null })
	| { found: false; name: string };

function skyObject(
	name: string,
	kind: SkyKind,
	altitude: number,
	azimuth: number,
	mag: number | null
): SkyObject {
	return {
		name,
		kind,
		altitude: Math.round(altitude * 1000) / 1000,
		azimuth: Math.round(azimuth * 1000) / 1000,
		compass: compass(azimuth),
		fists: fists(altitude),
		magnitude: mag,
		aboveHorizon: altitude > 0
	};
}

function planetObjects(obs: A.Observer, date: Date): SkyObject[] {
	return PLANETS.map((body) => {
		const { altitude, azimuth } = horizonOf(body, date, obs);
		return skyObject(String(body), 'planet', altitude, azimuth, magnitude(body, date));
	}).sort((a, b) => b.altitude - a.altitude);
}

export function tonight(place: Place, date: Date): TonightResult {
	const obs = observerFor(place);
	const window = twilight(obs, date);

	return {
		date: date.toISOString(),
		astroDuskUtc: window.duskUtc,
		astroDawnUtc: window.dawnUtc,
		darkWindowMinutes: window.darkMinutes,
		moon: moonResult(obs, date),
		planets: planetObjects(obs, date)
	};
}

export function moon(place: Place, date: Date): MoonResult {
	return moonResult(observerFor(place), date);
}

export function whatsUp(place: Place, date: Date, args: WhatsUpArgs = {}): SkyObject[] {
	const obs = observerFor(place);
	const wanted = args.direction?.trim().toUpperCase();

	const objects = planetObjects(obs, date).filter((object) => {
		if (!object.aboveHorizon) return false;
		if (args.minAltitude !== undefined && object.altitude < args.minAltitude) return false;
		if (wanted !== undefined && object.compass !== wanted) return false;
		return true;
	});

	return objects.sort((a, b) => b.altitude - a.altitude);
}

/**
 * Rise and set for a planet, searched in whichever direction is still ahead.
 * SearchRiseSet returns null inside the polar day and night, so every caller
 * has to be ready for null rather than a date.
 */
function riseSet(body: A.Body, obs: A.Observer, date: Date): { rise: A.AstroTime | null; set: A.AstroTime | null } {
	return {
		rise: A.SearchRiseSet(body, obs, +1, date, 1),
		set: A.SearchRiseSet(body, obs, -1, date, 1)
	};
}

export function findObject(place: Place, date: Date, name: string): FindObjectResult {
	const obs = observerFor(place);
	const wanted = name.trim().toLowerCase();

	const body = PLANETS.find((planet) => String(planet).toLowerCase() === wanted);

	if (body === undefined) {
		return { found: false, name };
	}

	const { altitude, azimuth } = horizonOf(body, date, obs);
	const object = skyObject(String(body), 'planet', altitude, azimuth, magnitude(body, date));

	if (object.aboveHorizon) {
		return { found: true, ...object, riseUtc: null, setUtc: null };
	}

	const times = riseSet(body, obs, date);
	return {
		found: true,
		...object,
		riseUtc: times.rise === null ? null : times.rise.date.toISOString(),
		setUtc: times.set === null ? null : times.set.date.toISOString()
	};
}