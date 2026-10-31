# Page Voice

Chrome extension (MV3) that upgrades the pages you already browse with
on-device ML, powered by [LiteRT.js](https://www.npmjs.com/package/@litertjs/core)
(WebGPU + WASM). All inference is local — nothing leaves the device.

Sibling project: [page-demos](https://github.com/john-rocky/page-demos)
— the same models as zero-install web pages (photo → 3D, text → speech).

Upstream sample: the same three extensions (Page Voice, Page 3D, Page Text)
are a LiteRT sample at
[`samples/web_demos/chrome_extension`](https://github.com/google-ai-edge/litert-samples/tree/main/samples/web_demos/chrome_extension)
in google-ai-edge/litert-samples (merged 2026-10-09).

First effect: **Page Voice** — give any page a voice.
Second effect (WIP): **Page 3D** — hover any photo to see it in 3D
(MoGe-2 depth → plane-mesh parallax). Build with `node build.mjs --3d`
→ `dist3d/`; smoke/E2E tests live in `tools3d/`.
Third effect (WIP): **Page Text** — right-click any image to select and
copy the text inside it, and **Alt+Shift+F to search inside images**
(PP-OCRv5, Japanese and English). Build with `node build.mjs --ocr` →
`dist-ocr/`; tests live in `tools-ocr/`. See [Page Text](#page-text) below.

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

## Page Text

**Find in images (Alt+Shift+F).** The browser's own Cmd+F cannot see inside a
screenshot. This indexes the page's images in the background as you scroll —
queued behind any interactive read, one at a time, cached by image URL in
IndexedDB so scrolling back is free — then highlights the lines that match.
Searching happens over *logical* lines: a rec window splits "…has 8 power" /
"outlets for 20 people…", so matches are found on the merged text and the
highlight is drawn as one box per line.

Right-click an image → *Select text in this image*. The offscreen document
reads it with [PP-OCRv5](https://huggingface.co/litert-community/PP-OCRv5-LiteRT)
and the content script lays a transparent, selectable text layer over the
image (PDF.js-style), with *Copy all*. Models (~43 MB) come from Hugging
Face on first use and stay in the Cache API.

**Backends.** Detection runs on WebGPU (12–16 ms per image). Recognition
runs on WebGPU too, from a recognizer file made for it. On WebGPU,
`ppocr_rec_fp32.tflite` mis-decodes real text crops — deterministic,
confident errors clustered at line starts ("Every day" → "YveerydaYyw",
日 → a; [LiteRT #9661](https://github.com/google-ai-edge/LiteRT/issues/9661)).
So with WebGPU the extension downloads `ppocr_rec_fp32_webgpu.tflite`,
which computes the attention scores as two products over 20 keys instead
of one over 40. Before using it, the extension reads one fixed line
(`check-line.png`) on WebGPU and on WASM and compares the character each
of the 40 output steps picks; if any differs, the extension runs this
file on WASM instead. The popup shows which backend each model runs on.
Without WebGPU, recognition runs on WASM with `ppocr_rec_fp32.tflite`
(~21 ms per line window). On a 12-image test set (screenshots, photos,
receipts), 0.1.2 copied the same text as 0.1.1 from every image. The
median time per image (fetch, detection, recognition) over the 11
smaller images fell from about 1.4 s to about 0.5 s, and the largest
photo went from about 4.7 s to 1.6 s (Chrome for Testing 156, Apple M4
Max). The fp16 recognizer is not used, because XNNPACK
declines its graph and falls back to reference kernels at ~430 ms per
line. `tools-ocr/verify.mjs` is the harness that first established the
WebGPU mis-decode.

```
node tools-ocr/verify.mjs <chrome-binary> [--profile=<dir>]   # backend equivalence
node tools-ocr/make-fixtures.mjs <chrome-binary>              # test images
node tools-ocr/smoke.mjs <chrome-binary> [--profile=<dir>]    # pipeline regression floor
node tools-ocr/e2e.mjs <chrome-binary> [--profile=<dir>]      # overlay, real message path
node tools-ocr/find-e2e.mjs <chrome-binary> [--profile=<dir>] # index + search over a mock feed
```

Pass a persistent `--profile` dir: in a throwaway profile the freshly
installed extension's service worker cannot reach the content script yet,
so context-menu activation silently does nothing.

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
