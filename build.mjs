/**
 * Builds the unpacked extension into dist/:
 *   - bundles each entry point with esbuild (classic scripts, no modules —
 *     content scripts and the MV3 service worker don't take ESM here)
 *   - copies static extension files from public/
 *   - copies the LiteRT.js wasm runtime next to offscreen.html
 */
import { build } from 'esbuild';
import { cpSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: {
    background: 'src/background.js',
    content: 'src/content.js',
    popup: 'src/popup.js',
    offscreen: 'src/offscreen/main.js',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome128',
  outdir: 'dist',
  logLevel: 'info',
});

cpSync('public', 'dist', { recursive: true });
cpSync('node_modules/@litertjs/core/wasm', 'dist/litert-wasm', { recursive: true });
console.log('dist/ ready — load it as an unpacked extension.');
