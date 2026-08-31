/**
 * Shared plumbing for the minimal repro pages. Each page exposes
 * globalThis.__repro = {status, result} for automation and renders a human
 * readable log into the document.
 */

export const status = { state: 'boot', progress: '' };
let result = null;
globalThis.__repro = {
  get status() { return { ...status }; },
  get result() { return result; },
};
export function setResult(r) { result = r; status.state = r?.ok ? 'done' : 'error'; }

const pre = document.createElement('pre');
pre.style.cssText = 'font: 12px/1.5 monospace; white-space: pre-wrap;';
export function log(line) {
  // The script tag runs before <body> exists — attach on first use.
  if (!pre.isConnected) (document.body ?? document.documentElement).append(pre);
  pre.textContent += line + '\n';
  console.log(line);
}

/** Fetch a URL as bytes through the Cache API (models are fetched once). */
export async function fetchCached(url) {
  const cache = await caches.open('repro-models-v1');
  let res = await cache.match(url);
  if (!res) {
    log(`fetching ${url} ...`);
    res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    await cache.put(url, res.clone());
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Deterministic uniform [0,1) PRNG (mulberry32). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic standard-normal source (mulberry32 + Box-Muller). */
export function makeRandn(seed) {
  const uniform = mulberry32(seed);
  let spare = null;
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let a = 0;
    while (a === 0) a = uniform();
    const r = Math.sqrt(-2 * Math.log(a));
    const th = 2 * Math.PI * uniform();
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** Capture console output (the wasm runtime logs delegate errors there). */
export function captureConsole(into) {
  for (const level of ['log', 'info', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      into.push(`${level}: ${args.map(String).join(' ')}`);
      orig(...args);
    };
  }
}
