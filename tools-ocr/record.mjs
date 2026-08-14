/**
 * Records the Page Text demo video: launches Chrome for Testing with
 * dist-ocr/, serves the demo feed (tools-ocr/demo.html + out-ocr fixtures)
 * on localhost, drives the tour, records the window region with
 * `screencapture -v`, and encodes out-ocr/pagetext-demo.mp4 with the same
 * punch-in + tempo grammar as the Page 3D takes (wide segments 3×, beats 1×,
 * hard cuts to a crop around the image).
 *
 *   node tools-ocr/record.mjs <chrome-binary> [--profile=<dir>] [--dry]
 *                             [--menu-test] | --encode-only
 *
 * --dry: full tour, CDP input only — activation goes through the service
 *   worker (the real content-script path, minus the native menu), nothing
 *   touches the real mouse/keyboard. Safe to run any time; every beat must
 *   log "overlay: N spans" before a recorded take.
 * --menu-test: ~8 s hands-off check of ONLY the native-menu interaction
 *   (real right-click via cliclick, Up ×2 + Return — on an image menu the
 *   extension item sits directly above "Inspect"). Verifies Accessibility
 *   permissions and the item position without a full take.
 * (recorded take): needs the desktop hands-off — real right-clicks via
 *   cliclick drive the actual context menu on camera.
 *
 * Timeline anchoring, take JSON, --encode-only re-edit: same contract as
 * tools3d/record.mjs.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import {
  Cdp, attachTo, evalIn, findTarget, launchChrome, sleep, waitForEndpoint, waitForEngine,
} from '../tools/cdp.mjs';

const chromeBin = process.argv[2];
const profile = process.argv.find((a) => a.startsWith('--profile='))?.slice(10);
const dry = process.argv.includes('--dry');
const menuTest = process.argv.includes('--menu-test');
const encodeOnly = process.argv.includes('--encode-only');
if (!chromeBin && !encodeOnly) {
  console.error('usage: node tools-ocr/record.mjs <chrome-binary> [--profile=<dir>] ' +
    '[--dry] [--menu-test] | --encode-only');
  process.exit(2);
}

const outDir = resolve(import.meta.dirname, '..', 'out-ocr');
mkdirSync(outDir, { recursive: true });
const rawMov = resolve(outDir, 'pagetext-raw.mov');
const outMp4 = resolve(outDir, 'pagetext-demo.mp4');
const takeJson = resolve(outDir, 'pagetext-take.json');

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
let chromeH = 0; // window height − viewport height, for screen-coord mapping

const ease = (t) => 1 - (1 - t) ** 3;
const step = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

async function move(x, y, dragging = false) {
  cursor.x = x;
  cursor.y = y;
  // A drag only extends a text selection if the moves carry the pressed
  // button — without buttons:1 Chrome treats them as hover and nothing
  // highlights on camera.
  await cdp.send('Input.dispatchMouseEvent', dragging
    ? { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }
    : { type: 'mouseMoved', x, y }, pageSession);
}

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

/** Real OS-level right-click + menu selection. On a plain image the
 * Chromium context menu ends [..., Copy image address, <extension items>,
 * Inspect] — Up ×2 from the bottom lands on our item. cliclick moves the
 * REAL cursor; the in-page dot follows via pointermove. */
function menuPick(pageX, pageY) {
  const sx = Math.round(WIN.left + pageX);
  const sy = Math.round(WIN.top + chromeH + pageY);
  step(`right-click @ screen ${sx},${sy}`);
  execFileSync('cliclick', ['-w', '160', `m:${sx},${sy}`, `rc:${sx},${sy}`]);
  execFileSync('cliclick', ['-w', '260', 'kp:arrow-up', 'kp:arrow-up', 'kp:return']);
}

/** --dry activation: same content-script path, minus the native menu.
 * The MV3 service worker stops when idle and restarts as a NEW target —
 * re-find and re-attach every time instead of holding a session. */
