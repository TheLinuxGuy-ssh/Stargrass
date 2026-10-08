<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDuration, formatLocalTime } from '#lib/sky/format';
	import { tonight as tonightTool, type SkyObject, type TonightResult } from '#lib/sky/tools';
	import type { Place } from '#lib/sky/observer';
	import { loadPlace, requestGps, savePlace, type PlaceSource } from '#lib/ui/place';
	import { applyTheme, loadTheme, saveTheme, type Theme } from '#lib/ui/theme';

	let place = $state<Place | null>(null);
	let source = $state<PlaceSource>('default');
	let theme = $state<Theme>('dark');
	let now = $state(new Date());
	let frozen = $state<string | null>(null);
	let showManual = $state(false);
	let manualLat = $state('');
	let manualLon = $state('');
	let manualElevation = $state('0');
	let gpsError = $state<string | null>(null);
	let busy = $state(false);

	let timeZone = $derived(Intl.DateTimeFormat().resolvedOptions().timeZone);
	let displayTime = $derived(frozen === null ? now : new Date(frozen));
	let result = $derived(place === null ? null : (tonightTool(place, displayTime) as TonightResult));

	let upPlanets = $derived((result?.planets ?? []).filter((p: SkyObject) => p.aboveHorizon));
	let downPlanets = $derived((result?.planets ?? []).filter((p: SkyObject) => !p.aboveHorizon));

	onMount(() => {
		theme = loadTheme();
		applyTheme(theme);

		const saved = loadPlace();
		if (saved !== null) {
			place = saved.place;
			source = saved.source;
		}

		const param = new URLSearchParams(window.location.search).get('t');
		if (param !== null) {
			const parsed = new Date(param);
			if (!Number.isNaN(parsed.getTime())) frozen = parsed.toISOString();
		}

		const timer = setInterval(() => {
			now = new Date();
		}, 30_000);
		return () => clearInterval(timer);
	});

	async function useGps(): Promise<void> {
		busy = true;
		gpsError = null;
		const outcome = await requestGps();
		busy = false;
		if (!outcome.ok) {
			gpsError = outcome.error;
			showManual = true;
			return;
		}
		place = outcome.place;
		source = 'gps';
		savePlace({ place: outcome.place, source: 'gps' });
		showManual = false;
	}

	function saveManual(): void {
		const lat = Number(manualLat);
		const lon = Number(manualLon);
		const elevation = manualElevation.trim() === '' ? 0 : Number(manualElevation);
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(elevation)) {
			gpsError = 'Those coordinates are not numbers.';
			return;
		}
		const next: Place = { lat, lon, elevation };
		place = next;
		source = 'manual';
		savePlace({ place: next, source: 'manual' });
		gpsError = null;
		showManual = false;
	}

	function toggleTheme(): void {
		theme = theme === 'dark' ? 'red' : 'dark';
		saveTheme(theme);
	}
</script>

