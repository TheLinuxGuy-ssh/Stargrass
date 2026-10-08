import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm';
import { hasModelInCache, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { engineConfigFor } from './webgpu.js';

export interface LoadProgress {
	text: string;
	progress: number;
}

export interface Engine {
	engine: WebWorkerMLCEngine;
	model: string;
}

export class EngineError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'EngineError';
	}
}

/**
 * Asks the browser not to evict the model under storage pressure. Without
 * this a phone can quietly drop several hundred megabytes of weights and the
 * next visit starts downloading again.
 */
export async function requestPersistence(): Promise<boolean> {
	if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) return false;
	try {
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}

/** True when the weights are already on the device, so no download is needed. */
export async function isModelCached(modelId: string): Promise<boolean> {
	try {
		return await hasModelInCache(modelId);
	} catch {
		return false;
	}
}

export interface PrepareReport {
	persisted: boolean;
	quotaGB: number | null;
	usedGB: number | null;
}

export async function reportStorage(): Promise<PrepareReport> {
	const persisted = await requestPersistence();
	let quotaGB: number | null = null;
	let usedGB: number | null = null;

	try {
		const estimate = await navigator.storage?.estimate?.();
		if (estimate !== undefined) {
			if (estimate.quota !== undefined) quotaGB = Math.round((estimate.quota / 1e9) * 10) / 10;
			if (estimate.usage !== undefined) usedGB = Math.round((estimate.usage / 1e9) * 10) / 10;
		}
	} catch {
		// Leave both null rather than guessing.
	}

	return { persisted, quotaGB, usedGB };
}

/**
 * Loads the model in a web worker so the interface keeps painting while the
 * weights stream in. Weights live in the browser's own model cache, not in
 * localStorage, which is why nothing here touches localStorage.
 */
export async function loadEngine(
	modelId: string,
	worker: Worker,
	onProgress: (progress: LoadProgress) => void
): Promise<Engine> {
	const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');

	const known = prebuiltAppConfig.model_list.some((m) => m.model_id === modelId);
	if (!known) {
		throw new EngineError(`This WebLLM build does not ship ${modelId}.`);
	}

	try {
		// CreateWebWorkerMLCEngine wires the worker itself, so the raw Worker
		// goes in rather than a handler.
		const engine = await CreateWebWorkerMLCEngine(
			worker,
			modelId,
			engineConfigFor(modelId, (text, progress) => onProgress({ text, progress }))
		);
		return { engine, model: modelId };
	} catch (error) {
		throw new EngineError(
			`Could not load ${modelId}. ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}