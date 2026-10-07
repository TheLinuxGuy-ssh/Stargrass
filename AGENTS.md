# AGENTS.md

Rules for any AI agent working in this repository. Read this and `SPEC.md` before doing anything.

## Project in one line

Stargrass is an offline night sky guide. A small open-weight Gemma model runs in the browser, calls deterministic astronomy tools, and explains the results in plain language. The screen should be the shortest part of the experience.

## Hard rules

1. Work on one milestone at a time, exactly as written in `SPEC.md`. Do not start the next milestone.
2. Only touch the files listed in the milestone prompt. If you need to touch another file, stop and ask.
3. Do not add a dependency without asking first. Allowed from the start: `astronomy-engine`, `@mlc-ai/web-llm`, `@vite-pwa/sveltekit`, Tailwind, Vitest.
4. No backend, no database, no analytics, no network calls at runtime except the one-time model and asset download. Everything must work in airplane mode after preparation.
5. The model never computes astronomy. All positions, times and phases come from `src/lib/sky/`. The model picks a tool and phrases the result.
6. Never invent numbers. If a tool returns nothing (object below the horizon, no rise today), say so plainly.
7. Never use `localStorage` for anything that must survive; use IndexedDB or the Cache API for model data, and `localStorage` only for small settings.
8. Do not copy code from any other project of mine. Everything in this repo is written fresh during the challenge window.

## Stack

- SvelteKit with Svelte 5 and TypeScript, static adapter (`@sveltejs/adapter-static`)
- Tailwind CSS
- `astronomy-engine` for all sky math
- `@mlc-ai/web-llm` for on-device inference (WebGPU)
- Vitest for unit tests
- Deployed as a static site over HTTPS

## Code style

- TypeScript strict mode, no `any`
- Small pure functions in `src/lib/sky/`, no UI imports there
- Every exported function in `src/lib/sky/` has a unit test
- No comments that restate the code; comment only the why
- Prefer boring and readable over clever

## UI rules

- Near-black background, low contrast text, no bright whites
- Two themes only: `dark` and `red` (night vision mode, pure red on black, no other hues)
- Large touch targets, one primary action per screen
- Answers shown to the user are one to three sentences
- No decorative animation. Nothing that flashes or glows.

## Definition of done for any task

1. `npm run check` passes (types)
2. `npm run test` passes
3. `npm run build` passes
4. The feature works with the network disabled (after preparation)
5. A short note is added to `LOG.md`: what was built, what surprised you, what you were unsure about

## When unsure

Stop and ask. A short question is cheaper than a wrong guess in a five day build.

## Writing rules for README and docs

Plain, human, specific. No dashes used as punctuation. No filler phrases, no hype words.