async function simActivate(base, src) {
  const sw = await findTarget(cdp, (t) =>
    t.type === 'service_worker' && t.url.startsWith('chrome-extension://'));
  const swSession = await attachTo(cdp, sw);
  // tab.url is empty in tabs.query here (fresh --load-extension profiles
  // don't expose it without the "tabs" permission) — broadcast instead;
  // only the demo tab's content script will find a matching <img>.
  const res = await evalIn(cdp, swSession, `
    chrome.tabs.query({}).then(async (tabs) => {
      let sent = 0;
      for (const tab of tabs) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'activate-ocr', srcUrl: ${JSON.stringify(src)} }).then(() => sent++, () => {});
      }
      return 'sent=' + sent + '/' + tabs.length;
    })`, true);
  step(`simActivate: ${res}`);
}

async function overlayInfo() {
  const raw = await evalIn(cdp, pageSession, `(() => {
    const host = document.querySelector('[data-pagetext]');
    if (!host) return null;
    const spans = [...host.querySelectorAll('span')].filter((s) => s.textContent);
    return JSON.stringify({
      spans: spans.length,
      rects: spans.map((s) => {
        const r = s.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, t: s.textContent };
      }),
      copyBtn: (() => {
        const b = [...host.querySelectorAll('button')].find((x) => /copy|copied/i.test(x.textContent));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })(),
    });
  })()`);
  return raw ? JSON.parse(raw) : null;
}

/** Drag-select from the span containing `fromText` to the one containing
 * `toText` — real selection over the transparent text layer. */
async function dragSelect(fromText, toText) {
  const info = await overlayInfo();
  if (!info) return;
  const a = info.rects.find((r) => r.t.includes(fromText)) ?? info.rects[2] ?? info.rects[0];
  const b = [...info.rects].reverse().find((r) => r.t.includes(toText))
    ?? info.rects[info.rects.length - 1];
  step(`drag-select "${a.t.slice(0, 10)}…" → "…${b.t.slice(-10)}"`);
  const x0 = a.x + 2;
  const y0 = a.y + a.h / 2;
  const x1 = b.x + b.w - 2;
  const y1 = b.y + b.h / 2;
  await glide(x0, y0, 350);
  await cdp.send('Input.dispatchMouseEvent',
    { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 }, pageSession);
  const steps = 22;
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    await move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, true);
    await sleep(28);
  }
  await cdp.send('Input.dispatchMouseEvent',
    { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 }, pageSession);
  // Preflight signal: the selection must be non-empty AND live entirely
  // inside the overlay. Both endpoints landing in the page instead means
  // the span geometry is wrong (that is how the detached-measure bug
  // showed up: spans ran ~50,000 px wide and the drag ended off-screen).
  const sel = await evalIn(cdp, pageSession, `(() => {
    const s = getSelection();
    const host = document.querySelector('[data-pagetext]');
    const inHost = (n) => Boolean(host && n
      && host.contains(n.nodeType === 3 ? n.parentElement : n));
    return JSON.stringify({
      len: s.toString().length,
      head: s.toString().slice(0, 22).replace(/\\s+/g, ' '),
      contained: inHost(s.anchorNode) && inHost(s.focusNode),
    });
  })()`);
  const { len, head, contained } = JSON.parse(sel);
  step(`selected ${len} chars${contained ? '' : ' OUTSIDE OVERLAY'}: "${head}…"`);
}

async function clickAt(x, y) {
  await glide(x, y, 300);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent',
      { type, x, y, button: 'left', clickCount: 1 }, pageSession);
  }
}

const beats = [];
const markers = {};
const mark = (name) => { markers[name] = Date.now(); step(`mark ${name}`); };

/** One demo beat: cursor to the image, real right-click → menu pick (or sim
 * activation in --dry), overlay pops + boxes flash, drag-select, Copy all. */
