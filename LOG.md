# LOG

One entry per milestone. What was built, what surprised me, what the agent got wrong.

## M0. Scaffold and deploy

**Built.** SvelteKit 2 with Svelte 5 and TypeScript, Tailwind 4, Vitest, and `adapter-static` with prerendering on. Added `astronomy-engine` and `@mlc-ai/web-llm`. Wrote `AGENTS.md`, `SPEC.md`, this log, the README and the MIT license.

**Surprised me.** The current `sv` CLI has moved the adapter out of `svelte.config.js` and into `vite.config.ts`, passed to the `sveltekit()` plugin directly. The spec assumed a `svelte.config.js` with an adapter import. The add-on `sveltekit-adapter` sets it for you, so there is no config file to edit at all. It also has a flag for the adapter, which meant no interactive prompt.

**Not sure yet.** `npm run test` currently reports no test files, since the scaffold example tests were removed. That is expected before M1. The Vercel deploy route was left open: CLI or GitHub integration. The GitHub CLI is not installed on this machine, so the repository is created by hand in the browser and pushed over HTTPS.

Printed the Gemma builds that the installed `@mlc-ai/web-llm` version actually ships, instead of trusting the ID written in the spec. Four matter: `gemma3-1b-it-q4f16_1-MLC` at 711 MB, `gemma-2b-it-q4f16_1-MLC` at 1477 MB, `gemma-2-2b-it-q4f16_1-MLC` at 1895 MB, and `gemma-2-2b-it-q4f32_1-MLC` at 2509 MB. The ID in the spec is real, so that plan stands.

One thing the spec did not anticipate: `gemma3-1b-it` only ships a `q4f16_1` build. There is no `q4f32_1` for the 1B model. If the phone reports no `shader-f16`, the smallest build that still runs is the 2B `q4f32_1` at 2509 MB of VRAM. So the fallback costs more memory than the model it replaces, which decides the plan more sharply than the spec assumed.

**A later correction to the paragraph above, found while preparing M3.** Every `q4f16_1` build in the prebuilt list declares `required_features: ["shader-f16"]`, which is how WebLLM decides a model is unloadable on a given device. `gemma3-1b-it-q4f16_1-MLC` alone declares `null`. That is a registry bug: the build is half precision and needs the feature, but its manifest entry forgets to say so.

This matters in both directions. On a phone with `shader-f16`, `gemma3-1b-it` at 711 MB is by far the best choice and its manifest is merely misleading. On a phone without it, WebLLM will not skip the model, because nothing in the registry says to. It will attempt the load and fail inside shader compilation, which produces a confusing error instead of a clean fallback. So "pick the smallest Gemma instruct entry", which is what the spec says to do, lands on precisely the model that fails worst on the devices that need the fallback. `webgpu.ts` has to detect `shader-f16` itself and treat `gemma3-1b-it` as f16 regardless of what its manifest claims.

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

## M3. Model engine: the phone has no GPU adapter

**Result: the on device model cannot run on the test device.** Recording the reason properly, because the spec asks for it and because it is not the reason I expected.

The test phone is an iPhone 11 running Safari 26. WebGPU is genuinely present there, which was the surprise. Safari 26 shipped WebGPU enabled by default on iOS 26, and the iPhone 11 is far enough up Apple's support list to receive the update. A capability check based on `navigator.gpu` alone would have reported success and sent us on to load a model.

It fails one step later. `requestAdapter()` resolves to `null`, which the WebGPU specification defines as "no matching adapter is available". No adapter means no device can ever be created, so there is nothing for WebLLM to run on. Not slow. Not out of memory. Absent.

So this is not the shader-f16 problem the spec spent a paragraph on, and it is not fixed by a smaller build. There is no smaller build that creates a GPU where there is none.

**The desktop is no escape either.** This machine is Asahi Linux on Apple M1, with a real Vulkan 1.4 device. In headless Chromium, WebGPU comes up, but it comes up as `swiftshader`, Google's software rasterizer, with `shader-f16` absent and a 1 GB buffer limit. Forcing the hardware path with `--use-angle=vulkan` and `--use-vulkan=native` makes the probe hang and never return at all. So the one place that might have loaded a model will only offer a software rasterizer, where a 1B model would crawl, and the storage quota came back at 2.1 GB.

