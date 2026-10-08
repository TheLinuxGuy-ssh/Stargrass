import { prebuiltAppConfig, type MLCEngineConfig } from '@mlc-ai/web-llm';

/**
 * WebGPU capability detection, and the choice of which Gemma build to load.
 *
 * The subtlety here is a bug in MLC's own model registry. Every q4f16_1 build
 * declares required_features: ['shader-f16'] except gemma3-1b-it, which
 * declares nothing. It is a half precision build and needs the feature, but
 * because its manifest is silent, WebLLM's own preflight will happily attempt
 * to load it on a device that cannot run it and fail inside shader
 * compilation instead of skipping it. So shader-f16 is detected here directly
 * and gemma3-1b-it is treated as needing it regardless of what it claims.
 */

export const MODEL_F16 = 'gemma3-1b-it-q4f16_1-MLC';
export const MODEL_F32 = 'gemma-2-2b-it-q4f32_1-MLC';

export type GpuStatus =
	| { supported: true; shaderF16: boolean; model: string; adapterLabel: string; vramMB: number }
	| { supported: false; reason: string };

function vramFor(modelId: string): number {
	const record = prebuiltAppConfig.model_list.find((m) => m.model_id === modelId);
	return record?.vram_required_MB ?? 0;
}

/**
 * gemma3-1b-it is the smallest and best build when shader-f16 exists, and the
 * one that fails worst when it does not. Everything else follows its manifest.
 */
export function pickModel(shaderF16: boolean): string {
	return shaderF16 ? MODEL_F16 : MODEL_F32;
}

export function engineConfigFor(
	model: string,
	onProgress: (text: string, progress: number) => void
): MLCEngineConfig {
	return {
		initProgressCallback: (report) => {
			onProgress(report.text, report.progress);
		}
	};
}

export async function detectGpu(): Promise<GpuStatus> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator) || navigator.gpu === undefined) {
		return { supported: false, reason: 'This browser has no WebGPU.' };
	}

	if (!window.isSecureContext) {
		return { supported: false, reason: 'WebGPU needs a secure (https) connection.' };
	}

	let adapter: GPUAdapter | null;
	try {
		adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
		if (adapter === null) adapter = await navigator.gpu.requestAdapter();
	} catch {
		adapter = null;
	}

	// An adapter is required before a device can exist. This is the exact
	// failure on an iPhone 11 running Safari 26: navigator.gpu exists, but
	// requestAdapter resolves null and no model can ever run.
	if (adapter === null) {
		return {
			supported: false,
			reason: 'WebGPU is present but this device offers no GPU adapter.'
		};
	}

	const shaderF16 = adapter.features.has('shader-f16');

	// Prove it rather than assume it. A listing can lie; a grant cannot.
	try {
		await adapter.requestDevice({ requiredFeatures: shaderF16 ? ['shader-f16'] : [] });
	} catch {
		return {
			supported: false,
			reason: 'A GPU device could not be created, so no model can run.'
		};
	}

	const info = adapter.info;
	const adapterLabel =
		info === undefined
			? 'unknown GPU'
			: [info.vendor, info.architecture, info.device].filter((p) => p !== undefined && p !== '').join(' ') ||
				'unnamed GPU';

	const model = pickModel(shaderF16);

	return {
		supported: true,
		shaderF16,
		model,
		adapterLabel,
		vramMB: vramFor(model)
	};
}