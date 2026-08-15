/**
 * Rasterizes an icon tile (assets/icon*.html) into the 16/32/48/128 PNGs a
 * Chrome extension needs.
 *
 *   node tools/render-icons.mjs <chrome-binary> assets/icon-ocr.html assets/icons-ocr
 *
 * Renders once at 4× and downscales with sips, so the small sizes get proper
 * area-averaged antialiasing instead of Chrome's 16px rasterization.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Cdp, attachTo, findTarget, launchChrome, sleep, waitForEndpoint } from './cdp.mjs';

const [bin, page, outDir] = process.argv.slice(2);
if (!bin || !page || !outDir) {
  console.error('usage: node tools/render-icons.mjs <chrome-binary> <icon.html> <out-dir>');
  process.exit(2);
}
const url = `file://${resolve(page)}`;
const port = 9251;
launchChrome(bin, { dist: resolve('dist-ocr-store'), port, url });

const cdp = await Cdp.connect(await waitForEndpoint(port));
const target = await findTarget(cdp, (t) => t.type === 'page' && t.url.startsWith('file://'));
const session = await attachTo(cdp, target);
await cdp.send('Page.enable', {}, session);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 128, height: 128, deviceScaleFactor: 4, mobile: false }, session);
await sleep(500);
const { data } = await cdp.send('Page.captureScreenshot',
  { format: 'png', captureBeyondViewport: false }, session);
await cdp.send('Browser.close').catch(() => {});

mkdirSync(outDir, { recursive: true });
const big = resolve(outDir, 'icon512.png');
writeFileSync(big, Buffer.from(data, 'base64'));
for (const size of [128, 48, 32, 16]) {
  execFileSync('sips', ['-Z', String(size), big, '--out', resolve(outDir, `icon${size}.png`)],
    { stdio: 'ignore' });
  console.log(`icon${size}.png`);
}
process.exit(0);
