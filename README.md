# Page Voice

Chrome extension (MV3) that upgrades the pages you already browse with
on-device ML, powered by [LiteRT.js](https://www.npmjs.com/package/@litertjs/core)
(WebGPU + WASM). All inference is local — nothing leaves the device.

Sibling project: [litertjs-demos](https://github.com/john-rocky/litertjs-demos)
— the same models as zero-install web pages (photo → 3D, text → speech).

First effect: **Page Voice** — give any page a voice.

- Select text on any page → right-click → *Read aloud* (or Alt+R).
- On ChatGPT / Claude / Gemini, toggle *Auto-read* in the HUD (bottom-right):
  streaming replies are spoken sentence-by-sentence as they arrive.
- TTS is Matcha-TTS on LiteRT.js (text encoder + vocoder on WebGPU, ODE
  decoder + G2P on threaded WASM). Model files (~92 MB) are fetched from
  Hugging Face on first use and kept in the Cache API.

## Develop

```
npm install
npm run build   # → dist/ (the unpacked extension)
```

Load it: `chrome://extensions` → Developer mode → *Load unpacked* → `dist/`.
Rebuild + press the extension's reload button after changes.

## Automated smoke tests

Both need a Chromium build that honors `--load-extension` (branded stable
ignores it since M137) — e.g. `npx @puppeteer/browsers install chrome@stable`
for Chrome for Testing:

```
node tools/smoke.mjs <chrome-binary> [--speak] [--profile=<dir>]  # boot gate
node tools/stream-smoke.mjs <chrome-binary> [--profile=<dir>]     # auto-read e2e
```

First run downloads the models; pass the same `--profile` dir afterwards to
reuse the cache. Verified 2026-08-13 (CfT 152): WebGPU works in the offscreen
document, the manifest COEP/COOP keys give cross-origin isolation (threaded
WASM), JSPI unavailable (falls back cleanly); RTF 0.35 warm / 0.63 cold at
4 Euler steps; streamed sentences are spoken while the stream is still going.

## Manual checklist (real Chrome)

1. Popup → *Load model* → state goes downloading → compiling → ready; the
   detail line shows the env probes (webgpu / threads / jspi).
2. Popup → *Speak test* — audio plays from the offscreen document.
3. Select a paragraph anywhere → right-click → *Read aloud* (or Alt+R).
4. chatgpt.com → HUD (bottom-right) → *Auto-read* on → ask something long.
   claude.ai / gemini selectors are best-effort — verify and adjust in
   `src/content.js` ADAPTERS.

## Architecture

```
content script (chat sites)      background service worker
  watcher + HUD  ──{target:'bg'}──►  menus/commands/routing
                                     │ ensureOffscreen()
                                     ▼
                              offscreen document
                                LiteRT.js + Matcha-TTS + AudioContext
                                (status broadcasts flow back the same way)
```

`src/offscreen/{synth,g2p}.js` are a validated JS port of the
[Matcha-TTS](https://huggingface.co/litert-community/Matcha-TTS) reference
pipeline (numerically checked against the Python implementation).

## License

Apache-2.0
