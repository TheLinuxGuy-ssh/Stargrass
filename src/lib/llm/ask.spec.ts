import { describe, expect, it } from 'vitest';
import { ask } from './ask.js';
import { parseToolCall } from '#lib/sky/types';
import { compassMatches, directionFrom, routeByKeyword } from './fallback.js';
import {
	findObjectTemplate,
	moonTemplate,
	nothingTemplate,
	tonightTemplate,
	whatsUpTemplate
} from './templates.js';
import { tonight } from '#lib/sky/tools';
import { findObject, whatsUp } from '#lib/sky/tools';
import type { Place } from '#lib/sky/observer';

const DELHI: Place = { lat: 28.6139, lon: 77.209, elevation: 216 };
const FIXTURE_TIME = new Date('2026-10-06T14:00:00Z');

describe('routeByKeyword', () => {
	it('treats greetings as out of scope', () => {
		expect(routeByKeyword('hello').tool).toBe('none');
		expect(routeByKeyword('Hi').tool).toBe('none');
		expect(routeByKeyword('thanks').tool).toBe('none');
	});

	it('refuses off topic questions plainly', () => {
		expect(routeByKeyword('what is the capital of France').tool).toBe('none');
		expect(routeByKeyword('will it rain tomorrow').tool).toBe('none');
		expect(routeByKeyword('').tool).toBe('none');
	});

	it('routes moon questions', () => {
		expect(routeByKeyword('when does the moon rise')).toEqual({ tool: 'moon', args: {} });
		expect(routeByKeyword('what phase is the moon in')).toEqual({ tool: 'moon', args: {} });
	});

	it('routes tonight questions', () => {
		expect(routeByKeyword('how dark is it tonight')).toEqual({ tool: 'tonight', args: {} });
		expect(routeByKeyword('when is astronomical dusk')).toEqual({ tool: 'tonight', args: {} });
	});

	it('routes what is up questions', () => {
		expect(routeByKeyword("what's up").tool).toBe('whats_up');
		expect(routeByKeyword('what can I see right now').tool).toBe('whats_up');
	});

	it('prefers a named planet over the verb around it', () => {
		expect(routeByKeyword('is Mars up')).toEqual({
			tool: 'find_object',
			args: { name: 'Mars' }
		});
		expect(routeByKeyword('where is saturn').tool).toBe('find_object');
		expect(routeByKeyword('can I see jupiter').tool).toBe('find_object');
	});

	it('reads a direction out of a vague question', () => {
		const call = routeByKeyword('what is that bright thing in the east');
		expect(call.tool).toBe('whats_up');
		expect(call.tool === 'whats_up' && call.args.direction).toBe('E');
	});

	it('reads compass words in any form', () => {
		expect(directionFrom('anything to the southwest')).toBe('SW');
		expect(directionFrom('anything low in the north')).toBe('N');
		expect(directionFrom('anything overhead')).toBeUndefined();
	});
});

describe('compassMatches', () => {
	it('accepts the neighbouring points', () => {
		expect(compassMatches('E', 'E')).toBe(true);
		expect(compassMatches('ENE', 'E')).toBe(true);
		expect(compassMatches('ESE', 'E')).toBe(true);
		expect(compassMatches('W', 'E')).toBe(false);
	});

	it('rejects a direction it does not know', () => {
		expect(compassMatches('E', 'NOWHERE')).toBe(false);
	});
});

