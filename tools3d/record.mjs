/**
 * Records the Page 3D demo video: launches Chrome for Testing with dist3d/,
 * drives a scripted tour (Wikipedia → Pexels) with a synthetic cursor drawn
 * in-page, records the window region with `screencapture -v`, and encodes
 * out3d/page3d-demo.mp4 with ffmpeg.
 *
 *   node tools3d/record.mjs <chrome-binary> [--profile=<dir>] [--dry]
 *
 * --dry runs the full tour with logging but no recording/encode — ALWAYS
 * preflight with it before a recorded take (every beat must log
 * "overlay: active" before the camera rolls).
 * Needs Screen Recording permission for the terminal. Keep the desktop
 * hands-off during the take — the recorded window must stay unoccluded.
 * Timeline anchoring: recording start = stopWall − ffprobe duration (the
 * capture can start seconds late), scene markers are wall-clock.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Cdp, attachTo, evalIn, findTarget, launchChrome, sleep, waitForEndpoint, waitForEngine,
} from '../tools/cdp.mjs';

const chromeBin = process.argv[2];
const profile = process.argv.find((a) => a.startsWith('--profile='))?.slice(10);
const dry = process.argv.includes('--dry');
if (!chromeBin) {
  console.error('usage: node tools3d/record.mjs <chrome-binary> [--profile=<dir>]');
  process.exit(2);
}

const outDir = resolve(import.meta.dirname, '..', 'out3d');
mkdirSync(outDir, { recursive: true });
const rawMov = resolve(outDir, 'page3d-raw.mov');
const outMp4 = resolve(outDir, 'page3d-demo.mp4');

// Window rect (screen points). Below the menu bar; 16:10-ish inner page.
const WIN = { left: 80, top: 60, width: 1280, height: 840 };

const CURSOR_JS = `
(() => {
  if (window.__demoCursor) return;
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;left:0;top:0;width:20px;height:20px;' +
    'border-radius:50%;background:rgba(255,255,255,.92);border:2.5px solid rgba(0,0,0,.78);' +
    'box-shadow:0 1px 6px rgba(0,0,0,.4);z-index:2147483647;pointer-events:none;' +
    'transform:translate(-50%,-50%);transition:width .12s,height .12s;display:none;';
  const attach = () => document.documentElement.appendChild(dot);
  document.documentElement ? attach() : addEventListener('DOMContentLoaded', attach);
  addEventListener('pointermove', (e) => {
    dot.style.display = 'block';
    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
  }, true);
  window.__demoCursor = dot;
})();
`;

const cursor = { x: 640, y: 400 };
let pageSession = null;
let cdp = null;

const ease = (t) => 1 - (1 - t) ** 3;

async function move(x, y) {
  cursor.x = x;
  cursor.y = y;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, pageSession);
}

/** Smooth eased cursor glide, ~60 events/s. */
async function glide(x, y, ms) {
  step(`glide → ${Math.round(x)},${Math.round(y)}`);
  const from = { ...cursor };
  const steps = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    await move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await sleep(16);
  }
}

/** Lazy figure-8 sweep inside the hovered image — drives the parallax. */
async function sweep(cx, cy, rx, ry, ms) {
  step(`sweep @ ${Math.round(cx)},${Math.round(cy)} for ${ms}ms`);
  const t0 = performance.now();
  for (;;) {
    const el = performance.now() - t0;
    if (el >= ms) break;
    const t = (el / ms) * Math.PI * 2;
    await move(cx + Math.sin(t) * rx, cy + Math.sin(t * 2) * ry * 0.6);
    await sleep(16);
  }
  await glide(cx, cy, 250);
}

async function nav(url, settleMs = 2500) {
  step(`nav ${url}`);
  await cdp.send('Page.navigate', { url }, pageSession);
  await sleep(settleMs);
  step('nav settled, clearing focus');
  // Ensure the page (not the omnibox) has focus and no dropdown/bubble is
  // open — stray keystrokes land in the address bar otherwise.
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent',
      { type, key: 'Escape', windowsVirtualKeyCode: 27 }, pageSession);
  }
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent',
      { type, x: 8, y: 300, button: 'left', clickCount: 1 }, pageSession);
  }
}

