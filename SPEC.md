# Stargrass: SPEC.md

An offline night sky guide. A small open-weight Gemma model runs in the browser, calls deterministic astronomy tools, and explains the results in plain language. You glance at the screen, get a short answer, and look up.

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 1 (Touch Grass). Started October 6, 2026. All code in this repository is written inside the challenge window.

---

## 1. Philosophy

1. **The best skies have no signal, so the tool must not need one.** Offline is the reason this project exists, not a feature.
2. **The screen is a doorway.** Answers are one to three sentences. The UI is near black with a red night mode that protects dark adapted eyes. Success means the phone spends most of the night in a pocket.
3. **Code computes, the model narrates.** Positions, times and phases come from `astronomy-engine`. The model only chooses which tool to call and phrases the result. Small models are decent at routing and phrasing and unreliable at facts, so we never ask them for facts.
4. **Open means it stays yours.** Weights live on your device, your location never leaves it, there is no API key or bill, and the model can be swapped by changing one string.

## 2. Scope

**Must ship**
- Tonight card: astronomical dusk and dawn, dark window length, moon phase and rise/set, visible planets
- Ask box: free text question answered by the on-device model through tools
- Offline use after a one time "Prepare" step
- Dark and red themes
- Fallback mode with no model (keyword routing plus templates) for devices without WebGPU

