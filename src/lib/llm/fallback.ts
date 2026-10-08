import type { ToolCall } from '#lib/sky/types';
import { STARS } from '#lib/sky/stars';

/**
 * Routing without a model. These rules are the whole app on devices with no
 * WebGPU adapter, so they carry the field test.
 */

const GREETINGS = new Set([
	'hello',
	'hi',
	'hey',
	'yo',
	'good morning',
	'good evening',
	'good night',
	'thanks',
	'thank you'
]);

const OFF_TOPIC = [
	'capital of',
	'weather',
	'forecast',
	'stock',
	'news',
	'football',
	'recipe',
	'joke',
	'mail',
	'email',
	'shopping'
];

const MOON_WORDS = ['moon', 'lunar', 'crescent', 'gibbous', 'quarter', 'waxing', 'waning'];

const TONIGHT_WORDS = [
	'tonight',
	'darkness',
	'dark window',
	'dusk',
	'dawn',
	'twilight',
	'nightsky',
	'night sky',
	'sunset',
	'sunrise'
];

const WHATS_UP_WORDS = ['whats up', "what's up", 'visible', 'can i see', 'can see', 'right now', 'out tonight', 'in the sky'];

const PLANETS: Record<string, string> = {
	mercury: 'Mercury',
	venus: 'Venus',
	mars: 'Mars',
	jupiter: 'Jupiter',
	saturn: 'Saturn'
};

const DIRECTIONS: Record<string, string> = {
	n: 'N',
	north: 'N',
	nne: 'NNE',
	ne: 'NE',
	northeast: 'NE',
	ene: 'ENE',
	e: 'E',
	east: 'E',
	ese: 'ESE',
	se: 'SE',
	southeast: 'SE',
	sse: 'SSE',
	s: 'S',
	south: 'S',
	ssw: 'SSW',
	sw: 'SW',
	southwest: 'SW',
	wsw: 'WSW',
	w: 'W',
	west: 'W',
	wnw: 'WNW',
	nw: 'NW',
	northwest: 'NW',
	nnw: 'NNW'
};

/**
 * A 16 point compass point matches roughly the three points around it, so
 * asking for "east" should surface something sitting at ENE.
 */
const NEIGHBOURS: Record<string, string[]> = {
	N: ['N', 'NNE', 'NNW'],
	NNE: ['NNE', 'N', 'NE'],
	NE: ['NE', 'NNE', 'ENE'],
	ENE: ['ENE', 'NE', 'E'],
	E: ['E', 'ENE', 'ESE'],
	ESE: ['ESE', 'E', 'SE'],
	SE: ['SE', 'ESE', 'SSE'],
	SSE: ['SSE', 'SE', 'S'],
	S: ['S', 'SSE', 'SSW'],
	SSW: ['SSW', 'S', 'SW'],
	SW: ['SW', 'SSW', 'WSW'],
	WSW: ['WSW', 'SW', 'W'],
	W: ['W', 'WSW', 'WNW'],
	WNW: ['WNW', 'W', 'NW'],
	NW: ['NW', 'WNW', 'N'],
	NNW: ['NNW', 'N', 'NW']
};

export function compassMatches(objectCompass: string, wanted: string): boolean {
	const accepted = NEIGHBOURS[wanted];
	if (accepted === undefined) return false;
	return accepted.includes(objectCompass);
}

export function directionFrom(question: string): string | undefined {
	const words = question.toLowerCase().split(/[^a-z]+/).filter(Boolean);
	for (const word of words) {
		const found = DIRECTIONS[word];
		if (found !== undefined) return found;
	}
	return undefined;
}

/** Lowest altitude worth pointing at, in degrees. Below about 10 is inside the tree line. */
const MIN_ALTITUDE = 10;

export function routeByKeyword(question: string): ToolCall {
	const q = question.toLowerCase().trim();
	const bare = q.replace(/[?.!]+$/, '').trim();

	if (bare.length === 0) return { tool: 'none', args: {} };

	if (GREETINGS.has(bare)) return { tool: 'none', args: {} };
	for (const phrase of OFF_TOPIC) {
		if (q.includes(phrase)) return { tool: 'none', args: {} };
	}

	// A named object beats any verb in the sentence. "is mars up" is about
	// Mars, not about the whole sky.
	for (const [word, name] of Object.entries(PLANETS)) {
		if (new RegExp(`\\b${word}\\b`).test(q)) {
			return { tool: 'find_object', args: { name } };
		}
	}

	// Longest names first, so "Rigel" cannot match inside a longer name.
	const starNames = STARS.map((star) => star.name).sort((a, b) => b.length - a.length);
	for (const starName of starNames) {
		const escaped = starName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		if (new RegExp(`\\b${escaped}\\b`).test(q)) {
			return { tool: 'find_object', args: { name: starName } };
		}
	}

	for (const word of MOON_WORDS) {
		if (q.includes(word)) return { tool: 'moon', args: {} };
	}

	for (const word of TONIGHT_WORDS) {
		if (q.includes(word)) return { tool: 'tonight', args: {} };
	}

	for (const word of WHATS_UP_WORDS) {
		if (q.includes(word)) {
			const args: { direction?: string; minAltitude?: number } = { minAltitude: MIN_ALTITUDE };
			const direction = directionFrom(q);
			if (direction !== undefined) args.direction = direction;
			return { tool: 'whats_up', args };
		}
	}

	// "bright thing in the east" with no recognisable verb still means the sky.
	if (directionFrom(q) !== undefined) {
		return { tool: 'whats_up', args: { direction: directionFrom(q), minAltitude: MIN_ALTITUDE } };
	}

	return { tool: 'none', args: {} };
}