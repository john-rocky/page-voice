/**
 * Drive one repro case in an automated Chromium and print its JSON result.
 * Optional convenience — opening the served URL in any Chrome works too.
 *
 *   node repro/serve.mjs &            # or in another terminal
 *   node repro/run-headless.mjs <chrome-binary> <case-name> [--profile=<dir>]
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { Cdp, attachTo, evalIn, findTarget, sleep, waitForEndpoint } from '../tools/cdp.mjs';

const [bin, caseName] = process.argv.slice(2);
if (!bin || !caseName) {
  console.error('usage: node repro/run-headless.mjs <chrome-binary> <case-name> [--profile=<dir>]');
  process.exit(2);
}
const profile = process.argv.find((a) => a.startsWith('--profile='))?.slice(10)
  ?? mkdtempSync(join(tmpdir(), 'repro-'));
const port = Number(process.env.CDP_PORT ?? 9233);
const url = `http://127.0.0.1:${process.env.PORT ?? 8123}/${caseName}/`;

const child = spawn(bin, [
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  '--no-first-run', '--no-default-browser-check', '--disable-sync',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--hide-crash-restore-bubble',
  url,
], { stdio: 'ignore' });
process.on('exit', () => { try { child.kill(); } catch { /* gone */ } });

const cdp = await Cdp.connect(await waitForEndpoint(port));
const target = await findTarget(cdp, (t) => t.type === 'page' && t.url.startsWith(url));
const session = await attachTo(cdp, target);

let last = '';
const deadline = Date.now() + 10 * 60 * 1000;
for (;;) {
  if (Date.now() > deadline) throw new Error('timed out');
  let s = null;
  try {
    s = await evalIn(cdp, session,
      `typeof __repro === 'undefined' ? null : JSON.stringify(__repro.status)`);
  } catch { /* not ready */ }
  if (s) {
    const st = JSON.parse(s);
    const line = `${st.state} ${st.progress ?? ''}`;
    if (line !== last) console.error(line);
    last = line;
    if (st.state === 'done' || st.state === 'error') break;
  }
  await sleep(500);
}
console.log(await evalIn(cdp, session, 'JSON.stringify(__repro.result, null, 2)'));
await cdp.send('Browser.close').catch(() => {});
process.exit(0);
