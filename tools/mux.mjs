/**
 * Mux sink-mirrored TTS audio into a silent screen recording.
 *
 *   node tools/mux.mjs <video> <audioDir> <videoStartWallMs> <out.mp4> [tweakMs]
 *
 * audioDir is an audio-sink output dir (u*.wav + manifest.jsonl with wall-
 * clock schedule times). Each utterance is placed at
 * (wallMs - videoStartWallMs + tweakMs) into the video's timeline; use
 * tweakMs to correct for screencapture's spawn-to-first-frame latency.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [video, audioDir, startMsArg, out, tweakArg] = process.argv.slice(2);
if (!video || !audioDir || !startMsArg || !out) {
  console.error('usage: node tools/mux.mjs <video> <audioDir> <videoStartWallMs> <out.mp4> [tweakMs]');
  process.exit(2);
}
const videoStartMs = Number(startMsArg);
const tweakMs = Number(tweakArg ?? 0);

const entries = readFileSync(join(audioDir, 'manifest.jsonl'), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l))
  .map((e) => ({ ...e, delayMs: Math.round(e.wallMs - videoStartMs + tweakMs) }))
  .filter((e) => e.delayMs > -500) // drop pre-roll utterances (engine warm-up etc.)
  .map((e) => ({ ...e, delayMs: Math.max(0, e.delayMs) }))
  .sort((a, b) => a.delayMs - b.delayMs);
if (!entries.length) {
  console.error('no utterances in manifest');
  process.exit(1);
}

const args = ['-y', '-i', video];
for (const e of entries) args.push('-i', join(audioDir, e.file));
const chains = entries.map((e, i) => `[${i + 1}]adelay=${e.delayMs}|${e.delayMs}[a${i}]`);
const mixIn = entries.map((_, i) => `[a${i}]`).join('');
// duration=longest: the mix spans to the last utterance's end (the video is
// input 0 and not part of the mix; a shorter audio track than video is fine)
const filter = `${chains.join(';')};${mixIn}amix=inputs=${entries.length}:duration=longest:normalize=0[a]`;
args.push(
  '-filter_complex', filter,
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  out,
);
console.log('placing', entries.map((e) => `${e.file}@${(e.delayMs / 1000).toFixed(2)}s`).join(' '));
execFileSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
console.log(`wrote ${out}`);