**Consequence.** There is no device in this window on which the model path can be demonstrated. Per section 8, M3 done when says that if it cannot run, record why and decide between a smaller build and making the fallback primary. A smaller build is meaningless here, so the fallback is the primary path on the test device.

**What this does not mean.** It does not mean the model code is pointless. `webgpu.ts`, `engine.ts`, `router.ts` and `narrate.ts` will still run on a device with a working adapter, such as Chrome on Android 12 or later with a Qualcomm or ARM GPU, which is the large majority of WebGPU page views. The code ships. It simply cannot be proven here, and the README should say so rather than implying a demo that was never recorded.

**How the finding was reached.** Two dead ends worth recording, because both would have produced a confident wrong answer.

First, webgpureport.org reports HDR canvas and offscreen canvas support next to its WebGPU verdict. Reporting those back means reading the wrong section. Neither says anything about WebGPU.

Second, and worse, my own first probe was wrong. I served it over `http://192.168.x.x`, and WebGPU requires a secure context, so `navigator.gpu` would have been undefined there and the page would have reported a confident, entirely false `ABSENT`. It now checks `isSecureContext` first and refuses to answer without it. A diagnostic that returns a plausible wrong answer is worse than one that returns nothing.

## M5. Offline, and the ask box

**Built.** The ask box and its answer path, the keyword router and templates behind it, and a service worker that makes the whole app work with no signal. The UI states plainly which mode is answering, and whether the app is saved for offline use.

**Verified offline, properly.** Not "the service worker file exists". Served the production build over HTTP, loaded it once in a real browser, confirmed fifteen files were in the cache, killed the server outright, reloaded, and asked four questions. All four answered correctly with the server refusing connections. That is the same test section 10 asks for in airplane mode, done with a killed process instead of an aeroplane.

Answers with the server dead, at the fixture instant in Delhi:

```
how dark is it tonight          Full darkness runs from 07:19 PM to 04:58 AM, which is 9h 39m.
when does the moon rise         The moon is a Waning Crescent, 18 percent lit and it rises at 02:47 AM local.
is Mars up                      Mars is below the horizon right now. It rises at 01:01 AM local.
what is that bright thing in the east   Looking east you should see Saturn (E, 1.9 fists).
```

**A service worker cannot cache the visit that installs it.** The obvious version of this worked and would have failed in the field. After the first load the cache held three files, all of them the entry points listed in `install`. The JavaScript and CSS were missing, because those requests were already in flight before the worker took control, so they never passed through the `fetch` handler.

The fix is that the page reports every same origin URL it actually loaded, using `performance.getEntriesByType('resource')`, and the worker fetches those into the cache on purpose. Fifteen files instead of three. This is why the app says "saved for offline use" only after confirming the files are readable from the cache, rather than as soon as registration succeeds.

**`@vite-pwa/sveltekit` does not work on SvelteKit 3, so I removed it.** It declares a peer range of `@sveltejs/kit ^1.3.1 || ^2.0.1` and had to be installed with `--legacy-peer-deps` to be allowed at all. It then emitted a `manifest.webmanifest` and a `registerSW.js` pointing at `./sw.js`, and never generated `sw.js` at all, because its generate step does not fire under this build. The wrapper also ships no CLI to run that step by hand.

Since `adapter-static` prerenders everything, the worker is about forty lines and easier to own than to coerce. `static/sw.js` precaches the stable entry points, serves navigations network first with a cache fallback, and serves content addressed assets cache first. No dependency, and nothing to break when the plugin's peer range catches up.

**One real bug the browser found that the tests did not.** The moon answer came back as "rises at 02:47 AM local.." with two full stops, because the template built its clauses with trailing punctuation and then appended another. A test asserting the answer contains a phase name passed happily. The check that caught it looks for any repeated full stop in any template, which is the sort of thing worth having for text a user reads.

**Not verified.** Offline was proven against a local HTTP server, not Vercel, and not in Safari on the phone. The service worker needs a secure context, and Vercel is one, so the mechanism should hold, but the field test is still the real test. The theme still applies after first paint, so a red mode user gets one dark frame on load.
