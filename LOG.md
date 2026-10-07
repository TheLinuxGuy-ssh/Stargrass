# LOG

One entry per milestone. What was built, what surprised me, what the agent got wrong.

## M0. Scaffold and deploy

**Built.** SvelteKit 2 with Svelte 5 and TypeScript, Tailwind 4, Vitest, and `adapter-static` with prerendering on. Added `astronomy-engine` and `@mlc-ai/web-llm`. Wrote `AGENTS.md`, `SPEC.md`, this log, the README and the MIT license.

**Surprised me.** The current `sv` CLI has moved the adapter out of `svelte.config.js` and into `vite.config.ts`, passed to the `sveltekit()` plugin directly. The spec assumed a `svelte.config.js` with an adapter import. The add-on `sveltekit-adapter` sets it for you, so there is no config file to edit at all. It also has a flag for the adapter, which meant no interactive prompt.

**Not sure yet.** `npm run test` currently reports no test files, since the scaffold example tests were removed. That is expected before M1. The Vercel deploy route was left open: CLI or GitHub integration. The GitHub CLI is not installed on this machine, so the repository is created by hand in the browser and pushed over HTTPS.

**Still open.** No phone check yet. WebGPU and `shader-f16` support are unverified, and that decides whether M3 uses the `q4f16_1` or `q4f32_1` Gemma build.