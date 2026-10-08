<script lang="ts">
	import { onMount } from 'svelte';
	import { isModelCached, reportStorage, type PrepareReport } from '#lib/llm/engine';
	import { detectGpu, type GpuStatus } from '#lib/llm/webgpu';
	import { cacheCount } from '#lib/ui/offline';
	import { loadPlace } from '#lib/ui/place';

	type Check = { name: string; ok: boolean; detail: string };

	let app = $state<Check | null>(null);
	let model = $state<Check | null>(null);
	let location = $state<Check | null>(null);
	let gpu = $state<GpuStatus | null>(null);
	let storage = $state<PrepareReport | null>(null);
	let busy = $state(false);

	const allReady = $derived(
		app?.ok === true && location?.ok === true && (model?.ok === true || gpu?.supported === false)
	);

	onMount(async () => {
		app = { name: 'App cached', ok: false, detail: 'Checking' };
		model = { name: 'Model cached', ok: false, detail: 'Checking' };
		location = { name: 'Location saved', ok: false, detail: 'Checking' };

		const files = await cacheCount();
		app = {
			name: 'App cached',
			ok: files > 0,
			detail: files > 0 ? `${files} files available offline` : 'Not saved yet. Open the app once on wifi.'
		};

		const saved = loadPlace();
		location = {
			name: 'Location saved',
			ok: saved !== null,
			detail:
				saved === null
					? 'Not set. Enter it on the main screen.'
					: `${saved.place.lat.toFixed(3)}, ${saved.place.lon.toFixed(3)} (${saved.source})`
		};

		storage = await reportStorage();

		gpu = await detectGpu();

		if (gpu.supported) {
			const cached = await isModelCached(gpu.model);
			model = {
				name: 'Model cached',
				ok: cached,
				detail: cached
					? `${gpu.model} is on this device.`
					: `${gpu.model} needs a one time download on wifi (${Math.round(gpu.vramMB)} MB).`
			};
		} else {
			model = {
				name: 'Model cached',
				ok: true,
				detail: 'No GPU here, so the app runs in keyword mode. Nothing to download.'
			};
		}
	});

	async function persist(): Promise<void> {
		busy = true;
		storage = await reportStorage();
		busy = false;
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#07090c" />
	<title>Stargrass: prepare</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-medium tracking-wide" style="color: var(--ink-bright)">Prepare</h1>
		<p class="text-sm" style="color: var(--ink-dim)">
			Do this on wifi before you go somewhere with no signal.
		</p>
	</header>

	<section class="flex flex-col gap-3">
		{#if app !== null}
			<div class="rounded-xl border px-4 py-3" style="border-color: var(--line)">
				<p style="color: var(--ink-bright)">
					{app.name}
					<span style="color: var(--ink-dim)">{app.ok ? 'ready' : 'needed'}</span>
				</p>
				<p class="text-sm" style="color: var(--ink-dim)">{app.detail}</p>
			</div>
		{/if}

		{#if location !== null}
			<div class="rounded-xl border px-4 py-3" style="border-color: var(--line)">
				<p style="color: var(--ink-bright)">
					{location.name}
					<span style="color: var(--ink-dim)">{location.ok ? 'ready' : 'needed'}</span>
				</p>
				<p class="text-sm" style="color: var(--ink-dim)">{location.detail}</p>
			</div>
		{/if}

		{#if model !== null}
			<div class="rounded-xl border px-4 py-3" style="border-color: var(--line)">
				<p style="color: var(--ink-bright)">
					{model.name}
					<span style="color: var(--ink-dim)">{model.ok ? 'ready' : 'needed'}</span>
				</p>
				<p class="text-sm" style="color: var(--ink-dim)">{model.detail}</p>
			</div>
		{/if}
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-sm uppercase tracking-widest" style="color: var(--ink-dim)">This device</h2>

		{#if gpu === null}
			<p class="text-sm" style="color: var(--ink-dim)">Checking the GPU.</p>
		{:else if gpu.supported}
			<p class="text-sm" style="color: var(--ink-dim)">
				WebGPU is available on {gpu.adapterLabel}.
				{gpu.shaderF16 ? 'Half precision is supported.' : 'Half precision is not supported.'}
				The app would load {gpu.model}.
			</p>
		{:else}
			<p class="text-sm" style="color: var(--ink-dim)">
				{gpu.reason} Stargrass will answer from its keyword rules instead, which need no model and work
				offline.
			</p>
		{/if}

		{#if storage !== null}
			<p class="text-sm" style="color: var(--ink-dim)">
				{#if storage.persisted}
					The browser has agreed to keep this app's files.
				{:else}
					The browser has not promised to keep this app's files, so it may clear them when space runs low.
				{/if}
				{#if storage.quotaGB !== null}
					{storage.usedGB ?? 0} GB used of about {storage.quotaGB} GB available.
				{/if}
			</p>
			<button
				type="button"
				onclick={persist}
				disabled={busy}
				class="min-h-12 self-start rounded-xl border px-5 disabled:opacity-50"
				style="border-color: var(--line); color: var(--ink)"
			>
				Ask the browser to keep these files
			</button>
		{/if}
	</section>

	{#if allReady}
		<p class="rounded-xl border px-4 py-3" style="border-color: var(--accent); color: var(--ink)">
			Ready to use with no signal.
		</p>
	{/if}

	<footer class="mt-auto">
		<a
			href="/"
			class="flex min-h-12 items-center justify-center rounded-xl border px-5"
			style="border-color: var(--accent); color: var(--ink)"
		>
			Back to the sky
		</a>
	</footer>
</main>