/**
 * Offscreen document: the TTS engine. Loads LiteRT.js (wasm bundled with the
 * extension), fetches Matcha-TTS model files from Hugging Face (Cache API
 * after the first download), synthesizes queued texts chunk by chunk and
 * plays them gaplessly through an AudioContext.
 *
 * Pipeline per chunk (≤127 phonemes) — port of the matcha-tts demo:
 *   text → G2P (dict + DeepPhonemizer on WASM) → symbol ids
 *   → text encoder (WebGPU) → durations → length-regulate
 *   → flow-matching decoder ×4 Euler steps (WASM — GPU mis-fuses this graph)
 *   → HiFi-GAN vocoder (WebGPU) → 22.05 kHz waveform.
 *
 * Messages in  (target 'offscreen'): {type:'speak', text} | {type:'stop'} |
 *   {type:'status'} (sync response).
 * Messages out (target 'ui'): status broadcasts — background relays them to
 *   content scripts; the popup receives them directly.
 */
import { isWebGPUSupported, loadAndCompile, loadLiteRt } from '@litertjs/core';
import { G2P, phonemize } from './g2p.js';
import { Synthesizer, encodeWav } from './synth.js';

const HF = 'https://huggingface.co/litert-community/Matcha-TTS/resolve/main/';
const FILES = {
  textenc: 'matcha_textenc_fp16.tflite',
  decoder: 'matcha_decoder_fp16.tflite',
  vocoder: 'matcha_vocoder_fp16.tflite',
  g2p: 'dp_g2p_matcha_fp16.tflite',
  emb: 'emb.bin',
  dict: 'g2p_dict.txt.gz',
  config: 'config.json',
  g2pMeta: 'g2p_meta.json',
};
const CACHE_NAME = 'page-voice-models-v1';
// 4 Euler steps: ear-approved quality at ~1/3 the latency of the full 10
// (validated in the matcha-tts demo).
const STEPS = 4;
const SEED = 0;

let state = 'loading'; // loading → downloading → compiling → ready | error
let error = null;
let backends = null;
let wasmOpts = null; // which loadLiteRt attempt succeeded
let g2p = null;
let synth = null;
let cfg = null;
let symToId = null;
let audioCtx = null;
let playCursor = null;
let liveSources = [];
let queue = [];
let processing = false;
let generation = 0; // bumped by stop() to cancel in-flight synthesis
let lastStats = null;
let downloadedMB = 0;
let spokenCount = 0; // total texts accepted into the queue (smoke/debug)

// Register the listener before any async work so no early message is lost.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'speak') {
    enqueue(msg.text);
    sendResponse({ ok: true });
  } else if (msg.type === 'stop') {
    stopAll();
    sendResponse({ ok: true });
  } else if (msg.type === 'status') {
    sendResponse(statusPayload());
  }
  return false;
});

function speaking() {
  return processing || queue.length > 0 ||
    (playCursor !== null && audioCtx && playCursor > audioCtx.currentTime);
}

function statusPayload() {
  return {
    target: 'ui',
    type: 'status',
    state,
    speaking: speaking(),
    error,
    env: envLabel(),
    flags: {
      webgpu: backends ? backends.textenc === 'webgpu' : null,
      threads: wasmOpts?.threads ?? null,
      jspi: wasmOpts?.jspi ?? null,
      crossOriginIsolated: globalThis.crossOriginIsolated,
    },
    backends,
    stats: lastStats,
    queued: queue.length,
    downloadedMB,
    spoken: spokenCount,
  };
}

function envLabel() {
  if (!backends) return null;
  const gpu = backends.textenc === 'webgpu' || backends.vocoder === 'webgpu';
  return gpu ? 'webgpu+wasm' : wasmOpts?.threads ? 'wasm' : 'wasm·1-thread';
}

let lastBroadcast = 0;
function broadcast(force = false) {
  const now = performance.now();
  if (!force && now - lastBroadcast < 250) return;
  lastBroadcast = now;
  chrome.runtime.sendMessage(statusPayload()).catch(() => {});
}

// --- asset loading ---------------------------------------------------------

async function fetchCached(name, onProgress) {
  const url = HF + name;
  const cache = 'caches' in globalThis ? await caches.open(CACHE_NAME) : null;
  if (cache) {
    const hit = await cache.match(url);
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer());
      onProgress?.(bytes.length);
      return bytes;
    }
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (cache) await cache.put(url, new Response(bytes.slice().buffer));
  return bytes;
}

async function gunzip(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes; // already plain
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseDict(bytes) {
  const text = new TextDecoder().decode(bytes);
  const dict = new Map();
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    const tab = text.indexOf('\t', start);
    if (tab > start && tab < end) {
      dict.set(text.slice(start, tab), text.slice(tab + 1, end));
    }
    start = end + 1;
  }
  return dict;
}

// --- boot -------------------------------------------------------------------