async function rectOf(expr) {
  step('rectOf');
  const raw = await evalIn(cdp, pageSession, `(() => {
    const img = ${expr};
    if (!img || !img.complete || !img.naturalWidth) return null;
    const r = img.getBoundingClientRect();
    return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height });
  })()`);
  return raw ? JSON.parse(raw) : null;
}

/** Hover the image at rect: glide in, wait for the overlay to pop (cold CDN
 * fetches can take >1 s), give the extrude a beat, then sweep. focusV places
 * the sweep center vertically — for photos of people the tile's geometric
 * center is the torso, so aim the upper third (the face) instead. */
async function feature(rect, holdMs, focusV = 0.5) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h * focusV;
  await glide(cx, cy, 550);
  let state = 'none';
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    state = await evalIn(cdp, pageSession,
      `document.querySelector('[data-page3d]')?.dataset.page3d ?? 'none'`).catch(() => '?');
    if (state === 'active') break;
    await sleep(150);
    // keep the dwell alive: a tiny wiggle re-probes without leaving the image
    await move(cx + (Math.random() - 0.5) * 2, cy);
  }
  step(`overlay: ${state}`);
  await sleep(700); // extrude-in settles
  await sweep(cx, cy, rect.w * 0.34, rect.h * 0.26, holdMs);
}

const markers = {};
const mark = (name) => { markers[name] = Date.now(); step(`mark ${name}`); };
const step = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

// --- main -------------------------------------------------------------------

const port = 9226;
launchChrome(chromeBin, {
  dist: resolve(import.meta.dirname, '..', 'dist3d'),
  port,
  profile,
});

