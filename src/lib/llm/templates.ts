import { compass, fists, formatDuration, formatLocalTime } from '#lib/sky/format';
import type { FindObjectResult, SkyObject, TonightResult } from '#lib/sky/tools';

/**
 * Answer templates for when there is no model. Every number below is copied
 * from a tool result, never computed or guessed here, and anything a tool
 * could not provide is stated as missing rather than filled in.
 */

function phraseAltitude(object: SkyObject): string {
	if (!object.aboveHorizon) return 'below the horizon';
	const fistWord = object.fists === 1 ? 'fist' : 'fists';
	return `${object.fists} ${fistWord} up`;
}

function phraseObject(object: SkyObject): string {
	return `${object.name} is ${compass(object.azimuth)} and ${phraseAltitude(object)}`;
}

export function tonightTemplate(result: TonightResult, timeZone?: string): string {
	if (result.astroDuskUtc === null || result.astroDawnUtc === null) {
		return 'The sun never gets 18 degrees below the horizon tonight, so there is no full darkness here.';
	}

	const dusk = formatLocalTime(result.astroDuskUtc, timeZone);
	const dawn = formatLocalTime(result.astroDawnUtc, timeZone);

	if (result.darkWindowMinutes === null) {
		return `Full darkness runs from ${dusk} to ${dawn}.`;
	}

	return `Full darkness runs from ${dusk} to ${dawn}, which is ${formatDuration(result.darkWindowMinutes)}.`;
}

export function moonTemplate(result: TonightResult['moon'], timeZone?: string): string {
	const lead = `The moon is a ${result.phaseName}, ${result.illuminationPct} percent lit`;

	if (result.riseUtc === null && result.setUtc === null) {
		return `${lead} and it does not rise or set here in the next day.`;
	}

	if (result.riseUtc === null) {
		return `${lead} and it sets at ${formatLocalTime(result.setUtc as string, timeZone)} local.`;
	}

	return `${lead} and it rises at ${formatLocalTime(result.riseUtc, timeZone)} local.`;
}

export function whatsUpTemplate(objects: SkyObject[], direction?: string): string {
	if (objects.length === 0) {
		return direction === undefined
			? 'Nothing is up right now.'
			: `Nothing is up to the ${directionName(direction)}.`;
	}

	const listed = objects
		.slice(0, 3)
		.map((object) => `${object.name} (${compass(object.azimuth)}, ${fists(object.altitude)} fists)`)
		.join('; ');

	const tail = objects.length > 3 ? `, and ${objects.length - 3} more` : '';
	const lead = direction === undefined ? 'Right now you should see' : `Looking ${directionName(direction)} you should see`;

	return `${lead} ${listed}${tail}.`;
}

/** Turns 'E' or 'east' into something readable in a sentence. */
function directionName(direction: string): string {
	const names: Record<string, string> = {
		N: 'north',
		NNE: 'north northeast',
		NE: 'northeast',
		ENE: 'east northeast',
		E: 'east',
		ESE: 'east southeast',
		SE: 'southeast',
		SSE: 'south southeast',
		S: 'south',
		SSW: 'south southwest',
		SW: 'southwest',
		WSW: 'west southwest',
		W: 'west',
		WNW: 'west northwest',
		NW: 'northwest',
		NNW: 'north northwest'
	};
	return names[direction] ?? direction.toLowerCase();
}

export function findObjectTemplate(result: FindObjectResult, timeZone?: string): string {
	if (!result.found) {
		return `I do not know an object called ${result.name}.`;
	}

	if (result.aboveHorizon) {
		return `${phraseObject(result)}.`;
	}

	if (result.riseUtc === null) {
		return `${result.name} is below the horizon, and it does not rise here in the next day.`;
	}

	const rise = formatLocalTime(result.riseUtc, timeZone);
	if (result.setUtc === null) {
		return `${result.name} is below the horizon right now. It rises at ${rise} local.`;
	}
	return `${result.name} is below the horizon right now. It rises at ${rise} local.`;
}

export function nothingTemplate(): string {
	return 'I can only answer questions about tonight, the moon, and what is up in the sky.';
}