import type { Place } from '#lib/sky/observer';
import type { ToolCall } from '#lib/sky/types';
import { parseToolCall } from '#lib/sky/types';
import { findObject, moon, tonight, whatsUp, type FindObjectResult, type WhatsUpArgs } from '#lib/sky/tools';
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
 * Runs the chosen tool and phrases its result with a template.
 *
 * The model, when loaded, supplies the routing decision and possibly the
 * wording. It is never trusted with a number: everything numeric in an answer
 * originates here, from the tool result.
 */
export function runTool(call: ToolCall, place: Place, date: Date): Answer | null {
	switch (call.tool) {
		case 'tonight':
			return { text: tonightTemplate(tonight(place, date)), mode: 'fallback', tool: call.tool };
		case 'moon':
			return { text: moonTemplate(moon(place, date)), mode: 'fallback', tool: call.tool };
		case 'whats_up': {
			const args: WhatsUpArgs = call.args;
			return {
				text: whatsUpTemplate(whatsUp(place, date, args), args.direction),
				mode: 'fallback',
				tool: call.tool
			};
		}
		case 'find_object': {
			const result: FindObjectResult = findObject(place, date, call.args.name);
			return { text: findObjectTemplate(result), mode: 'fallback', tool: call.tool };
		}
		case 'none':
			return { text: nothingTemplate(), mode: 'fallback', tool: call.tool };
	}
}

/**
 * Asks a question. Uses the model for routing and wording when one is
 * available, and the keyword router otherwise. Any failure in the model path
 * falls through to the same templates the fallback uses, so a question always
 * gets an answer.
 */
export async function ask(
	question: string,
	place: Place,
	date: Date,
	model?: { route(q: string): Promise<ToolCall | null>; narrate(input: { question: string; tool: ToolCall['tool']; result: unknown }): Promise<string | null> }
): Promise<Answer> {
	const fallbackCall = routeByKeyword(question);

	if (model === undefined) {
		return runTool(fallbackCall, place, date) ?? { text: nothingTemplate(), mode: 'fallback', tool: 'none' };
	}

	try {
		const routed = await model.route(question);

		// If the model could not choose a tool, it does not get to word the
		// answer either. The keyword router has already decided what is true,
		// and every number in the answer should come from the template.
		if (routed === null) {
			return runTool(fallbackCall, place, date) ?? { text: nothingTemplate(), mode: 'fallback', tool: 'none' };
		}

		const templated = runTool(routed, place, date);
		if (templated === null) {
			return runTool(fallbackCall, place, date) ?? { text: nothingTemplate(), mode: 'fallback', tool: 'none' };
		}

		const spoken = await model.narrate({
			question,
			tool: routed.tool,
			result: toolResultFor(routed, place, date)
		});

		if (spoken === null || spoken.trim() === '') return templated;

		return { text: spoken.trim(), mode: 'model', tool: routed.tool };
	} catch {
		// Any model failure degrades to the deterministic path.
		return runTool(fallbackCall, place, date) ?? { text: nothingTemplate(), mode: 'fallback', tool: 'none' };
	}
}

/** The tool result as JSON, which is what the narrator is allowed to see. */
function toolResultFor(call: ToolCall, place: Place, date: Date): unknown {
	switch (call.tool) {
		case 'tonight':
			return tonight(place, date);
		case 'moon':
			return moon(place, date);
		case 'whats_up':
			return { objects: whatsUp(place, date, call.args) };
		case 'find_object':
			return findObject(place, date, call.args.name);
		case 'none':
			return { note: 'out of scope' };
	}
}

export { parseToolCall };