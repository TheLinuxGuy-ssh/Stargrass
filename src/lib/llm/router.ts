import type { ChatCompletionRequestNonStreaming, MLCEngineInterface } from '@mlc-ai/web-llm';
import type { ToolCall } from '#lib/sky/types';
import { parseToolCall } from '#lib/sky/types';

/**
 * Turns a question into a tool call, using the model's own JSON grammar so the
 * output has to be a valid ToolCall object.
 *
 * The schema is deliberately enumerated. Every tool name and every permitted
 * direction is listed as a literal, because a small model given free text
 * invents tool names and invents directions far more readily than it fails to
 * produce JSON at all.
 */

export const TOOL_SCHEMA = {
	type: 'object',
	properties: {
		tool: { type: 'string', enum: ['tonight', 'moon', 'whats_up', 'find_object', 'none'] },
		args: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				direction: {
					type: 'string',
					enum: [
						'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
						'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
					]
				},
				minAltitude: { type: 'number' }
			},
			required: []
		}
	},
	required: ['tool', 'args'],
	additionalProperties: false
} as const;

export const ROUTER_SYSTEM_PROMPT = `You route a question about the night sky to exactly one tool.

Tools:
- tonight: how dark it is, dusk, dawn, twilight, the length of the night
- moon: the moon, its phase, how lit it is, when it rises or sets
- whats_up: what is visible right now, optionally in one direction
- find_object: one named object, such as a planet or a star
- none: greetings, and anything that is not about the night sky

Rules:
- If the question names a planet or a star, use find_object and put that name in args.name.
- Use whats_up only when the question is about what can be seen in general.
- Use none for greetings and for anything off topic.
- Leave args empty unless the tool needs it.`;

export type Chat = MLCEngineInterface['chat'];

export async function routeWithModel(chat: Chat, question: string): Promise<ToolCall | null> {
	const request: ChatCompletionRequestNonStreaming = {
		messages: [
			{ role: 'system', content: ROUTER_SYSTEM_PROMPT },
			{ role: 'user', content: question }
		],
		temperature: 0,
		max_tokens: 96,
		// schema is a serialised JSON schema string, not an object.
		response_format: { type: 'json_object', schema: JSON.stringify(TOOL_SCHEMA) }
	};

	const response = await chat.completions.create(request);

	const content = response.choices[0]?.message.content;
	if (content === null || content === undefined || content === '') return null;

	// Still parse defensively. A grammar constrains shape, not sanity, and a
	// model can pick a valid tool for an invalid reason.
	try {
		return parseToolCall(JSON.parse(content));
	} catch {
		return null;
	}
}