async function boot() {
  try {
    // Threaded wasm needs cross-origin isolation (COEP/COOP set in the
    // manifest); single-thread makes the CPU decoder ~5-50x slower.
    const coi = globalThis.crossOriginIsolated;
    const attempts = [
      { threads: coi, jspi: true },
      { threads: coi, jspi: false },
      { threads: false, jspi: true },
      { threads: false, jspi: false },
    ];
    let loaded = false;
    let lastErr = null;
    for (const opts of attempts) {
      try {
        await loadLiteRt('litert-wasm/', opts);
        wasmOpts = opts;
        loaded = true;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!loaded) throw lastErr;

    const gpu = isWebGPUSupported() ? 'webgpu' : 'wasm';
    backends = { g2p: 'wasm', textenc: gpu, decoder: 'wasm', vocoder: gpu };
    state = 'downloading';
    broadcast(true);

    // ~92 MB total on first use; Cache API afterwards.
    const progress = {};
    const grab = (name) =>
      fetchCached(FILES[name], (received) => {
        progress[name] = received;
        let done = 0;
        for (const k in progress) done += progress[k];
        downloadedMB = Math.round(done / 1048576);
        broadcast();
      });
    const [teB, deB, voB, g2pB, embB, dictB, cfgB, metaB] = await Promise.all([
      grab('textenc'), grab('decoder'), grab('vocoder'), grab('g2p'),
      grab('emb'), grab('dict'), grab('config'), grab('g2pMeta'),
    ]);

    state = 'compiling';
    broadcast(true);
    cfg = JSON.parse(new TextDecoder().decode(cfgB));
    const meta = JSON.parse(new TextDecoder().decode(metaB));
    symToId = new Map();
    cfg.symbols.forEach((s, i) => {
      if (s.length === 1) symToId.set(s, i);
    });
    const dict = parseDict(await gunzip(dictB));
    const emb = new Float32Array(embB.buffer, embB.byteOffset, embB.byteLength / 4);

    const numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
    const wasmCompile = { accelerator: 'wasm', cpuOptions: { numThreads } };
    const models = {};
    for (const [key, bytes] of [['textenc', teB], ['decoder', deB], ['vocoder', voB], ['g2p', g2pB]]) {
      if (backends[key] === 'wasm') {
        models[key] = await loadAndCompile(bytes, wasmCompile);
        continue;
      }
      try {
        models[key] = await loadAndCompile(bytes, { accelerator: backends[key] });
      } catch {
        // WebGPU advertised but compile failed (e.g. no adapter in this
        // context) — fall back to wasm and record the downgrade.
        backends[key] = 'wasm';
        models[key] = await loadAndCompile(bytes, wasmCompile);
      }
    }

    g2p = new G2P(dict, meta, models.g2p);
    synth = new Synthesizer(models, emb, cfg);
    state = 'ready';
    broadcast(true);
    processQueue();
  } catch (err) {
    state = 'error';
    error = String(err instanceof Error ? err.message : err);
    broadcast(true);
  }
}

// --- speak queue + playback --------------------------------------------------

function enqueue(text) {
  text = (text ?? '').trim();
  if (!text) return;
  spokenCount++;
  queue.push(text);
  broadcast(true);
  processQueue();
}

function stopAll() {
  generation++;
  queue = [];
  for (const src of liveSources) {
    try { src.stop(); } catch { /* already ended */ }
  }
  liveSources = [];
  playCursor = null;
  broadcast(true);
}

async function processQueue() {
  if (processing || state !== 'ready') return;
  processing = true;
  try {
    audioCtx ??= new AudioContext({ sampleRate: cfg.sample_rate });
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
      if (audioCtx.state === 'suspended') {
        error = 'AudioContext suspended — autoplay blocked in offscreen document';
        broadcast(true);
      }
    }
    while (queue.length) {
      const gen = generation;
      const text = queue.shift();
      broadcast(true);
      await speakText(text, gen);
    }
  } finally {
    processing = false;
    broadcast(true);
  }
}

async function speakText(text, gen) {
  const t0 = performance.now();
  const chunks = await phonemize(g2p, symToId, text);
  const tG2p = performance.now() - t0;
  if (!chunks.length) return;
  const timings = { g2p: tG2p, textenc: 0, decoder: 0, vocoder: 0 };
  let audioSeconds = 0;
  for (const chunk of chunks) {
    if (gen !== generation) return; // stopped
    const r = await synth.run(chunk.ids, { steps: STEPS, seed: SEED });
    if (gen !== generation) return;
    for (const k of ['textenc', 'decoder', 'vocoder']) timings[k] += r.timings[k];
    audioSeconds += r.wav.length / cfg.sample_rate;
    playWav(r.wav);
    const totalMs = timings.g2p + timings.textenc + timings.decoder + timings.vocoder;
    lastStats = {
      totalMs: +totalMs.toFixed(0),
      audioSeconds: +audioSeconds.toFixed(1),
      rtf: +(totalMs / 1000 / audioSeconds).toFixed(2),
      steps: STEPS,
    };
    broadcast(true);
  }
}

// Dev demo hook: mirror every scheduled utterance to a local audio sink
// (tools/audio-sink.mjs) with its wall-clock schedule time, so clean audio
// can be muxed into screen recordings (this machine has no loopback/mic).
// Silently no-ops when the sink isn't running.
const AUDIO_SINK = 'http://127.0.0.1:8908/wav';
function mirrorToSink(wav, at) {
  const wallMs = Date.now() + (at - audioCtx.currentTime) * 1000;
  fetch(AUDIO_SINK, {
    method: 'POST',
    headers: { 'content-type': 'audio/wav', 'x-wall-ms': String(Math.round(wallMs)) },
    body: encodeWav(wav, cfg.sample_rate),
  }).catch(() => {});
}

function playWav(wav) {
  const buf = audioCtx.createBuffer(1, wav.length, cfg.sample_rate);
  buf.copyToChannel(wav, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  const at = Math.max(playCursor ?? 0, audioCtx.currentTime + 0.05);
  src.start(at);
  mirrorToSink(wav, at);
  playCursor = at + buf.duration;
  liveSources.push(src);
  src.onended = () => {
    liveSources = liveSources.filter((s) => s !== src);
    broadcast(); // lets the HUD drop out of "speaking" when playback drains
  };
}

// debug/smoke hook: lets CDP automation poll engine state and speak
globalThis.__pv = {
  get status() { return statusPayload(); },
  speak: (text) => enqueue(text),
  stop: stopAll,
};

boot();
