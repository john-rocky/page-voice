/**
 * Minimal CDP helpers shared by the smoke scripts. Uses only node built-ins
 * (global WebSocket needs node ≥22).
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launch a Chromium build that honors --load-extension, with a throwaway
 *  profile unless one is given (reuse a profile to keep the model cache). */
export function launchChrome(bin, { dist, port, profile, url = 'about:blank' }) {
  profile ??= mkdtempSync(join(tmpdir(), 'pv-smoke-'));
  console.log(`profile: ${profile}`);
  const child = spawn(bin, [
    `--user-data-dir=${profile}`,
    `--load-extension=${dist}`,
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    // The test window opens on a desktop someone is actively using — keep
    // rAF/timers running even when another window covers it.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    // Reused profiles from Browser.close'd runs otherwise show a "restore
    // pages?" bubble that ruins recordings.
    '--hide-crash-restore-bubble',
    url,
  ], { stdio: 'ignore' });
  process.on('exit', () => { try { child.kill(); } catch { /* gone */ } });
  return child;
}

export async function waitForEndpoint(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('DevTools endpoint never came up');
}

/** Flat-session CDP client. */
export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 20000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      // Reject instead of hanging forever: a session whose renderer crashed
      // or detached mid-navigation simply never answers.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

export async function attachTo(cdp, target) {
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  return sessionId;
}

export async function evalIn(cdp, sessionId, expression, awaitPromise = false) {
  const { result, exceptionDetails } = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise, returnByValue: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? 'evaluate failed');
  }
  return result?.value;
}

export async function findTarget(cdp, predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const hit = targetInfos.find(predicate);
    if (hit) return hit;
    if (Date.now() > deadline) {
      throw new Error(`target not found; saw: ${targetInfos.map((t) => `${t.type}:${t.url}`).join(', ')}`);
    }
    await sleep(300);
  }
}

/** Wait for the offscreen engine to reach ready/error; returns final status.
 *  `hook` is the engine's globalThis debug object (__pv = voice, __p3 = 3d). */
export async function waitForEngine(cdp, { timeoutMs = 10 * 60 * 1000, hook = '__pv' } = {}) {
  const off = await findTarget(cdp, (t) => t.url.includes('/offscreen.html'));
  const session = await attachTo(cdp, off);
  const deadline = Date.now() + timeoutMs;
  let status = null;
  let lastLine = '';
  while (Date.now() < deadline) {
    // the document may still be executing its script — wait for the hook
    let raw = null;
    try {
      raw = await evalIn(cdp, session,
        `typeof ${hook} === 'undefined' ? null : JSON.stringify(${hook}.status)`);
    } catch { /* context not ready yet */ }
    if (raw === null) {
      await sleep(300);
      continue;
    }
    status = JSON.parse(raw);
    const line = `state=${status.state} downloaded=${status.downloadedMB}MB`;
    if (line !== lastLine) console.log(line);
    lastLine = line;
    if (status.state === 'ready' || status.state === 'error') break;
    await sleep(1000);
  }
  return { status, session };
}
