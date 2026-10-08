import type { ChatCompletionRequestNonStreaming } from '@mlc-ai/web-llm';
import type { ToolCall } from '#lib/sky/types';
import type { Chat } from './router.js';

/**
 * Phrases a tool result in one to three sentences.
 *
 * The model is shown the raw tool JSON and told plainly that it may only use
 * numbers present in that JSON. It is never asked to compute anything. The
 * template path stays available alongside this rather than being replaced, so
 * a caller can always fall back to a phrase whose numbers came from code.
 */

export const NARRATOR_SYSTEM_PROMPT = `You answer questions about the night sky using only the data you are given.

Rules:
- Use at most three sentences.
- Use only numbers that appear in the data. Never calculate, convert or estimate one.
- Give directions as compass words like north or west.
- Give heights in fists, where one fist is about ten degrees.
- If the data says something is below the horizon or is unknown, say so plainly.
- Do not add facts of your own.`;

export interface NarrateInput {
	question: string;
	tool: ToolCall['tool'];
	result: unknown;
}

export async function narrateWithModel(chat: Chat, input: NarrateInput): Promise<string | null> {
	const request: ChatCompletionRequestNonStreaming = {
		messages: [
			{ role: 'system', content: NARRATOR_SYSTEM_PROMPT },
			{
				role: 'user',
				content: `Question: ${input.question}\n\nTool used: ${input.tool}\n\nData:\n${JSON.stringify(input.result)}`
			}
		],
		temperature: 0.4,
		max_tokens: 160
	};

	const response = await chat.completions.create(request);

	const content = response.choices[0]?.message.content;
	if (content === null || content === undefined) return null;

	const trimmed = content.trim();
	return trimmed === '' ? null : trimmed;
}

/** Narration is only worth showing if it is short enough to read at a glance. */
export function isReadableLength(text: string): boolean {
	const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 0);
	return sentences.length <= 3 && text.length <= 320;
}