/**
 * On the WASM (XNNPACK) backend the fp16 PP-OCRv5 recognizer runs ~20x
 * slower than the fp32 one — same graph, only the weight precision differs.
 * Times both models on identical input; WebGPU timings included to show the
 * gap is specific to the CPU path.
 */
import { Tensor, isWebGPUSupported, loadAndCompile, loadLiteRt } from '@litertjs/core';
import { captureConsole, fetchCached, log, median, mulberry32, setResult, status } from '../shared.js';

const HF = 'https://huggingface.co/litert-community/PP-OCRv5-LiteRT/resolve/main';
const SHAPE = [1, 3, 48, 320];
const WARMUP = 3;
const RUNS = 10;

async function timeModel(model, nchw) {
  const times = [];
  for (let i = 0; i < WARMUP + RUNS; i++) {
    const input = Tensor.fromTypedArray(nchw, SHAPE);
    const t0 = performance.now();
    const outputs = await model.run([input]);
    await outputs[0].data(); // include readback, like an app would
    const ms = performance.now() - t0;
    for (const o of outputs) o.delete();
    input.delete();
    if (i >= WARMUP) times.push(ms);
  }
  return { p50: +median(times).toFixed(1), all: times.map((t) => +t.toFixed(1)) };
}

async function main() {
  const consoleLines = [];
  captureConsole(consoleLines);
  status.state = 'loading';
  await loadLiteRt('/litert-wasm/', { threads: globalThis.crossOriginIsolated, jspi: false });

  const [fp16, fp32] = await Promise.all([
    fetchCached(`${HF}/ppocr_rec_fp16.tflite`),
    fetchCached(`${HF}/ppocr_rec_fp32.tflite`),
  ]);

  // deterministic input; timing is content-independent for this graph
  const rand = mulberry32(42);
  const nchw = new Float32Array(SHAPE.reduce((a, b) => a * b, 1));
  for (let i = 0; i < nchw.length; i++) nchw[i] = Math.fround(rand() * 2 - 1);

  status.state = 'compiling';
  const numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
  const results = { env: { threads: globalThis.crossOriginIsolated, numThreads } };
  const cases = [
    ['fp16-wasm', fp16, { accelerator: 'wasm', cpuOptions: { numThreads } }],
    ['fp32-wasm', fp32, { accelerator: 'wasm', cpuOptions: { numThreads } }],
  ];
  if (isWebGPUSupported()) {
    cases.push(['fp16-webgpu', fp16, { accelerator: 'webgpu' }]);
    cases.push(['fp32-webgpu', fp32, { accelerator: 'webgpu' }]);
  }
  for (const [name, bytes, opts] of cases) {
    const model = await loadAndCompile(bytes, opts);
    status.state = `timing ${name}`;
    results[name] = await timeModel(model, nchw);
    log(`${name.padEnd(12)} p50 ${String(results[name].p50).padStart(7)} ms   [${results[name].all.join(', ')}]`);
  }
  results.consoleLines = consoleLines;
  log('\nSUMMARY ' + JSON.stringify({
    'fp16-wasm p50 ms': results['fp16-wasm'].p50,
    'fp32-wasm p50 ms': results['fp32-wasm'].p50,
    slowdown: +(results['fp16-wasm'].p50 / results['fp32-wasm'].p50).toFixed(1),
  }));
  setResult({ ok: true, ...results });
}

main().catch((err) => {
  log(String(err?.stack ?? err));
  setResult({ ok: false, error: String(err?.stack ?? err) });
});
