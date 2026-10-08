# LOG

One entry per milestone. What was built, what surprised me, what the agent got wrong.

## M0. Scaffold and deploy

**Built.** SvelteKit 2 with Svelte 5 and TypeScript, Tailwind 4, Vitest, and `adapter-static` with prerendering on. Added `astronomy-engine` and `@mlc-ai/web-llm`. Wrote `AGENTS.md`, `SPEC.md`, this log, the README and the MIT license.

**Surprised me.** The current `sv` CLI has moved the adapter out of `svelte.config.js` and into `vite.config.ts`, passed to the `sveltekit()` plugin directly. The spec assumed a `svelte.config.js` with an adapter import. The add-on `sveltekit-adapter` sets it for you, so there is no config file to edit at all. It also has a flag for the adapter, which meant no interactive prompt.

**Not sure yet.** `npm run test` currently reports no test files, since the scaffold example tests were removed. That is expected before M1. The Vercel deploy route was left open: CLI or GitHub integration. The GitHub CLI is not installed on this machine, so the repository is created by hand in the browser and pushed over HTTPS.

Printed the Gemma builds that the installed `@mlc-ai/web-llm` version actually ships, instead of trusting the ID written in the spec. Four matter: `gemma3-1b-it-q4f16_1-MLC` at 711 MB, `gemma-2b-it-q4f16_1-MLC` at 1477 MB, `gemma-2-2b-it-q4f16_1-MLC` at 1895 MB, and `gemma-2-2b-it-q4f32_1-MLC` at 2509 MB. The ID in the spec is real, so that plan stands.

One thing the spec did not anticipate: `gemma3-1b-it` only ships a `q4f16_1` build. There is no `q4f32_1` for the 1B model. If the phone reports no `shader-f16`, the smallest build that still runs is the 2B `q4f32_1` at 2509 MB of VRAM. So the fallback costs more memory than the model it replaces, which decides the plan more sharply than the spec assumed.

**Still open.** No phone check yet. WebGPU and `shader-f16` support are unverified, and that decides whether M3 uses the `q4f16_1` or `q4f32_1` Gemma build.## M1. Sky core

**Built.** `src/lib/sky/` as pure TypeScript with no UI imports: `observer.ts`, `bodies.ts`, `twilight.ts`, `moon.ts`, `format.ts`, `tools.ts`, plus 27 Vitest tests in `sky.spec.ts`. Every row of the section 5 fixture table has a test. All pass, and `check` and `build` are clean.

**The reference code in the spec does not reproduce its own fixture.** This is the one thing worth keeping from this milestone. The spec defines dusk as `SearchAltitude(Sun, observer, -1, from, 1, -18)` and then lists the expected answer as `2026-10-06T13:49:51Z` for a reference time of `14:00:00Z`. Those cannot both be right, because the expected answer is nine minutes *before* the reference time and a forward search cannot return the past.

The cause is real and worth understanding. At 14:00Z the sun is already 19.7 degrees below the horizon, so astronomical night is already underway and its dusk has happened. The naive search finds the next downward crossing instead, which is tomorrow at `13:48:44Z`, off by a full day. Starting the search a day earlier returns `13:49:51Z`, exactly the fixture. So `twilight.ts` checks the sun's altitude first and searches backward a day when the sun is already down.

Any "tonight" screen that searches forward for dusk will show the wrong night for every query made after dusk has passed, which is most of the night. This would have shipped as an off by one night bug that only shows up in the dark.

**Tolerances.** The spec asks for 0.3 degrees and 2 minutes and wants them explained.

Positions get 0.3 degrees because the library is deterministic: the same inputs give the same float every run, so observed error against each fixture row is zero to four thousandths of a degree, far inside the band. The band is not there to absorb noise in the code. It is slack for the J2000 to of date reduction that will change if astronomy-engine updates its star catalog or precession model, and for the one degree of difference the section 9 Stellarium comparison expects from refraction settings. A tolerance tighter than that would turn a library upgrade into a red test that means nothing.

Times get 2 minutes for the same reason plus one more. `SearchAltitude` and `SearchRiseSet` walk in fixed steps and interpolate, so their answers move by a few seconds as a step boundary shifts. Two minutes is generous on top of that, and it still catches a genuine error: the wrong dusk is off by 24 hours, and the wrong moon phase is off by several days, so nothing meaningful hides inside this band.

Illumination uses 1 percentage point, since the fixture says "about 18 percent" and the actual value is 18.4.

**Not sure yet.** The fixtures came from astronomy-engine itself, as the spec notes, so they prove the code does not regress, not that the numbers are right. They are not independent evidence. Stellarium in section 9 is.

`whatsUp` filters direction by exact compass match, so "E" returns Saturn but "east" returns nothing unless normalized upstream. M2 and M4 will have to normalize the word before it reaches here.

`phaseName` buckets phase degrees into eight 45 degree bands. That puts the boundary between Waning Crescent and New Moon at 337.5 degrees, which is correct, but a moon sitting exactly on a boundary jumps straight from one name to the next with nothing in between.
## M2. Tonight screen

**Built.** `src/routes/+page.svelte` showing the dark window in local time, its length, the moon with phase, illumination and rise time, and the planets with compass direction and height in fists, highest first, with the ones below the horizon folded under a quiet disclosure. Location comes from one geolocation request with manual entry as the fallback, stored as a couple of numbers. `src/lib/ui/place.ts` and `src/lib/ui/theme.ts` hold the two small pieces of state. Themes are near black and pure red, with the red defined as red channel only so night vision is preserved. `check`, `test` and `build` are clean.

**SvelteKit 3 removed `$lib`, and the spec has not caught up.** The spec writes imports as `$lib/sky/...`. That alias no longer exists. It now throws a hard error pointing at `#lib`, which the scaffold had already wired up through the `imports` field in package.json. I hit this on the first `check` of this milestone.

Worse, `npm run check` was reporting success the whole time before this. Every file up to now imported by relative path, so the missing alias was never exercised. The generated `$app/tsconfig.json` had `"paths": {}`, which is the tell: no aliases were registered at all, including `$app/environment` and `$app/state`. The type checker was only ever checking code that had no alias in it, so "0 errors" meant much less than it appeared to.

TypeScript cannot resolve the `#lib` subpath imports on its own either. I confirmed that outside the project with a clean `tsc --ignoreConfig` run, so it is not a svelte-check quirk. The fix is four lines of explicit `paths` in our own tsconfig.

**Two deviations from the milestone prompt, both needing sign off.** The prompt allowed touching `src/app.css`, which does not exist; the stylesheet is `src/routes/layout.css`. I edited the file that is actually there rather than renaming it. And I had to touch `tsconfig.json`, which the prompt did not list, because without it no UI code can compile at all. Revert either if you disagree.

**Not sure yet.** The theme is applied in `onMount`, so a user who chose red mode sees one dark frame before red arrives. Fixing it properly means a small inline script in `src/app.html`, which is outside this milestone's file list, so I left it. It is more noticeable than it sounds for an app meant to be opened in the dark.

**Verified against the fixtures.** At `?t=2026-10-06T14:00:00Z` with Delhi entered by hand the screen reads: dark window 07:19 PM to 04:58 AM, 9h 39m of full darkness, Waning Crescent 18 percent lit, moon rising 02:47 AM, Saturn east at 1.9 fists, and Mercury, Venus, Mars and Jupiter folded away. The underlying UTC values are the fixture values to the second.

**Not verified.** Everything above was checked by rendering the formatting logic, not by looking at a real phone. Red mode, touch target sizes and the disclosure element are unconfirmed until it is on the device.
