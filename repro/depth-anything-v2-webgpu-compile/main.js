/**
 * Local reproduction of google-ai-edge/LiteRT#9481: depth_anything_v2_small
 * (w-int8/a-fp32) fails in loadAndCompile on WebGPU with an ml_drift
 * INVALID_ARGUMENT ("Unable to parse bc coord for BATCH axis"). The same
 * model compiles on the WASM backend.
 */
import { isWebGPUSupported, loadAndCompile, loadLiteRt } from '@litertjs/core';
import { captureConsole, fetchCached, log, setResult, status } from '../shared.js';

const MODEL = 'https://huggingface.co/webnn/depth-anything-v2-small/resolve/main/tflite/depth_anything_v2_small_wi8_afp32.tflite';

async function main() {
  const consoleLines = [];
  captureConsole(consoleLines);
  status.state = 'loading';
  await loadLiteRt('/litert-wasm/', { threads: globalThis.crossOriginIsolated, jspi: false });
  if (!isWebGPUSupported()) throw new Error('WebGPU unavailable');
  const bytes = await fetchCached(MODEL);

  status.state = 'compiling-wasm';
  let wasmOk = false;
  let wasmError = null;
  try {
    await loadAndCompile(bytes, { accelerator: 'wasm' });
    wasmOk = true;
    log('wasm: loadAndCompile OK');
  } catch (err) {
    wasmError = String(err?.stack ?? err);
    log('wasm: loadAndCompile FAILED\n' + wasmError);
  }

  status.state = 'compiling-webgpu';
  let webgpuOk = false;
  let webgpuError = null;
  try {
    await loadAndCompile(bytes, { accelerator: 'webgpu' });
    webgpuOk = true;
    log('webgpu: loadAndCompile OK');
  } catch (err) {
    webgpuError = String(err?.stack ?? err);
    log('webgpu: loadAndCompile FAILED\n' + webgpuError);
  }

  setResult({ ok: true, wasmOk, wasmError, webgpuOk, webgpuError, consoleLines });
}

main().catch((err) => {
  log(String(err?.stack ?? err));
  setResult({ ok: false, error: String(err?.stack ?? err) });
});
