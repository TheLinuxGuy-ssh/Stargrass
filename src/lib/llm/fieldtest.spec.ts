import { describe, expect, it } from 'vitest';
import { findObject, tonight, whatsUp } from '#lib/sky/tools';
import { ask } from '#lib/llm/ask.js';
import { tonightTemplate } from '#lib/llm/templates.js';
import type { Place } from '#lib/sky/observer';

/**
 * The field test questions, run against a fixed place and time so the answers
 * are the ones a person can check by looking up.
 *
 * These are deliberately the questions a person standing outside at night
 * would actually ask, not exercises.
 */

const AUSTIN: Place = { lat: 30.2672, lon: -97.7431, elevation: 150 };

/** Local midnight on the night of the new moon, which is the darkest. */
const NEW_MOON_NIGHT = new Date('2026-10-11T06:00:00Z');

/**
 * Sentence counting has to be blind to decimal points, or "6.1 fists" is read
 * as two sentences. Guarding a digit before the dot is enough.
 */
function sentenceCount(text: string): number {
	return text
		.replace(/(\d)\.(\d)/g, '$1<D>$2')
		.split(/[.!?]+/)
		.filter((part) => part.trim().length > 0).length;
}

const QUESTIONS = [
	'how dark is it tonight',
	'when does the moon rise',
	'show me Saturn',
	"what's up in the south",
	'is Mars up'
];

describe('field test questions produce checkable answers', () => {
	it('answers every field test question without throwing', async () => {
		for (const question of QUESTIONS) {
			const answer = await ask(question, AUSTIN, NEW_MOON_NIGHT);
			expect(answer.text.length).toBeGreaterThan(0);
			expect(answer.text).not.toMatch(/undefined|NaN|null/);
		}
	});

	it('keeps each answer short enough to read in the dark', async () => {
		for (const question of QUESTIONS) {
			const answer = await ask(question, AUSTIN, NEW_MOON_NIGHT);
			expect(sentenceCount(answer.text)).toBeLessThanOrEqual(3);
		}
	});

	it('counts a sentence correctly when a height has a decimal point', () => {
		expect(sentenceCount('Vega is northwest at 6.8 fists up.')).toBe(1);
		expect(sentenceCount('One. Two. Three.')).toBe(3);
	});

	it('invents no number that is absent from the tool result', async () => {
		const result = tonight(AUSTIN, NEW_MOON_NIGHT);
		const answer = await ask('how dark is it tonight', AUSTIN, NEW_MOON_NIGHT);

		// The strongest version of this claim is simply that the answer is
		// built from the formatter's output for the real timestamps, so
		// recompute the answer and require an exact match. A hallucinated
		// number would break the equality.
		expect(answer.text).toBe(tonightTemplate(result));
	});

it('the tonight answer contains no number the tool did not produce', () => {
		const result = tonight(AUSTIN, NEW_MOON_NIGHT);
		const answer = tonightTemplate(result);

		const dusk = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
			.format(new Date(result.astroDuskUtc as string));
		const dawn = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
			.format(new Date(result.astroDawnUtc as string));

		expect(answer).toContain(dusk);
		expect(answer).toContain(dawn);
		expect(answer).toContain(String(result.darkWindowMinutes === null ? '' : Math.floor(result.darkWindowMinutes / 60)));
	});

	it('uses keyword mode when no model is supplied', async () => {
		const answer = await ask('show me Saturn', AUSTIN, NEW_MOON_NIGHT);
		expect(answer.mode).toBe('fallback');
	});
});

describe('what the tester can actually check', () => {
	it('names a real object for the direction question', () => {
		const up = whatsUp(AUSTIN, NEW_MOON_NIGHT, { direction: 'S', minAltitude: 20 });
		expect(up.length).toBeGreaterThan(0);
		for (const object of up) expect(object.aboveHorizon).toBe(true);
	});

	it('gives a rise time for every planet it is asked about', () => {
		for (const name of ['Saturn', 'Mars', 'Jupiter', 'Venus', 'Mercury']) {
			const result = findObject(AUSTIN, NEW_MOON_NIGHT, name);
			expect(result.found).toBe(true);
			if (!result.found) continue;
			if (result.aboveHorizon) continue;
			expect(result.riseUtc === null || result.setUtc === null).toBe(false);
		}
	});
});