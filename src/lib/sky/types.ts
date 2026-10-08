import type { WhatsUpArgs } from './tools.js';

/**
 * The tool contract from SPEC.md section 4, in one place.
 *
 * This module exists so the model layer can talk about tool names and shapes
 * without importing astronomy-engine. Nothing here computes anything.
 */
export type ToolCall =
	| { tool: 'tonight'; args: Record<string, never> }
	| { tool: 'moon'; args: Record<string, never> }
	| { tool: 'whats_up'; args: WhatsUpArgs }
	| { tool: 'find_object'; args: { name: string } }
	| { tool: 'none'; args: Record<string, never> };

export type ToolName = ToolCall['tool'];

/**
 * Narrowing a value parsed out of a model's reply. Small models return
 * plausible looking JSON with the wrong shape often enough that the check has
 * to be defensive rather than hopeful.
 */
export function parseToolCall(value: unknown): ToolCall | null {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	const tool = record.tool;
	if (typeof tool !== 'string') return null;

	switch (tool) {
		case 'tonight':
		case 'moon':
		case 'none':
			return { tool, args: {} };
		case 'whats_up': {
			const args = (typeof record.args === 'object' && record.args !== null ? record.args : {}) as Record<string, unknown>;
			const out: WhatsUpArgs = {};
			if (typeof args.direction === 'string') out.direction = args.direction;
			if (typeof args.minAltitude === 'number' && Number.isFinite(args.minAltitude)) {
				out.minAltitude = args.minAltitude;
			}
			return { tool, args: out };
		}
		case 'find_object': {
			const args = (typeof record.args === 'object' && record.args !== null ? record.args : {}) as Record<string, unknown>;
			if (typeof args.name !== 'string' || args.name.trim() === '') return null;
			return { tool, args: { name: args.name.trim() } };
		}
		default:
			return null;
	}
}