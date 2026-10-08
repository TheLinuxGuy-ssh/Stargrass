import type { Place } from '#lib/sky/observer';
import type { ToolCall } from '#lib/sky/types';
import { findObject, moon, tonight, whatsUp, type WhatsUpArgs } from '#lib/sky/tools';
import { routeByKeyword } from './fallback.js';
import {
	findObjectTemplate,
	moonTemplate,
	nothingTemplate,
	tonightTemplate,
	whatsUpTemplate
} from './templates.js';

export type Mode = 'model' | 'fallback';

export interface Answer {
	text: string;
	mode: Mode;
	tool: ToolCall['tool'];
}

/**
 * Turns a question into an answer by running a tool and phrasing its result.
 *
 * The model, when one is loaded, supplies the routing decision and the
 * phrasing. Neither is trusted with a number. Everything numeric in the reply
 * comes out of the tool result below.
 */
export function runTool(call: ToolCall, place: Place, date: Date): Answer | null {
	switch (call.tool) {
		case 'tonight': {
			const result = tonight(place, date);
			return { text: tonightTemplate(result), mode: 'fallback', tool: call.tool };
		}
		case 'moon': {
			return { text: moonTemplate(moon(place, date)), mode: 'fallback', tool: call.tool };
		}
		case 'whats_up': {
			const args: WhatsUpArgs = call.args;
			const objects = whatsUp(place, date, args);
			return {
				text: whatsUpTemplate(objects, args.direction),
				mode: 'fallback',
				tool: call.tool
			};
		}
		case 'find_object': {
			return {
				text: findObjectTemplate(findObject(place, date, call.args.name)),
				mode: 'fallback',
				tool: call.tool
			};
		}
		case 'none':
			return { text: nothingTemplate(), mode: 'fallback', tool: call.tool };
	}
}

export function ask(question: string, place: Place, date: Date): Answer {
	const call = routeByKeyword(question);
	return runTool(call, place, date) ?? { text: nothingTemplate(), mode: 'fallback', tool: 'none' };
}