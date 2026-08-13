/**
 * Local audio sink for demo recordings: the offscreen engine mirrors every
 * scheduled utterance here (wav body + x-wall-ms header = wall-clock time the
 * chunk starts playing). Files + a manifest land in the given directory;
 * tools/mux.mjs assembles them into a screen recording's audio track.
 *
 *   node tools/audio-sink.mjs [outDir]   (default out/audio)
 */
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'out/audio';
mkdirSync(dir, { recursive: true });
let n = 0;

createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  if (req.method === 'POST' && req.url === '/wav') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const file = `u${String(n++).padStart(3, '0')}.wav`;
      writeFileSync(join(dir, file), Buffer.concat(chunks));
      appendFileSync(
        join(dir, 'manifest.jsonl'),
        JSON.stringify({ file, wallMs: Number(req.headers['x-wall-ms']) }) + '\n',
      );
      console.log(`${file} @ ${req.headers['x-wall-ms']}`);
      res.end('ok');
    });
    return;
  }
  res.end('ok');
}).listen(8908, () => console.log(`audio sink → ${dir} (port 8908)`));
