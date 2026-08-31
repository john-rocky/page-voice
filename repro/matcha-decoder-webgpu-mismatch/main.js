/**
 * The Matcha-TTS flow-matching decoder produces very different outputs on
 * WebGPU vs WASM. Inputs are built the way the real TTS pipeline builds
 * them (x = seeded N(0,1) noise in the valid region — that IS the real
 * inference-time input — sinusoidal ODE-time embedding, binary frame mask),
 * so the mismatch is not an out-of-distribution artifact. WebGPU is run
 * twice to show its output is deterministic.
 */
import { Tensor, isWebGPUSupported, loadAndCompile, loadLiteRt } from '@litertjs/core';
import { fetchCached, log, makeRandn, setResult, status } from '../shared.js';

const MODEL = 'https://huggingface.co/litert-community/Matcha-TTS/resolve/main/matcha_decoder_fp16.tflite';
const F = 80; // mel bins
const L = 512; // max frames
const TDIM = 160; // ODE-time embedding dim

/** Matcha SinusoidalPosEmb, scale=1000. */
function sinPosEmb(t, dim) {
  const half = dim / 2;
  const out = new Float32Array(dim);
  const k = -Math.log(10000) / (half - 1);
  for (let i = 0; i < half; i++) {
    const e = 1000.0 * t * Math.exp(i * k);
    out[i] = Math.sin(e);
    out[half + i] = Math.cos(e);
  }
  return out;
}

function buildInputs(ylen, seed) {
  const randn = makeRandn(seed);
  const x = new Float32Array(F * L);
  const mu = new Float32Array(F * L);
  for (let c = 0; c < F; c++) {
    for (let f = 0; f < ylen; f++) {
      x[c * L + f] = randn();
      mu[c * L + f] = randn();
    }
  }
  const mask = new Float32Array(L);
  for (let f = 0; f < ylen; f++) mask[f] = 1;
  return { x, mu, ts: sinPosEmb(0, TDIM), mask };
}

async function run(model, { x, mu, ts, mask }) {
  const tensors = [
    Tensor.fromTypedArray(x, [1, F, L]),
    Tensor.fromTypedArray(mu, [1, F, L]),
    Tensor.fromTypedArray(ts, [1, TDIM]),
    Tensor.fromTypedArray(mask, [1, 1, L]),
  ];
  const outputs = await model.run(tensors);
  const data = await outputs[0].data();
  for (const o of outputs) o.delete();
  for (const t of tensors) t.delete();
  return data;
}

function diffStats(a, b, ylen) {
  let maxAbs = 0;
  let maxAt = -1;
  let sum = 0;
  let maxAbsOutside = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    const inMask = (i % L) < ylen;
    if (inMask) {
      sum += d;
      if (d > maxAbs) { maxAbs = d; maxAt = i; }
    } else if (d > maxAbsOutside) {
      maxAbsOutside = d;
    }
  }
  const n = F * ylen;
  return {
    maxAbsDiff: +maxAbs.toFixed(4),
    meanAbsDiff: +(sum / n).toFixed(4),
    maxAbsDiffOutsideMask: +maxAbsOutside.toFixed(4),
    at: maxAt < 0 ? null : { mel: Math.floor(maxAt / L), frame: maxAt % L, a: +a[maxAt].toFixed(4), b: +b[maxAt].toFixed(4) },
  };
}

async function main() {
  status.state = 'loading';
  await loadLiteRt('/litert-wasm/', { threads: globalThis.crossOriginIsolated, jspi: false });
  if (!isWebGPUSupported()) throw new Error('WebGPU unavailable');
  const bytes = await fetchCached(MODEL);

  status.state = 'compiling';
  const numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
  const cpu = await loadAndCompile(bytes, { accelerator: 'wasm', cpuOptions: { numThreads } });
  const gpu = await loadAndCompile(bytes, { accelerator: 'webgpu' });

  status.state = 'running';
  const out = {};
  for (const ylen of [200, L]) { // partial-length mask (typical) and full-length mask
    const inputs = buildInputs(ylen, 7);
    const vCpu = await run(cpu, inputs);
    const vGpu = await run(gpu, inputs);
    const vGpu2 = await run(gpu, inputs);
    let gpuDet = true;
    for (let i = 0; i < vGpu.length; i++) {
      if (vGpu[i] !== vGpu2[i]) { gpuDet = false; break; }
    }
    const stats = diffStats(vGpu, vCpu, ylen);
    out[`ylen${ylen}`] = { ...stats, webgpuDeterministic: gpuDet };
    log(`ylen=${ylen}: max_abs_diff=${stats.maxAbsDiff} mean_abs_diff=${stats.meanAbsDiff}` +
      ` outside_mask=${stats.maxAbsDiffOutsideMask} webgpu_deterministic=${gpuDet}`);
    log(`  worst element (mel=${stats.at?.mel}, frame=${stats.at?.frame}): webgpu=${stats.at?.a} wasm=${stats.at?.b}`);
  }
  setResult({ ok: true, ...out });
}

main().catch((err) => {
  log(String(err?.stack ?? err));
  setResult({ ok: false, error: String(err?.stack ?? err) });
});
