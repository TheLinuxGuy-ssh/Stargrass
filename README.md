# Stargrass

An offline night sky guide. A small open weight Gemma model runs in your browser, asks deterministic astronomy tools for the real numbers, and explains the result in plain language.

The point is the dark sky. The best places to use it have no signal, so after a one time preparation on wifi the whole thing works in airplane mode with the phone in your pocket.

Started October 6, 2026.

## How it works

The model never does astronomy. Every position, rise time and phase comes from `astronomy-engine`. The model chooses which tool to call and phrases what the tool returned. If a tool has nothing to say, the answer says so plainly.

## Credits

- [`astronomy-engine`](https://github.com/cosinekitty/astronomy) for all sky math
- [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm) for running the model in the browser over WebGPU
- Google Gemma for the model weights

## Status

Under construction during the DEV Hacktoberfest Open Source AI Challenge, Week 1 (Touch Grass). Milestones and findings are recorded in `LOG.md`.

## License

MIT