async function featureShot(imgSel, base, selFrom, selTo) {
  const rect = JSON.parse(await evalIn(cdp, pageSession, `(() => {
    const img = document.querySelector(${JSON.stringify(imgSel)});
    const r = img.getBoundingClientRect();
    return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height,
      src: img.currentSrc });
  })()`));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h * 0.42;
  await glide(cx, cy, 550);
  await sleep(250);
  const beat = { in: Date.now(), rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } };

  if (dry) {
    await simActivate(base, rect.src);
  } else {
    menuPick(cx, cy);
  }
  let info = null;
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    info = await overlayInfo();
    if (info) break;
    await sleep(200);
  }
  step(`overlay: ${info ? `${info.spans} spans` : 'NONE'}`);
  if (!info) { beats.push(beat); return; }
  await sleep(1400); // boxes flash, then fade — let it read
  await dragSelect(selFrom, selTo);
  await sleep(700); // selection highlight holds
  if (info.copyBtn) {
    if (dry) {
      const pre = await evalIn(cdp, pageSession, `(() => {
        const el = document.elementFromPoint(${info.copyBtn.x}, ${info.copyBtn.y});
        const host = document.querySelector('[data-pagetext]');
        return JSON.stringify({
          hit: el ? el.tagName + '.' + (el.className || '') + ':' + (el.textContent || '').slice(0, 12) : null,
          inHost: host && el ? host.contains(el) : null,
          hostThere: Boolean(host),
        });
      })()`);
      step(`pre-click @${Math.round(info.copyBtn.x)},${Math.round(info.copyBtn.y)}: ${pre}`);
    }
    await clickAt(info.copyBtn.x, info.copyBtn.y);
    await sleep(400);
    // The label is on camera — a failed clipboard write would read
    // "Copy failed" in the take, so check it during --dry too.
    // Match the copied state too: the label becomes "Copied ✓", which does
    // NOT contain the substring "copy".
    const label = await evalIn(cdp, pageSession, `(() => {
      const host = document.querySelector('[data-pagetext]');
      if (!host) return 'overlay gone';
      const b = [...host.querySelectorAll('button')].find((x) => /copy|copied/i.test(x.textContent));
      return b ? b.textContent : 'button gone';
    })()`);
    step(`copy button: "${label}"`);
    await sleep(700); // "Copied ✓" holds on screen
  }
  beat.out = Date.now();
  beats.push(beat);
  // teardown via Escape so the next beat starts clean
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent',
      { type, key: 'Escape', windowsVirtualKeyCode: 27 }, pageSession);
  }
  await sleep(300);
}

// --- punch-in encode (same contract as tools3d) --------------------------------

const WIDE_SPEED = 3;

function ffprobeRaw() {
  const j = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-show_entries', 'format=duration',
    '-of', 'json', rawMov,
  ]).toString());
  return { w: j.streams[0].width, h: j.streams[0].height, dur: parseFloat(j.format.duration) };
}