**Should ship**
- Bright star catalog (about 300 stars) so questions about named stars work
- Altitude shown in fists (one fist at arm's length is about 10 degrees)

**Stretch (only if everything above is done and verified)**
- Compass pointing with DeviceOrientation ("Jupiter is left of where you point")
- A local only star count log. No accounts, no upload, no aggregation.

**Out of scope**
- Accounts, backend, database, analytics, maps, satellites, push notifications

## 3. Architecture

```
src/
  lib/
    sky/            pure TypeScript, no UI imports, fully unit tested
      observer.ts   Place type, observerFor()
      bodies.ts     horizonOf(), starHorizon(), planet list, magnitude
      twilight.ts   astroDusk(), astroDawn(), darkWindow()
      moon.ts       phase name, illumination, rise, set, next new moon
      format.ts     compass(), fists(), local time formatting
      tools.ts      the four tools the model can call (section 4)
      stars.ts      loads src/lib/data/stars.json
    llm/
      webgpu.ts     capability check (WebGPU, shader-f16)
      engine.ts     WebLLM engine in a web worker, progress callback
      router.ts     question -> {tool, args} using JSON constrained output
      narrate.ts    tool result -> short answer
      fallback.ts   keyword router and templates, no model
      ask.ts        orchestrates router, tool, narrator, fallback
    data/
      stars.json
  routes/
    +page.svelte    tonight card, ask box, theme toggle
    prepare/+page.svelte   download and readiness check
evals/
  questions.json    20 questions with the expected tool
  run.ts            router accuracy report
scripts/
  build-stars.mjs   builds stars.json from the source catalog
LOG.md              one short entry per milestone
AGENTS.md
SPEC.md
```

## 4. Tool contract

The model can call exactly these tools. Each returns plain JSON. All angles are degrees. All times are ISO strings in UTC; formatting to local time happens in the UI layer.

```ts
export interface Place { lat: number; lon: number; elevation: number }

export interface SkyObject {
  name: string;
  kind: 'planet' | 'moon' | 'star';
  altitude: number;      // degrees above horizon, negative means below
  azimuth: number;       // degrees clockwise from north
  compass: string;       // 'NNE', 'E', ...
  fists: number;         // altitude / 10, rounded to 1 decimal
  magnitude: number | null;
  aboveHorizon: boolean;
}

export interface TonightResult {
  date: string;
  astroDuskUtc: string | null;
  astroDawnUtc: string | null;
  darkWindowMinutes: number | null;
  moon: MoonResult;
  planets: SkyObject[];  // all naked eye planets, sorted by altitude descending
}

export interface MoonResult {
  phaseName: string;     // 'New Moon', 'Waning Crescent', ...
  illuminationPct: number;
  riseUtc: string | null;
  setUtc: string | null;
  nextNewMoonUtc: string;
  aboveHorizon: boolean;
}

export type ToolCall =
  | { tool: 'tonight'; args: {} }
  | { tool: 'moon'; args: {} }
  | { tool: 'whats_up'; args: { direction?: string; minAltitude?: number } }
  | { tool: 'find_object'; args: { name: string } }
  | { tool: 'none'; args: {} };   // greeting, off topic, or unsupported
```

`find_object` returns a `SkyObject` plus `riseUtc` and `setUtc` when it is currently below the horizon. If the name is unknown it returns `{ found: false }`, and the narrator must say it does not know that object.

## 5. Verified reference code (sky core)

This was run against `astronomy-engine` before writing this spec. Use it as the starting point for `src/lib/sky/`.

```ts
import * as A from 'astronomy-engine';

export const observerFor = (p: { lat: number; lon: number; elevation: number }) =>
  new A.Observer(p.lat, p.lon, p.elevation);

// Sun, Moon, planets
export function horizonOf(body: A.Body, date: Date, obs: A.Observer) {
  const eq = A.Equator(body, date, obs, true, true);
  const hor = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

// Fixed stars from J2000 catalog coordinates (RA in hours, Dec in degrees).
// Body.Star1..Star8 only allows 8 custom stars, so we rotate the vector ourselves.
export function starHorizon(raHours: number, decDeg: number, date: Date, obs: A.Observer) {
  const time = A.MakeTime(date);
  const vecJ = A.VectorFromSphere(new A.Spherical(decDeg, raHours * 15, 1), time);
  const vecD = A.RotateVector(A.Rotation_EQJ_EQD(time), vecJ);
  const eq = A.EquatorFromVector(vecD);
  const hor = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

// Astronomical twilight: Sun 18 degrees below the horizon
export const astroDusk = (obs: A.Observer, from: Date) =>
  A.SearchAltitude(A.Body.Sun, obs, -1, from, 1, -18);
export const astroDawn = (obs: A.Observer, from: Date) =>
  A.SearchAltitude(A.Body.Sun, obs, +1, from, 1, -18);

// Moon
export const moonPhaseDegrees = (d: Date) => A.MoonPhase(d);            // 0 new, 90 first quarter, 180 full, 270 last quarter
export const moonIllumination = (d: Date) => A.Illumination(A.Body.Moon, d).phase_fraction;
export const moonRise = (obs: A.Observer, from: Date) => A.SearchRiseSet(A.Body.Moon, obs, +1, from, 1);
export const moonSet = (obs: A.Observer, from: Date) => A.SearchRiseSet(A.Body.Moon, obs, -1, from, 1);
export const nextNewMoon = (from: Date) => A.SearchMoonPhase(0, from, 40);

// Planet brightness
export const magnitude = (body: A.Body, d: Date) => A.Illumination(body, d).mag;

// Compass from azimuth
const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export const compass = (az: number) => DIRS[Math.round(az / 22.5) % 16];
```

Search functions return `null` when nothing occurs in the window, so always handle `null` (polar regions, or a moon that does not rise that day).

### Regression fixtures

Place: Delhi, lat 28.6139, lon 77.2090, elevation 216 m. Time: `2026-10-06T14:00:00Z`.

| Check | Expected |
|---|---|
| Sun altitude | about -19.7 |
| Saturn | altitude about 19.5, azimuth about 98.8 (east) |
| Jupiter | below horizon, altitude about -41.5 |
| Vega (RA 18.615649 h, Dec +38.783689) | altitude about 68.4, azimuth about 304.2 |
| Astronomical dusk | about 2026-10-06T13:49:51Z |
| Astronomical dawn (next) | about 2026-10-06T23:28:51Z |
| Moon illumination | about 18 percent, waning crescent |
| Moonrise | about 2026-10-06T21:17Z |
| Next new moon | about 2026-10-10T15:50Z |

These came from the library itself, so they protect against regressions. They are **not** independent proof. Independent proof comes from the Stellarium check in section 9.

## 6. Model layer

**Library:** `@mlc-ai/web-llm`. Run it in a web worker with `CreateWebWorkerMLCEngine` so the UI never freezes during loading or generation. Use `initProgressCallback` to drive the Prepare screen.

**Model:** a Gemma instruct build from WebLLM's prebuilt list. At the time of writing, `gemma-2-2b-it-q4f16_1-MLC` is in the prebuilt list. The q4f16_1 builds need the `shader-f16` WebGPU feature, so `webgpu.ts` must detect it and fall back to the `q4f32_1` build of the same model when it is missing. Before hard coding any ID, print what the installed version actually ships:

```bash
node -e "import('@mlc-ai/web-llm').then(w => console.log(w.prebuiltAppConfig.model_list.filter(m => /gemma/i.test(m.model_id)).map(m => m.model_id + '  vram_MB=' + m.vram_required_MB).join('\n')))"
```

Pick the smallest Gemma instruct entry that fits the phone. Keep the model ID in one constant so it can be swapped with one line.

Note: Google's MediaPipe LLM Inference web API is documented as maintenance only, so it is not used here even though it supports Gemma 3 1B.

**Two step flow (no reliance on native function calling, which WebLLM describes as preliminary):**

1. **Route.** One short call with constrained JSON output. The system prompt lists the tools and the user question follows. The output must match the `ToolCall` schema. Use WebLLM's JSON structured generation (`response_format`) with a JSON schema, and check the installed version's typings for the exact field shape.
2. **Run.** The app executes the chosen tool from `src/lib/sky/tools.ts`. The model is not involved.
3. **Narrate.** A second call receives the original question and the tool result JSON, with this instruction: answer in at most three sentences, use only numbers present in the JSON, give directions as compass words and heights in fists, and say plainly when something is below the horizon or unknown.

Keep temperature low (0 to 0.3) for routing and a little higher (0.4 to 0.6) for narration.

**Fallback (`fallback.ts`):** keyword rules choose the tool ("moon", "tonight", "what's up", planet and star names), and templates phrase the result. The app must be fully usable this way. State plainly in the UI which mode is active.

## 7. Offline plan

- `@vite-pwa/sveltekit` precaches the app shell, `stars.json` and fonts. No remote fonts, no CDN scripts.
- WebLLM stores model weights in browser storage. First load needs network (weights and the model library are fetched once). On the Prepare screen, call `navigator.storage.persist()` and show a clear readiness state: app cached, model cached, location saved.
- Location: request GPS once, store the last known place, allow manual lat/lon entry.
- Time zone display uses the device time zone through `Intl.DateTimeFormat`, which works offline.
- The only acceptable test of offline mode is a real device in airplane mode after fully closing and reopening the app.

## 8. Milestones

Legend: **[AGENT]** delegate with the prompt below. **[YOU]** write it yourself, because this is where the learning is. **[PAIR]** use an agent but review every line.

Every milestone ends by appending an entry to `LOG.md` (what was built, what surprised you, what the agent got wrong).

### M0. Scaffold and deploy [YOU] (about 45 minutes)

```bash
sudo pacman -S nodejs npm git
npx sv create .        # SvelteKit minimal, TypeScript, Tailwind, vitest
npm i astronomy-engine @mlc-ai/web-llm
npm i -D @vite-pwa/sveltekit @sveltejs/adapter-static
git init && git add -A && git commit -m "Initial scaffold (challenge window start)"
```

Switch to `adapter-static`, set `export const prerender = true` in the root layout, add `AGENTS.md`, `SPEC.md`, `LOG.md`, an MIT license, and a README line stating the start date. Push to a new public GitHub repo, deploy to Vercel, open the URL on your phone.

**Done when:** the empty app loads over HTTPS on your phone.

Also on the phone, open webgpureport.org in Chrome. Note whether WebGPU and `shader-f16` are reported. This decides the model build.

### M1. Sky core [AGENT]

Prompt:

> Read AGENTS.md and SPEC.md (sections 4, 5 and the regression fixtures). Implement `src/lib/sky/` as pure TypeScript: `observer.ts`, `bodies.ts`, `twilight.ts`, `moon.ts`, `format.ts`, and `tools.ts` exposing `tonight(place, date)`, `moon(place, date)`, `whatsUp(place, date, args)` and `findObject(place, date, name)` that return the exact types in section 4. Use the reference code in section 5 as the starting point. Planets are Mercury, Venus, Mars, Jupiter, Saturn. Handle `null` from every search function. Write Vitest tests that assert every row of the regression fixture table within sensible tolerances (0.3 degrees for positions, 2 minutes for times). Do not touch any file outside `src/lib/sky/` and its tests. Do not add dependencies. When done, run check, test and build, and append a LOG.md entry.

**Done when:** all tests pass and the agent explains each tolerance it chose.

### M2. Tonight screen [AGENT]

Prompt:

> Read AGENTS.md and SPEC.md. Build `src/routes/+page.svelte` using `src/lib/sky/tools.ts`. Show: dark window start and end in local time, moon phase and rise/set, and a list of planets with compass direction and height in fists, brightest and highest first, with below horizon planets collapsed under a quiet "not up yet" line. Add a location flow: use `navigator.geolocation` once, save the result, offer manual lat/lon entry. Add a `dark` and `red` theme toggle following the UI rules in AGENTS.md. Mobile first, large touch targets. Only touch `src/routes/+page.svelte`, a new `src/lib/ui/` folder and `src/app.css`. No model code yet.

**Done when:** it looks right on your phone and the numbers match the fixtures at the fixture time (add a debug query param `?t=2026-10-06T14:00:00Z` to freeze time).

### M3. Model engine [YOU]

Write `webgpu.ts` and `engine.ts` yourself. Goal: on your phone, load the model with a progress bar and get one hello world completion. Record load time, model download size, and tokens per second.

**Done when:** a single prompt returns text on the phone. If it cannot, record exactly why (no WebGPU, out of memory, no `shader-f16`), and decide between a smaller build or making the fallback the primary path.

### M4. Router and narrator [YOU, with an agent reviewing]

Write `router.ts`, `narrate.ts` and `ask.ts`. Then create `evals/questions.json` with 20 questions and the tool each should map to, including tricky ones ("is Mars up", "when does the moon rise", "what is that bright thing in the east", "hello", "what is the capital of France", "show me Betelgeuse").

Run the evals and record router accuracy. Iterate on the system prompt and schema until it is solid, and keep a log of each prompt version and its score. This table is your best material for the post.

Review prompt for an agent:

> Read AGENTS.md and SPEC.md section 6. Review `src/lib/llm/` for bugs, unhandled failure paths (engine load failure, invalid JSON, unknown tool, tool returns null) and any place the model could produce a number that was not in the tool result. Do not edit files. Report findings as a list ordered by severity.

**Done when:** the full question to answer loop works on the phone and the eval score is recorded.

### M5. Offline [PAIR]

Prompt:

> Read AGENTS.md and SPEC.md section 7. Add `@vite-pwa/sveltekit` with precaching for the app shell, `stars.json` and fonts. Build `src/routes/prepare/+page.svelte` showing three readiness checks (app cached, model cached, location saved), a download progress bar for the model, and a call to `navigator.storage.persist()`. Only touch the PWA config, the prepare route, and `src/lib/llm/engine.ts` if needed for progress and cache checks. Explain every assumption you make about where WebLLM stores weights.

**Done when:** after preparing on wifi, fully closing the app, enabling airplane mode and reopening, the tonight card and the model answers both work.

### M6. Stars [AGENT]

Pick an open bright star catalog and check its license before using it (the HYG database is a common choice; confirm its current license and credit it in the README). Keep about 300 stars with magnitude 3.0 or brighter.

Prompt:

> Read AGENTS.md and SPEC.md. Write `scripts/build-stars.mjs` that reads the catalog CSV I place in `scripts/data/` and outputs `src/lib/data/stars.json` as an array of `{ name, constellation, raHours, decDeg, magnitude }`, only named stars with magnitude 3.0 or brighter, sorted by magnitude. Write `src/lib/sky/stars.ts` using `starHorizon` from section 5, and extend `whatsUp` and `findObject` to include stars. Add tests (Polaris altitude should be within 1 degree of the observer latitude; Vega should match the fixture). Only touch those files plus tests.

**Done when:** "show me Betelgeuse" works and Polaris passes its sanity test.

### M7. Verify, field test, write [YOU]

See sections 9 and 10. The write up is yours. Do not delegate it.

## 9. Verification protocol

1. Install Stellarium and set the same location and time as the fixture.
2. For five objects (Saturn, Vega, the Moon, Polaris, one more star), compare altitude and azimuth with the app. Record both numbers. Differences under about one degree are expected, mostly from refraction settings.
3. Note anything larger than one degree and chase it down before the field test.

## 10. Field test protocol

New moon is about October 10 at 15:50 UTC, so the nights of October 9 and 10 should be the darkest of the week. Check the weather the day before and keep a backup night.

- Fully prepare on wifi first, then switch to airplane mode before leaving.
- Ask five real questions about things you can actually see, and check each answer against the sky.
- Record: signal bars (none), question, answer, correct or not, response time, battery drop over the session, phone temperature if it matters.
- Take photos or a short video of the setup outside with the phone in red mode.
- If the model fails or is too slow on the phone, record that honestly and show the fallback mode working. A truthful limitation is better than a hidden one.

## 11. Post skeleton (headings only, write it yourself)

1. Why the sky needs an offline tool
2. What Stargrass does
3. Why open weights mattered here (the offline, privacy and swap-the-model story, with real numbers)
4. How it works (code computes, model narrates)
5. What the agent got wrong and what I learned about prompting agents
6. The field test: what happened outside
7. What I would do next

Credit `astronomy-engine`, the star catalog, WebLLM and Gemma. State the project start date and that no code was reused from earlier projects.

## 12. Provenance

- Repository created October 6, 2026, inside the challenge window.
- No code copied from any previous project.
- Third party libraries and data are credited in the README.