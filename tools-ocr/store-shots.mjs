/**
 * Chrome Web Store screenshots for Page Text (1280×800, the store's size).
 *
 *   node tools-ocr/store-shots.mjs <chrome-binary> [--profile=<dir>]
 *
 * Drives the STORE build (dist-ocr-store) over the self-authored demo feed,
 * so every pixel shipped to the listing is content we own — no third-party
 * photos, no real accounts (see the demo-content licensing rules).
 * Writes out-ocr/store-text-{1,2,3}.png.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { Cdp, attachTo, evalIn, findTarget, launchChrome, sleep, waitForEndpoint, waitForEngine } from '../tools/cdp.mjs';

const chromeBin = process.argv[2];
const profile = process.argv.find((a) => a.startsWith('--profile='))?.slice(10);
if (!chromeBin) {
  console.error('usage: node tools-ocr/store-shots.mjs <chrome-binary> [--profile=<dir>]');
  process.exit(2);
}
const outDir = resolve(import.meta.dirname, '..', 'out-ocr');
const MIME = { '.html': 'text/html', '.png': 'image/png' };
const server = createServer((req, res) => {
  try {
    const path = req.url === '/' ? resolve(import.meta.dirname, 'demo.html')
      : resolve(outDir, decodeURIComponent(req.url.slice(1)));
    const body = readFileSync(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'text/html' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const port = 9241;
// The store build has no dev hooks, so the tour drives it the way a user
// would: the service worker's context-menu message and the keyboard shortcut.
launchChrome(chromeBin, {
  dist: resolve(import.meta.dirname, '..', 'dist-ocr-store'),
  port,
  profile,
  url: `${base}/`,
});

// No clip: Page.captureScreenshot's clip is DOCUMENT-relative, so it ignores
// the scroll position and a scrolled-down shot comes out empty. The device
// metrics override already pins the viewport to exactly 1280x800.
const shot = async (cdp, session, name) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, session, 30000);
  writeFileSync(resolve(outDir, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`${name}.png`);
};

try {
  const cdp = await Cdp.connect(await waitForEndpoint(port));
  const { status } = await waitForEngine(cdp, { hook: '__pt', timeoutMs: 6 * 60 * 1000 })
    .catch(() => ({ status: null }));
  // The store build exposes no hook; fall back to waiting on first use.
  if (status) console.log(`engine: ${status.state}`);

  const page = await findTarget(cdp, (t) => t.type === 'page' && t.url.startsWith(base));
  const session = await attachTo(cdp, page);
  await cdp.send('Page.enable', {}, session);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, session);
  await sleep(1500);

  const sw = await findTarget(cdp, (t) =>
    t.type === 'service_worker' && t.url.startsWith('chrome-extension://'));
  const swSession = await attachTo(cdp, sw);

  // Shot 1 — selectable text layer over a screenshot.
  await evalIn(cdp, session,
    `document.querySelector('#post-a').scrollIntoView({ block: 'center' }), null`);
  await sleep(600);
  const src = await evalIn(cdp, session, 'document.querySelector("#shot-a").currentSrc');
  await evalIn(cdp, swSession, `
    chrome.tabs.query({}).then(async (tabs) => {
      for (const t of tabs) {
        await chrome.tabs.sendMessage(t.id, { type: 'activate-ocr', srcUrl: ${JSON.stringify(src)} })
          .catch(() => {});
      }
      return 'sent';
    })`, true);
  for (let i = 0; i < 40; i++) {
    const up = await evalIn(cdp, session, 'Boolean(document.querySelector("[data-pagetext]"))');
    if (up) break;
    await sleep(500);
  }
  await sleep(400); // boxes still flashing: that is the "it found this" frame
  await shot(cdp, session, 'store-text-1');

  const diag = await evalIn(cdp, session, `JSON.stringify({
    host: Boolean(document.querySelector('[data-pagetext]')),
    spans: document.querySelectorAll('[data-pagetext] span').length,
    boxes: document.querySelectorAll('[data-pagetext] .pt-box').length,
    vw: innerWidth, vh: innerHeight,
  })`);
  console.log('after shot 1:', diag);
  await sleep(600);
  console.log('after settle:', await evalIn(cdp, session,
    `JSON.stringify({host: Boolean(document.querySelector('[data-pagetext]')), vw: innerWidth})`));

  // Shot 2 — the same overlay with a live selection, mid-copy.
  await evalIn(cdp, session, `(() => {
    const host = document.querySelector('[data-pagetext]');
    const spans = [...host.querySelectorAll('span')].filter((s) => s.textContent);
    const r = document.createRange();
    r.setStart(spans[2].firstChild, 0);
    r.setEnd(spans[Math.min(spans.length - 1, 8)].firstChild, spans[Math.min(spans.length - 1, 8)].textContent.length);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    return null;
  })()`);
  await sleep(300);
  await shot(cdp, session, 'store-text-2');

  // Shot 3 — find-in-images: one query, several screenshots lit.
  await evalIn(cdp, session, 'getSelection().removeAllRanges(), null');
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent',
      { type, key: 'Escape', windowsVirtualKeyCode: 27 }, session);
  }
  // Frame two lit screenshots at once: centre the gap between the two
  // images that will match, so the shot shows one query hitting several.
  await evalIn(cdp, session, `(() => {
    const a = document.querySelector('#shot-c').getBoundingClientRect();
    const b = document.querySelector('#shot-d').getBoundingClientRect();
    const mid = (a.top + b.bottom) / 2 + scrollY;
    scrollTo({ top: Math.max(0, mid - innerHeight / 2) });
    return null;
  })()`);
  await sleep(1200);
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent',
      { type, key: 'F', code: 'KeyF', windowsVirtualKeyCode: 70, modifiers: 9 }, session);
  }
  await sleep(700);
  for (const ch of 'Friday') {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }, session);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }, session);
    await sleep(60);
  }
  let hits = 0;
  for (let i = 0; i < 60; i++) {
    hits = await evalIn(cdp, session, 'document.querySelectorAll("[data-pagetext-hit]").length');
    if (hits >= 2) break;
    await sleep(500);
  }
  console.log(`find highlights: ${hits}`);
  await sleep(400);
  await shot(cdp, session, 'store-text-3');
  const visible = await evalIn(cdp, session, `(() => {
    const imgs = new Set();
    for (const h of document.querySelectorAll('[data-pagetext-hit]')) {
      const r = h.getBoundingClientRect();
      if (r.top > 0 && r.bottom < innerHeight) imgs.add(Math.round(r.top / 100));
    }
    return imgs.size;
  })()`);
  console.log(`lit regions visible in shot 3: ${visible}`);

  await cdp.send('Browser.close').catch(() => {});
  server.close();
  process.exit(hits >= 2 ? 0 : 1);
} catch (err) {
  console.error('store-shots failed:', err.message);
  process.exit(1);
}