function encode({ WIN: win, inner, markers: marks, beats: takeBeats, stopWall }) {
  const raw = ffprobeRaw();
  const recStart = stopWall - raw.dur * 1000;
  const A = Math.max(0, (marks.scene1 - recStart) / 1000 - 0.8);
  const B = Math.min(raw.dur, (marks.end - recStart) / 1000 + 1.0);
  const sc = raw.w / win.width;
  const cH = win.height - inner.h;
  const OUT_W = 1280;
  const OUT_H = 840;
  const even = (n) => 2 * Math.round(n / 2);

  const segs = [];
  let t = A;
  for (const b of takeBeats) {
    if (!b.out) continue;
    const bi = Math.max(A, Math.min(B, (b.in - recStart) / 1000));
    const bo = Math.max(A, Math.min(B, (b.out - recStart) / 1000));
    if (bo - bi < 0.5) continue;
    if (bi - t > 0.05) segs.push({ start: t, end: bi });
    segs.push({ start: bi, end: bo, rect: b.rect });
    t = bo;
  }
  if (B - t > 0.05) segs.push({ start: t, end: B });

  const chains = segs.map((s, i) => {
    let chain = `[i${i}]trim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},` +
      (s.rect ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${WIDE_SPEED}`);
    if (s.rect) {
      const r = s.rect;
      let ch = r.h * 1.18 * sc;
      let cw = ch * (OUT_W / OUT_H);
      if (cw < r.w * 1.08 * sc) {
        cw = r.w * 1.08 * sc;
        ch = cw * (OUT_H / OUT_W);
      }
      const fit = Math.min(1, raw.w / cw, raw.h / ch);
      cw *= fit;
      ch *= fit;
      const cx = Math.max(0, Math.min(raw.w - cw, (r.x + r.w / 2) * sc - cw / 2));
      const cy = Math.max(0, Math.min(raw.h - ch, (cH + r.y + r.h / 2) * sc - ch / 2));
      chain += `,crop=${even(cw)}:${even(ch)}:${even(cx)}:${even(cy)}`;
    }
    chain += `,scale=${OUT_W}:${OUT_H}:flags=lanczos[s${i}]`;
    return chain;
  });
  const graph =
    `[0:v]split=${segs.length}${segs.map((_, i) => `[i${i}]`).join('')};` +
    chains.join(';') + ';' +
    segs.map((_, i) => `[s${i}]`).join('') +
    `concat=n=${segs.length}:v=1:a=0,fps=60[v]`;

  console.log(`raw ${raw.dur.toFixed(1)}s, cut ${A.toFixed(1)} → ${B.toFixed(1)}, ` +
    `${segs.length} segments (${segs.filter((s) => s.rect).length} punch-ins)`);
  execFileSync('ffmpeg', [
    '-y', '-i', rawMov, '-filter_complex', graph, '-map', '[v]',
    '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', outMp4,
  ], { stdio: 'inherit' });
  const outDur = segs.reduce(
    (sum, s) => sum + (s.end - s.start) / (s.rect ? 1 : WIDE_SPEED), 0);
  console.log(`RECORD_RESULT ${outMp4} (${outDur.toFixed(1)}s)`);
}

if (encodeOnly) {
  if (!existsSync(takeJson)) {
    console.error(`no take file: ${takeJson} — record a take first`);
    process.exit(2);
  }
  encode(JSON.parse(readFileSync(takeJson, 'utf8')));
  process.exit(0);
}

// --- serve the demo feed --------------------------------------------------------

const MIME = { '.html': 'text/html', '.png': 'image/png' };
for (const f of ['fixture-ja-dark.png', 'fixture-en-light.png']) {
  if (!existsSync(resolve(outDir, f))) {
    console.error(`missing ${f} — run tools-ocr/make-fixtures.mjs first`);
    process.exit(2);
  }
}
const server = createServer((req, res) => {
  try {
    const path = req.url === '/' ? resolve(import.meta.dirname, 'demo.html')
      : resolve(outDir, decodeURIComponent(req.url.slice(1)));
    const body = readFileSync(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'text/html' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- main ------------------------------------------------------------------------

const port = 9236;
// Pass --profile: a freshly installed extension in a throwaway profile
// re-downloads the models AND its service worker can't reach the content
// script yet (tabs.sendMessage → "receiving end does not exist", tab.url
// hidden), so context-menu activation silently does nothing.
launchChrome(chromeBin, { dist: resolve(import.meta.dirname, '..', 'dist-ocr'), port, profile });

let rec = null;
try {
  const watchdog = setTimeout(() => {
    console.error('WATCHDOG: tour wedged, aborting');
    try { rec?.kill('SIGINT'); } catch { /* not running */ }
    setTimeout(() => process.exit(3), 1500);
  }, 300 * 1000);

  cdp = await Cdp.connect(await waitForEndpoint(port));
  const { status, session: engineSession } = await waitForEngine(cdp, { hook: '__pt' });
  if (status?.state !== 'ready') throw new Error(`engine not ready: ${JSON.stringify(status)}`);

  const page = await findTarget(cdp, (t) => t.type === 'page');
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
  const raise = async () => {
    await cdp.send('Target.activateTarget', { targetId: page.targetId });
    await cdp.send('Page.bringToFront', {}, pageSession).catch(() => {});
  };
  await raise();

  await cdp.send('Page.navigate', { url: `${base}/` }, pageSession);
  await sleep(1800);
  chromeH = WIN.height - JSON.parse(await evalIn(cdp, pageSession,
    'JSON.stringify({ h: innerHeight })')).h;
  step(`chromeH = ${chromeH}`);

  if (menuTest) {
    // Single hands-off native-menu check on the JA shot, ~8 s.
    await evalIn(cdp, pageSession,
      `document.querySelector('#post-ja').scrollIntoView({ block: 'center' }), null`);
    await sleep(800);
    const r = JSON.parse(await evalIn(cdp, pageSession, `(() => {
      const rr = document.querySelector('#shot-ja').getBoundingClientRect();
      return JSON.stringify({ x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 });
    })()`));
    menuPick(r.x, r.y);
    let info = null;
    for (let i = 0; i < 40 && !info; i++) { info = await overlayInfo(); await sleep(250); }
    console.log(info ? `MENU_TEST_OK ${info.spans} spans` : 'MENU_TEST_FAIL no overlay');
    await cdp.send('Browser.close').catch(() => {});
    process.exit(info ? 0 : 1);
  }

  // Pre-pass: warm the engine off-camera (XNNPACK + webgpu pipelines + a
  // first full read) on a mock that never appears in the video.
  step('warm-up read…');
  await evalIn(cdp, engineSession,
    `__pt.ocrSummary(${JSON.stringify(`${base}/verify-B-post-ja-dark.png`)})
      .then((r) => JSON.stringify(r.stats ?? r))`, true, 60000).then((s) => step(`warm: ${s}`));

  // --- recording starts ---
  if (!dry) {
    rmSync(rawMov, { force: true });
    await raise();
    rec = spawn('screencapture', [
      '-v', '-x', `-R${WIN.left},${WIN.top},${WIN.width},${WIN.height}`, rawMov,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    await sleep(4000);
    beats.length = 0;
  }

  // Scene 1 — feed scroll down to the JA screenshot post.
  await evalIn(cdp, pageSession, 'scrollTo({ top: 0 }), null');
  await move(640, 200);
  mark('scene1');
  await sleep(600);
  await evalIn(cdp, pageSession,
    `document.querySelector('#post-ja').scrollIntoView({ block: 'center', behavior: 'smooth' }), null`);
  await sleep(1400);
  await featureShot('#shot-ja', base, '長文を画像', 'できない');

  // Scene 2 — the EN screenshot post.
  await evalIn(cdp, pageSession,
    `document.querySelector('#post-en').scrollIntoView({ block: 'center', behavior: 'smooth' }), null`);
  await sleep(1400);
  await featureShot('#shot-en', base, 'Screenshots', 'copyable');
  mark('end');

  if (dry) {
    console.log('DRY_RESULT tour complete — every beat above must log "overlay: N spans"');
    clearTimeout(watchdog);
    await cdp.send('Browser.close').catch(() => {});
    process.exit(0);
  }
  await sleep(1000);
  const inner = JSON.parse(await evalIn(cdp, pageSession,
    'JSON.stringify({ w: innerWidth, h: innerHeight })'));
  rec.kill('SIGINT');
  await new Promise((r) => rec.on('exit', r));
  const stopWall = Date.now();

  const take = { WIN, inner, markers, beats, stopWall };
  writeFileSync(takeJson, JSON.stringify(take, null, 2));
  encode(take);
  clearTimeout(watchdog);
  await cdp.send('Browser.close').catch(() => {});
  process.exit(0);
} catch (err) {
  console.error('record failed:', err);
  try { rec?.kill('SIGINT'); } catch { /* not running */ }
  process.exit(1);
}