describe('templates', () => {
	it('uses only the fixture dusk, dawn and dark window', () => {
		const answer = tonightTemplate(tonight(DELHI, FIXTURE_TIME), 'Asia/Kolkata');
		expect(answer).toContain('07:19 PM');
		expect(answer).toContain('04:58 AM');
		expect(answer).toContain('9h 39m');
	});

	it('says plainly when there is no full darkness', () => {
		const fake = {
			date: FIXTURE_TIME.toISOString(),
			astroDuskUtc: null,
			astroDawnUtc: null,
			darkWindowMinutes: null,
			moon: tonight(DELHI, FIXTURE_TIME).moon,
			planets: []
		};
		expect(tonightTemplate(fake, 'Asia/Kolkata')).toContain('never gets 18 degrees');
	});

	it('phrases the moon from the tool result', () => {
		const answer = moonTemplate(tonight(DELHI, FIXTURE_TIME).moon, 'Asia/Kolkata');
		expect(answer).toContain('Waning Crescent');
		expect(answer).toContain('18 percent');
	});

	it('does not double up full stops', () => {
		const answers = [
			tonightTemplate(tonight(DELHI, FIXTURE_TIME), 'Asia/Kolkata'),
			moonTemplate(tonight(DELHI, FIXTURE_TIME).moon, 'Asia/Kolkata'),
			whatsUpTemplate(whatsUp(DELHI, FIXTURE_TIME), undefined),
			findObjectTemplate(findObject(DELHI, FIXTURE_TIME, 'Saturn')),
			findObjectTemplate(findObject(DELHI, FIXTURE_TIME, 'Jupiter'), 'Asia/Kolkata'),
			findObjectTemplate(findObject(DELHI, FIXTURE_TIME, 'Betelgeuse')),
			nothingTemplate()
		];
		for (const answer of answers) {
			expect(answer).not.toMatch(/[.]{2}/);
			expect(answer.endsWith('.') || answer.endsWith('?')).toBe(true);
		}
	});

	it('names an unknown object rather than guessing', () => {
		expect(findObjectTemplate(findObject(DELHI, FIXTURE_TIME, 'Picard'))).toBe(
			'I do not know an object called Picard.'
		);
	});

	it('gives rise time for a planet below the horizon', () => {
		const answer = findObjectTemplate(findObject(DELHI, FIXTURE_TIME, 'Jupiter'), 'Asia/Kolkata');
		expect(answer).toContain('below the horizon right now');
		expect(answer).toContain('rises at');
	});

	it('says when nothing is up instead of padding', () => {
		expect(whatsUpTemplate([], undefined)).toContain('Nothing is up right now');
	});

	it('keeps answers to three sentences or fewer', () => {
		const answers = [
			tonightTemplate(tonight(DELHI, FIXTURE_TIME), 'Asia/Kolkata'),
			moonTemplate(tonight(DELHI, FIXTURE_TIME).moon, 'Asia/Kolkata'),
			whatsUpTemplate(whatsUp(DELHI, FIXTURE_TIME), undefined),
			findObjectTemplate(findObject(DELHI, FIXTURE_TIME, 'Saturn')),
			nothingTemplate()
		];
		for (const answer of answers) {
			const sentences = answer.split(/[.?!]+/).filter((s) => s.trim().length > 0);
			expect(sentences.length).toBeLessThanOrEqual(3);
		}
	});
});

describe('what is up output', () => {
	it('lists Saturn as the only planet up at fixture time', () => {
		const up = whatsUp(DELHI, FIXTURE_TIME);
		expect(up.filter((o) => o.kind === 'planet').map((o) => o.name)).toEqual(['Saturn']);
	});

	it('filters by a requested direction', () => {
		const west = whatsUp(DELHI, FIXTURE_TIME, { direction: 'W' });
		expect(west.every((o) => o.compass === 'W')).toBe(true);
		expect(west.map((o) => o.name)).toContain('Rasalgethi');
	});
});
describe('routing star names', () => {
	it('routes a named star to find_object', () => {
		expect(routeByKeyword('show me Betelgeuse')).toEqual({
			tool: 'find_object',
			args: { name: 'Betelgeuse' }
		});
		expect(routeByKeyword('where is vega').tool).toBe('find_object');
		expect(routeByKeyword('is polaris visible').tool).toBe('find_object');
	});

	it('routes a planet name still wins its own check', () => {
		expect(routeByKeyword('is Mars up')).toEqual({ tool: 'find_object', args: { name: 'Mars' } });
	});

	it('does not invent a star that is not in the catalogue', () => {
		expect(routeByKeyword('show me Betelguse')).toBeTruthy();
		expect(routeByKeyword('show me Betelguse').tool).toBe('none');
	});
});

