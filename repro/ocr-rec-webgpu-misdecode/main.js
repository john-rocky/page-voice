/**
 * PP-OCRv5 recognizer decodes differently on WebGPU vs WASM (same crops,
 * same preprocessing). Runs the recognizer (fp16 and fp32 weights) on a
 * fixed set of committed text-crop PNGs on both backends and compares the
 * CTC-decoded strings. WebGPU is run twice per crop to show the wrong
 * output is deterministic.
 */
import { Tensor, isWebGPUSupported, loadAndCompile, loadLiteRt } from '@litertjs/core';
import { fetchCached, log, setResult, status } from '../shared.js';

const HF = 'https://huggingface.co/litert-community/PP-OCRv5-LiteRT/resolve/main';
const REC_H = 48;
const REC_W = 320;

/** rgba (h=48, w=contentW) -> NCHW float32 [1,3,48,320], pad value -1. */
function recPreprocess(rgba, contentW) {
  const plane = REC_H * REC_W;
  const nchw = new Float32Array(3 * plane).fill(-1);
  for (let y = 0; y < REC_H; y++) {
    for (let x = 0; x < contentW; x++) {
      const src = (y * contentW + x) * 4;
      const dst = y * REC_W + x;
      nchw[dst] = rgba[src] / 255 / 0.5 - 1;
      nchw[plane + dst] = rgba[src + 1] / 255 / 0.5 - 1;
      nchw[2 * plane + dst] = rgba[src + 2] / 255 / 0.5 - 1;
    }
  }
  return nchw;
}

/** CTC greedy decode: logits [T,C] flat -> text. */
function ctcDecode(logits, T, C, chars) {
  const ids = new Int32Array(T);
  for (let t = 0; t < T; t++) {
    const off = t * C;
    let best = 0;
    let bestV = logits[off];
    for (let c = 1; c < C; c++) {
      if (logits[off + c] > bestV) { bestV = logits[off + c]; best = c; }
    }
    ids[t] = best;
  }
  let text = '';
  for (let t = 0; t < T; t++) {
    const c = ids[t];
    if (c !== 0 && (t === 0 || c !== ids[t - 1])) text += chars[c] ?? '';
  }
  return { text, ids: Array.from(ids) };
}

async function loadCropTensor(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  if (bmp.height !== REC_H) throw new Error(`${file}: expected height ${REC_H}, got ${bmp.height}`);
  const w = Math.min(bmp.width, REC_W);
  const c = new OffscreenCanvas(w, REC_H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0); // 1:1, no resampling
  return recPreprocess(ctx.getImageData(0, 0, w, REC_H).data, w);
}

async function run(model, nchw) {
  const input = Tensor.fromTypedArray(nchw, [1, 3, REC_H, REC_W]);
  const outputs = await model.run([input]);
  const data = await outputs[0].data();
  for (const o of outputs) o.delete();
  input.delete();
  return data;
}

async function main() {
  status.state = 'loading';
  await loadLiteRt('/litert-wasm/', { threads: globalThis.crossOriginIsolated, jspi: false });
  if (!isWebGPUSupported()) throw new Error('WebGPU unavailable');

  const [fp16, fp32, dictText, manifest] = await Promise.all([
    fetchCached(`${HF}/ppocr_rec_fp16.tflite`),
    fetchCached(`${HF}/ppocr_rec_fp32.tflite`),
    fetchCached(`${HF}/ppocrv5_dict.txt`).then((b) => new TextDecoder().decode(b)),
    fetch('crops/manifest.json').then((r) => r.json()),
  ]);
  const lines = dictText.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const chars = ['', ...lines, ' ']; // blank + dict + space
  const C = chars.length;

  status.state = 'compiling';
  const numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
  const models = {
    'fp16-webgpu': await loadAndCompile(fp16, { accelerator: 'webgpu' }),
    'fp16-wasm': await loadAndCompile(fp16, { accelerator: 'wasm', cpuOptions: { numThreads } }),
    'fp32-webgpu': await loadAndCompile(fp32, { accelerator: 'webgpu' }),
    'fp32-wasm': await loadAndCompile(fp32, { accelerator: 'wasm', cpuOptions: { numThreads } }),
  };

  status.state = 'running';
  const rows = [];
  for (const { file, truth } of manifest) {
    const nchw = await loadCropTensor(`crops/${file}`);
    const decoded = {};
    for (const [name, model] of Object.entries(models)) {
      const out = await run(model, nchw);
      decoded[name] = ctcDecode(out, out.length / C, C, chars).text;
    }
    const out2 = await run(models['fp16-webgpu'], nchw);
    const again = ctcDecode(out2, out2.length / C, C, chars).text;
    const row = {
      file,
      truth,
      ...decoded,
      fp16Equal: decoded['fp16-webgpu'] === decoded['fp16-wasm'],
      fp32Equal: decoded['fp32-webgpu'] === decoded['fp32-wasm'],
      webgpuDeterministic: decoded['fp16-webgpu'] === again,
    };
    rows.push(row);
    log(`${row.fp16Equal ? 'ok  ' : 'DIFF'} ${file}`);
    log(`  truth       : "${truth}"`);
    log(`  fp16 wasm   : "${decoded['fp16-wasm']}"`);
    log(`  fp16 webgpu : "${decoded['fp16-webgpu']}"${row.webgpuDeterministic ? '' : '  (NON-DETERMINISTIC)'}`);
    log(`  fp32 wasm   : "${decoded['fp32-wasm']}"`);
    log(`  fp32 webgpu : "${decoded['fp32-webgpu']}"`);
  }
  const summary = {
    crops: rows.length,
    fp16Equal: rows.filter((r) => r.fp16Equal).length,
    fp32Equal: rows.filter((r) => r.fp32Equal).length,
    webgpuDeterministic: rows.filter((r) => r.webgpuDeterministic).length,
    threads: globalThis.crossOriginIsolated,
    numThreads,
  };
  log('\nSUMMARY ' + JSON.stringify(summary));
  setResult({ ok: true, summary, rows });
}

main().catch((err) => {
  log(String(err?.stack ?? err));
  setResult({ ok: false, error: String(err?.stack ?? err) });
});
