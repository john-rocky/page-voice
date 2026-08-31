/**
 * Build + serve the minimal repro pages.
 *
 *   npm install          (repo root — needs @litertjs/core and esbuild)
 *   node repro/serve.mjs
 *
 * Then open the printed URL in Chrome. Pages need cross-origin isolation
 * (threaded WASM), so they must be served — not opened as file:// — and the
 * server sets COOP/COEP. Models are fetched from Hugging Face on first run
 * and kept in the browser's Cache API.
 */
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'out', 'repro-dist');
const cases = readdirSync(import.meta.dirname, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

mkdirSync(dist, { recursive: true });
await build({
  entryPoints: Object.fromEntries(cases.map((c) => [`${c}/page`, join(import.meta.dirname, c, 'main.js')])),
  bundle: true,
  format: 'iife',
  target: 'chrome128',
  outdir: dist,
  logLevel: 'silent',
});
cpSync(join(root, 'node_modules', '@litertjs', 'core', 'wasm'), join(dist, 'litert-wasm'),
  { recursive: true });
for (const c of cases) {
  writeFileSync(join(dist, c, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>${c}</title><script src="page.js"></script>`);
  try {
    cpSync(join(import.meta.dirname, c, 'crops'), join(dist, c, 'crops'), { recursive: true });
  } catch { /* case has no crops */ }
}
writeFileSync(join(dist, 'index.html'), '<!doctype html><meta charset="utf-8"><ul>'
  + cases.map((c) => `<li><a href="${c}/">${c}</a></li>`).join(''));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = readFileSync(join(dist, path));
    res.writeHead(200, {
      'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
const port = Number(process.env.PORT ?? 8123);
server.listen(port, '127.0.0.1', () => {
  console.log(`serving http://127.0.0.1:${port}/`);
  for (const c of cases) console.log(`  http://127.0.0.1:${port}/${c}/`);
});