describe('answering about stars', () => {
	it('answers a star question from the tool', async () => {
		const answer = await ask('where is Betelgeuse', DELHI, FIXTURE_TIME);
		expect(answer.tool).toBe('find_object');
		expect(answer.text).toContain('Betelgeuse');
		expect(answer.text.length).toBeGreaterThan(0);
	});

	it('says it does not know an unknown object', async () => {
		const answer = await ask('show me Betelguse', DELHI, FIXTURE_TIME);
		expect(answer.text).toBe('I can only answer questions about tonight, the moon, and what is up in the sky.');
	});
});

describe('parseToolCall guards against a bad model reply', () => {
	it('rejects nothing at all', () => {
		expect(parseToolCall(null)).toBeNull();
		expect(parseToolCall(undefined)).toBeNull();
		expect(parseToolCall('tonight')).toBeNull();
		expect(parseToolCall(42)).toBeNull();
	});

	it('rejects a tool it has never heard of', () => {
		expect(parseToolCall({ tool: 'divine', args: {} })).toBeNull();
		expect(parseToolCall({ tool: '', args: {} })).toBeNull();
		expect(parseToolCall({ args: {} })).toBeNull();
	});

	it('accepts a well formed call', () => {
		expect(parseToolCall({ tool: 'moon', args: {} })).toEqual({ tool: 'moon', args: {} });
		expect(parseToolCall({ tool: 'tonight', args: {} })).toEqual({ tool: 'tonight', args: {} });
		expect(parseToolCall({ tool: 'none', args: {} })).toEqual({ tool: 'none', args: {} });
	});

	it('accepts find_object only with a real name', () => {
		expect(parseToolCall({ tool: 'find_object', args: { name: 'Vega' } })).toEqual({
			tool: 'find_object',
			args: { name: 'Vega' }
		});
		expect(parseToolCall({ tool: 'find_object', args: { name: '   ' } })).toBeNull();
		expect(parseToolCall({ tool: 'find_object', args: {} })).toBeNull();
	});

	it('drops rubbish fields on whats_up instead of trusting them', () => {
		expect(
			parseToolCall({ tool: 'whats_up', args: { direction: 'E', minAltitude: 'high' } })
		).toEqual({ tool: 'whats_up', args: { direction: 'E' } });
		expect(parseToolCall({ tool: 'whats_up', args: {} })).toEqual({ tool: 'whats_up', args: {} });
		expect(parseToolCall({ tool: 'whats_up' })).toEqual({ tool: 'whats_up', args: {} });
	});

	it('survives an entirely missing args object', () => {
		expect(parseToolCall({ tool: 'moon' })).toEqual({ tool: 'moon', args: {} });
	});
});

describe('model path degrades to the templates', () => {
	const model = (route: () => Promise<never>) => ({
		route,
		narrate: async () => null
	});

	it('uses the keyword router when the model cannot route', async () => {
		const answer = await ask(
			'how dark is it tonight',
			DELHI,
			FIXTURE_TIME,
			model(async () => {
				throw new Error('engine lost');
			})
		);
		expect(answer.mode).toBe('fallback');
		expect(answer.tool).toBe('tonight');
		expect(answer.text).toContain('07:19 PM');
	});

	it('uses the template wording when narration returns nothing', async () => {
		const answer = await ask(
			'how dark is it tonight',
			DELHI,
			FIXTURE_TIME,
			{
				route: async () => ({ tool: 'tonight', args: {} }),
				narrate: async () => null
			}
		);
		expect(answer.mode).toBe('fallback');
		expect(answer.text).toContain('9h 39m');
	});

	it('uses the model wording when narration succeeds', async () => {
		const answer = await ask(
			'how dark is it tonight',
			DELHI,
			FIXTURE_TIME,
			{
				route: async () => ({ tool: 'tonight', args: {} }),
				narrate: async () => 'Darkness starts at 7:19.'
			}
		);
		expect(answer.mode).toBe('model');
		expect(answer.text).toBe('Darkness starts at 7:19.');
	});

	it('falls back to keywords when the model routes to an unusable tool', async () => {
		const answer = await ask(
			'show me Vega',
			DELHI,
			FIXTURE_TIME,
			{
				route: async () => null,
				narrate: async () => 'should not be used'
			}
		);
		expect(answer.tool).toBe('find_object');
		expect(answer.text).toContain('Vega');
	});
});