let rec = null;
try {
  // Watchdog: whatever wedges, finalize the recorder and fail loudly instead
  // of recording the desktop for ten minutes.
  const watchdog = setTimeout(() => {
    console.error('WATCHDOG: tour wedged, aborting');
    try { rec?.kill('SIGINT'); } catch { /* not running */ }
    setTimeout(() => process.exit(3), 1500);
  }, 300 * 1000);

  cdp = await Cdp.connect(await waitForEndpoint(port));
  const { status, session: engineSession } = await waitForEngine(cdp, { hook: '__p3' });
  if (status?.state !== 'ready') throw new Error(`engine not ready: ${JSON.stringify(status)}`);
  const engineRuns = async () =>
    JSON.parse(await evalIn(cdp, engineSession, 'JSON.stringify(__p3.status)')).runs;

  const page = await findTarget(cdp, (t) => t.type === 'page');
  // Reused profiles accumulate restored tabs from prior runs — close all
  // pages except ours so the tab strip is clean on camera.
  const { targetInfos } = await cdp.send('Target.getTargets');
  for (const t of targetInfos) {
    if (t.type === 'page' && t.targetId !== page.targetId) {
      await cdp.send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
    }
  }
  pageSession = await attachTo(cdp, page);
  await cdp.send('Page.enable', {}, pageSession);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: CURSOR_JS }, pageSession);
  const { windowId } = await cdp.send('Browser.getWindowForTarget', { targetId: page.targetId });
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', ...WIN } });

  // The window MUST be frontmost: an occluded/unfocused renderer is treated
  // as hidden and each synthetic input event waits out a ~5 s ack timeout
  // (observed: 550 ms glides taking 3 minutes).
  const raise = async () => {
    await cdp.send('Target.activateTarget', { targetId: page.targetId });
    await cdp.send('Page.bringToFront', {}, pageSession).catch(() => {});
  };
  await raise();

  // Pre-pass (not recorded): accept the Pexels cookie banner once, warm both
  // pages' CDN caches, and warm the depth engine + shader.
  await nav('https://www.pexels.com/search/landscape/', 4000);
  await evalIn(cdp, pageSession,
    `[...document.querySelectorAll('button')]
       .find((b) => /accept all/i.test(b.textContent))?.click(), null`);
  await sleep(800);
  await nav('https://en.wikipedia.org/wiki/Albert_Einstein', 3500);
  // The warm hover is what absorbs the first-run GPU warm-up (~5 s) and
  // caches the depth result — wait for the image, don't skip.
  let warm = null;
  for (let i = 0; i < 15 && !warm; i++) {
    warm = await rectOf(`document.querySelector('.infobox-image img')`);
    if (!warm) await sleep(700);
  }
  if (!warm) throw new Error('lead image never loaded for warm-up');
  await feature(warm, 1200);
  await glide(640, 40, 300); // park the cursor off-content

  // --- recording starts ---
  if (!dry) {
    // screencapture refuses to overwrite ("Failed to save to final
    // location") and we'd silently encode the previous take's raw file.
    rmSync(rawMov, { force: true });
    await raise();
    rec = spawn('screencapture', [
      '-v', '-x', `-R${WIN.left},${WIN.top},${WIN.width},${WIN.height}`, rawMov,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    await sleep(4000); // capture can start late; markers anchor the trim
  }

  // Scene 1 — Wikipedia article, lead image (Albert Einstein: the 1947
  // Orren Jack Turner portrait, public domain — copyright not renewed, per
  // its Commons file page — so no ShareAlike entanglement in the video).
  await nav('https://en.wikipedia.org/wiki/Albert_Einstein', 2500);
  await move(640, 40);
  mark('scene1');
  await evalIn(cdp, pageSession, `scrollTo({ top: 120, behavior: 'smooth' }), null`);
  await sleep(1200);
  const lead = await rectOf(`document.querySelector('.infobox-image img')`);
  if (!lead) throw new Error('no lead image');
  await feature(lead, 4200);
  step(`engine runs after scene1: ${await engineRuns()}`);
  mark('scene1end');

  // Scene 3 — Pexels masonry grid (Pexels License, no attribution required).
  // Landscape only: portrait-category tiles grow a Canva "Add Text" control
  // on hover that shows on camera. Scroll past the header (and the sponsor
  // tile that sits in the first rows), let the lazy-loaded images land, then
  // feature the `count` biggest fully-visible photos.
  const pexelsScene = async (term, count, markName, focusV) => {
    await nav(`https://www.pexels.com/search/${term}/`, 3000);
    await evalIn(cdp, pageSession, `scrollTo({ top: 900, behavior: 'smooth' }), null`);
    await sleep(2500);
    await move(640, 20);
    mark(markName);
    const grids = JSON.parse(await evalIn(cdp, pageSession, `(() => {
      const rs = [...document.images]
        .filter((i) => i.complete && i.naturalWidth > 100)
        .map((i) => i.getBoundingClientRect())
        .filter((r) => r.top > 20 && r.bottom < innerHeight && r.width >= 200 && r.height >= 160)
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, ${count})
        .sort((a, b) => a.left - b.left)
        .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
      return JSON.stringify(rs);
    })()`));
    step(`pexels ${term} picks: ${grids.length}`);
    for (const g of grids) await feature(g, 3400, focusV);
  };
  await pexelsScene('landscape', 3, 'scene3');
  mark('end');

  if (dry) {
    console.log('DRY_RESULT tour complete — check every beat logged "overlay: active"');
    clearTimeout(watchdog);
    await cdp.send('Browser.close').catch(() => {});
    process.exit(0);
  }
  await sleep(1200);
  rec.kill('SIGINT');
  await new Promise((r) => rec.on('exit', r));
  const stopWall = Date.now();

  // Anchor: recording start = stop − duration; cut scene1 − 1 s → end + 1 s.
  const dur = parseFloat(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rawMov,
  ]).toString());
  const recStart = stopWall - dur * 1000;
  const cutIn = Math.max(0, (markers.scene1 - recStart) / 1000 - 1.0);
  const cutOut = (markers.end - recStart) / 1000 + 1.0;
  console.log(`raw ${dur.toFixed(1)}s, cut ${cutIn.toFixed(1)} → ${cutOut.toFixed(1)}`);

  execFileSync('ffmpeg', [
    '-y', '-i', rawMov, '-ss', String(cutIn), '-to', String(cutOut),
    '-vf', 'scale=1280:-2:flags=lanczos,fps=60',
    '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', outMp4,
  ], { stdio: 'inherit' });
  console.log(`RECORD_RESULT ${outMp4} (${(cutOut - cutIn).toFixed(1)}s)`);
  clearTimeout(watchdog);
  await cdp.send('Browser.close').catch(() => {});
  process.exit(0);
} catch (err) {
  console.error('record failed:', err.message);
  try { rec?.kill('SIGINT'); } catch { /* not running */ }
  process.exit(1);
}
