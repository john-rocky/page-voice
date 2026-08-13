/**
 * Builds the unpacked extension:
 *   node build.mjs           → dist/        (Page Voice dev: eager engine,
 *                                            localhost test-page matches,
 *                                            audio sink)
 *   node build.mjs --store   → dist-store/  (Page Voice store: on-demand
 *                                            engine, dev hooks compiled out,
 *                                            store name, icons required)
 *   node build.mjs --3d      → dist3d/      (Page 3D dev, from src3d/ +
 *                                            public3d/)
 *
 * All bundle each entry point with esbuild (classic scripts — content
 * scripts and the MV3 service worker don't take ESM here), copy static files
 * from the public dir, and copy the LiteRT.js wasm runtime next to
 * offscreen.html.
 */
import { build } from 'esbuild';
import { cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const store = process.argv.includes('--store');
const three = process.argv.includes('--3d');
if (store && three) throw new Error('--store is not wired up for --3d yet');
const src = three ? 'src3d' : 'src';
const pub = three ? 'public3d' : 'public';
const outdir = three ? 'dist3d' : store ? 'dist-store' : 'dist';

rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: {
    background: `${src}/background.js`,
    content: `${src}/content.js`,
    popup: `${src}/popup.js`,
    offscreen: `${src}/offscreen/main.js`,
  },
  bundle: true,
  format: 'iife',
  target: 'chrome128',
  outdir,
  logLevel: 'info',
  define: { __DEV__: String(!store) },
});

cpSync(pub, outdir, { recursive: true });
cpSync('node_modules/@litertjs/core/wasm', `${outdir}/litert-wasm`, { recursive: true });

if (store) {
  const manifest = JSON.parse(readFileSync(`${outdir}/manifest.json`, 'utf8'));
  manifest.name = 'Page Voice';
  manifest.content_scripts[0].matches = manifest.content_scripts[0].matches
    .filter((m) => !m.includes('127.0.0.1') && !m.includes('localhost'));
  manifest.icons = {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  };
  manifest.action.default_icon = manifest.icons;
  writeFileSync(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));
  cpSync('assets/icons', `${outdir}/icons`, { recursive: true });
}

console.log(`${outdir}/ ready — load it as an unpacked extension.`);
