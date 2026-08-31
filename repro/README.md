# Minimal repros — LiteRT.js backend divergences

Self-contained reproductions for issues observed while shipping LiteRT.js
models in browser extensions. Each case is one page that loads
`@litertjs/core` from npm, fetches public models from Hugging Face, runs the
same input on two backends, and prints a comparison. No extension code is
involved.

## Run

```bash
npm install            # repo root: @litertjs/core + esbuild
node repro/serve.mjs   # builds the pages, serves them with COOP/COEP
```

Open the printed URL in Chrome and pick a case; results appear on the page
and in the console, and are exposed as JSON on `globalThis.__repro.result`.
Optionally drive a case from a terminal instead:

```bash
node repro/run-headless.mjs <path-to-chrome-binary> <case-name>
```

## Cases

| Case | What it shows |
|---|---|
| `ocr-rec-webgpu-misdecode` | PP-OCRv5 recognizer decodes real text crops to different strings on WebGPU vs WASM — deterministic, same result for fp16 and fp32 weights. Crops are committed PNGs (self-authored text), so the repro is pixel-identical everywhere. |
| `ocr-rec-fp16-wasm-slow` | The fp16 PP-OCRv5 recognizer runs ~20× slower than its fp32 parent on the WASM (XNNPACK) backend; both run ~5 ms on WebGPU. |
| `matcha-decoder-webgpu-mismatch` | The Matcha-TTS flow-matching decoder's WebGPU output diverges from WASM at the 0.3 mean-abs level (sign flips), with pipeline-realistic inputs; persists with a full-length mask. |
| `depth-anything-v2-webgpu-compile` | google-ai-edge/LiteRT#9481 reproduction: depth_anything_v2_small (w-int8) fails `loadAndCompile` on WebGPU (`Unable to parse bc coord for BATCH axis`), compiles fine on WASM. |

Models: [litert-community/PP-OCRv5-LiteRT](https://huggingface.co/litert-community/PP-OCRv5-LiteRT),
[litert-community/Matcha-TTS](https://huggingface.co/litert-community/Matcha-TTS),
[webnn/depth-anything-v2-small](https://huggingface.co/webnn/depth-anything-v2-small).
They are fetched on first run and kept in the browser's Cache API.