<svelte:head>
	<meta name="theme-color" content={theme === 'red' ? '#000000' : '#07090c'} />
	<title>Stargrass</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
	<header class="flex items-center justify-between">
		<h1 class="text-xl font-medium tracking-wide" style="color: var(--ink-bright)">Stargrass</h1>
		<button
			type="button"
			onclick={toggleTheme}
			class="min-h-11 rounded-lg border px-4 text-sm"
			style="border-color: var(--line); color: var(--ink-dim)"
			aria-label={theme === 'dark' ? 'Switch to red night mode' : 'Switch to dark mode'}
		>
			{theme === 'dark' ? 'Red mode' : 'Dark mode'}
		</button>
	</header>

	{#if frozen !== null}
		<p class="rounded-lg border px-3 py-2 text-xs" style="border-color: var(--line); color: var(--ink-dim)">
			Time frozen at {formatLocalTime(frozen, timeZone)} for testing.
		</p>
	{/if}

	{#if place === null}
		<section class="flex flex-col gap-4">
			<p style="color: var(--ink-dim)">Stargrass needs your location to know what is in your sky.</p>

			<button
				type="button"
				onclick={useGps}
				disabled={busy}
				class="min-h-12 rounded-xl px-5 font-medium disabled:opacity-50"
				style="background: var(--surface); border: 1px solid var(--accent); color: var(--ink-bright)"
			>
				{busy ? 'Finding you' : 'Use my location'}
			</button>

			{#if !showManual}
				<button
					type="button"
					onclick={() => (showManual = true)}
					class="min-h-12 rounded-xl border px-5"
					style="border-color: var(--line); color: var(--ink-dim)"
				>
					Enter coordinates instead
				</button>
			{/if}

			{#if showManual}
				<div class="flex flex-col gap-3">
					<label class="flex flex-col gap-1 text-sm">
						<span style="color: var(--ink-dim)">Latitude</span>
						<input
							type="number"
							inputmode="decimal"
							bind:value={manualLat}
							placeholder="28.6139"
							class="min-h-12 rounded-xl border px-4"
							style="border-color: var(--line); background: var(--surface); color: var(--ink-bright)"
						/>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span style="color: var(--ink-dim)">Longitude</span>
						<input
							type="number"
							inputmode="decimal"
							bind:value={manualLon}
							placeholder="77.2090"
							class="min-h-12 rounded-xl border px-4"
							style="border-color: var(--line); background: var(--surface); color: var(--ink-bright)"
						/>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span style="color: var(--ink-dim)">Elevation in metres</span>
						<input
							type="number"
							inputmode="decimal"
							bind:value={manualElevation}
							class="min-h-12 rounded-xl border px-4"
							style="border-color: var(--line); background: var(--surface); color: var(--ink-bright)"
						/>
					</label>
					<button
						type="button"
						onclick={saveManual}
						class="min-h-12 rounded-xl px-5 font-medium"
						style="background: var(--surface); border: 1px solid var(--accent); color: var(--ink-bright)"
					>
						Save location
					</button>
				</div>
			{/if}

			{#if gpsError !== null}
				<p class="text-sm" style="color: var(--ink-dim)">{gpsError}</p>
			{/if}
		</section>
	{:else if result !== null}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm uppercase tracking-widest" style="color: var(--ink-dim)">Tonight</h2>
			<p class="text-2xl" style="color: var(--ink-bright)">
				{result.astroDuskUtc === null || result.astroDawnUtc === null
					? 'No full darkness'
					: `${formatLocalTime(result.astroDuskUtc, timeZone)} to ${formatLocalTime(result.astroDawnUtc, timeZone)}`}
			</p>
			<p class="text-sm" style="color: var(--ink-dim)">
				{result.darkWindowMinutes === null
					? 'The sun never gets 18 degrees down here tonight.'
					: `${formatDuration(result.darkWindowMinutes)} of full darkness`}
			</p>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="text-sm uppercase tracking-widest" style="color: var(--ink-dim)">Moon</h2>
			<p class="text-lg" style="color: var(--ink-bright)">
				{result.moon.phaseName}, {result.moon.illuminationPct}% lit
			</p>
			<p class="text-sm" style="color: var(--ink-dim)">
				{#if result.moon.riseUtc === null && result.moon.setUtc === null}
					No rise or set in the next day here.
				{:else}
					{result.moon.riseUtc === null
						? `Sets ${formatLocalTime(result.moon.setUtc as string, timeZone)}`
						: `Rises ${formatLocalTime(result.moon.riseUtc, timeZone)}`}
				{/if}
			</p>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="text-sm uppercase tracking-widest" style="color: var(--ink-dim)">Planets</h2>

			{#if upPlanets.length === 0}
				<p class="text-sm" style="color: var(--ink-dim)">No planets are up right now.</p>
			{:else}
				<ul class="flex flex-col divide-y" style="border-color: var(--line)">
					{#each upPlanets as planet (planet.name)}
						<li class="flex min-h-12 items-baseline justify-between gap-3 py-2">
							<span style="color: var(--ink-bright)">{planet.name}</span>
							<span class="text-sm" style="color: var(--ink-dim)">
								{planet.compass}, {planet.fists} fist{planet.fists === 1 ? '' : 's'} up
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if downPlanets.length > 0}
				<details class="rounded-xl border px-3 py-2" style="border-color: var(--line)">
					<summary class="min-h-11 cursor-pointer py-2 text-sm" style="color: var(--ink-dim)">
						Not up yet ({downPlanets.length})
					</summary>
					<ul class="flex flex-col gap-1 pb-2 text-sm" style="color: var(--ink-dim)">
						{#each downPlanets as planet (planet.name)}
							<li>{planet.name}</li>
						{/each}
					</ul>
				</details>
			{/if}
		</section>

		<footer class="mt-auto flex flex-col gap-2 pt-6 text-xs" style="color: var(--ink-dim)">
			<p>
				{place.lat.toFixed(3)}, {place.lon.toFixed(3)}
				{#if source === 'gps'}
					from your device
				{:else if source === 'manual'}
					entered by hand
				{/if}
			</p>
			<button
				type="button"
				onclick={() => {
					place = null;
					showManual = true;
				}}
				class="min-h-11 self-start rounded-lg border px-4"
				style="border-color: var(--line)"
			>
				Change location
			</button>
		</footer>
	{/if}
</main>