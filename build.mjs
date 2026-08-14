/**
 * Builds the unpacked extension:
 *   node build.mjs           → dist/        (Page Voice dev: eager engine,
 *                                            localhost test-page matches,
 *                                            audio sink)
 *   node build.mjs --3d      → dist3d/      (Page 3D dev, from src3d/ +
 *                                            public3d/)
 *   node build.mjs --ocr     → dist-ocr/    (Page Text dev, from src-ocr/ +
 *                                            public-ocr/)
 *
 * Add --store to any of them → dist-store/ | dist3d-store/ | dist-ocr-store/.
 * A store build compiles the dev hooks out (__DEV__ false), drops the
 * localhost test-page matches, sets the shipping name and the icons.
 *
 * All bundle each entry point with esbuild (classic scripts — content
 * scripts and the MV3 service worker don't take ESM here), copy static files
 * from the public dir, and copy the LiteRT.js wasm runtime next to
 * offscreen.html.
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const store = process.argv.includes('--store');
const three = process.argv.includes('--3d');
const ocr = process.argv.includes('--ocr');
const src = three ? 'src3d' : ocr ? 'src-ocr' : 'src';
const pub = three ? 'public3d' : ocr ? 'public-ocr' : 'public';
const base = three ? 'dist3d' : ocr ? 'dist-ocr' : 'dist';
const outdir = store ? (three || ocr ? `${base}-store` : 'dist-store') : base;
// Shipping names: the manifests carry "(dev)" so an unpacked build is never
// mistaken for the store one in chrome://extensions.
// The store name is also the search key: Chrome Web Store search is the only
// organic discovery an unknown extension gets, and "Page Text" matches
// nothing anyone types. Competitors rank on the query itself
// ("Copy Text from Picture", "Image to Text (OCR)").
const STORE_NAME = three ? 'Page 3D — see any photo in 3D'
  : ocr ? 'Page Text — copy text from any image (OCR)'
  : 'Page Voice';

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
  // Fold `if (__DEV__)` away in store builds. minifySyntax (not full minify)
  // drops the dead branch while leaving names and layout readable, so a
  // reviewer still reads real code and no debug hook ships.
  minifySyntax: store,
});

cpSync(pub, outdir, { recursive: true });
// LiteRT.js picks a wasm variant as: !relaxedSimd → compat, threads →
// threaded, jspi → jspi, else → plain. Chrome 128+ (our minimum) always has
// relaxed SIMD, and `threads` and `jspi` are mutually exclusive — we always
// ask for threads — so compat and jspi can never be selected. Shipping all
// four put 37 MB in the package to use 18 MB of it.
const WASM_VARIANTS = ['litert_wasm_internal', 'litert_wasm_threaded_internal'];
mkdirSync(`${outdir}/litert-wasm`, { recursive: true });
for (const v of WASM_VARIANTS) {
  for (const ext of ['js', 'wasm']) {
    cpSync(`node_modules/@litertjs/core/wasm/${v}.${ext}`, `${outdir}/litert-wasm/${v}.${ext}`);
  }
}

if (store) {
  const manifest = JSON.parse(readFileSync(`${outdir}/manifest.json`, 'utf8'));
  manifest.name = STORE_NAME;
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
