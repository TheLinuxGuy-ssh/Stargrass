# LOG

One entry per milestone. What was built, what surprised me, what the agent got wrong.

## M0. Scaffold and deploy

**Built.** SvelteKit 2 with Svelte 5 and TypeScript, Tailwind 4, Vitest, and `adapter-static` with prerendering on. Added `astronomy-engine` and `@mlc-ai/web-llm`. Wrote `AGENTS.md`, `SPEC.md`, this log, the README and the MIT license.

**Surprised me.** The current `sv` CLI has moved the adapter out of `svelte.config.js` and into `vite.config.ts`, passed to the `sveltekit()` plugin directly. The spec assumed a `svelte.config.js` with an adapter import. The add-on `sveltekit-adapter` sets it for you, so there is no config file to edit at all. It also has a flag for the adapter, which meant no interactive prompt.

**Not sure yet.** `npm run test` currently reports no test files, since the scaffold example tests were removed. That is expected before M1. The Vercel deploy route was left open: CLI or GitHub integration. The GitHub CLI is not installed on this machine, so the repository is created by hand in the browser and pushed over HTTPS.

Printed the Gemma builds that the installed `@mlc-ai/web-llm` version actually ships, instead of trusting the ID written in the spec. Four matter: `gemma3-1b-it-q4f16_1-MLC` at 711 MB, `gemma-2b-it-q4f16_1-MLC` at 1477 MB, `gemma-2-2b-it-q4f16_1-MLC` at 1895 MB, and `gemma-2-2b-it-q4f32_1-MLC` at 2509 MB. The ID in the spec is real, so that plan stands.

One thing the spec did not anticipate: `gemma3-1b-it` only ships a `q4f16_1` build. There is no `q4f32_1` for the 1B model. If the phone reports no `shader-f16`, the smallest build that still runs is the 2B `q4f32_1` at 2509 MB of VRAM. So the fallback costs more memory than the model it replaces, which decides the plan more sharply than the spec assumed.

**Still open.** No phone check yet. WebGPU and `shader-f16` support are unverified, and that decides whether M3 uses the `q4f16_1` or `q4f32_1` Gemma build.