/**
 * PP-OCRv5 pipeline pieces shared by the offscreen engine and the
 * verification/e2e harnesses. Pure functions — no chrome.*, no model I/O.
 *
 * Spec source: litert-community/PP-OCRv5-LiteRT model card.
 *   det: image [1,3,640,640] NCHW, /255 then ImageNet mean/std
 *        → prob map [1,1,640,640]
 *   rec: line [1,3,48,320] NCHW, (x/255 − 0.5)/0.5, keep-aspect h=48,
 *        zero-pad to width 320 → CTC logits [1,T,18385]
 *   dict: 18383 lines; CTC layout = blank(0) + dict + space(18384)
 */

export const DET_SIZE = 640;
export const REC_H = 48;
export const REC_W = 320;
// A rec window reads at most REC_W/REC_H ≈ 6.7 of width:height. Lines longer
// than that are split at prob-map valleys (see splitLongBox).
export const REC_MAX_RATIO = REC_W / REC_H;

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/** RGBA ImageData (any size) → det input: stretch to 640×640, ImageNet
 * mean/std, NCHW. Returns {nchw, scaleX, scaleY} — box coords map back to
 * source pixels via the two scales. */
export function detPreprocess(rgba, srcW, srcH) {
  // Caller draws the source onto a 640×640 canvas; this just normalizes.
  const plane = DET_SIZE * DET_SIZE;
  const nchw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      nchw[c * plane + i] = (rgba[i * 4 + c] / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
    }
  }
  return { nchw, scaleX: srcW / DET_SIZE, scaleY: srcH / DET_SIZE };
}

/**
 * DB prob map → text-line boxes in det (640²) space.
 * Approximation of DB postprocess: binarize at `thresh`, 4-connected
 * components (BFS), drop tiny/low-confidence blobs, pad each box
 * (~unclip), then merge horizontally-adjacent boxes into lines — DB's
 * shrunk map often splits one visual line at wide word gaps.
 * Returns [{x0, y0, x1, y1, score}] sorted top-to-bottom, left-to-right.
 */
export function probToBoxes(prob, { thresh = 0.3, minScore = 0.5, minSize = 3 } = {}) {
  const W = DET_SIZE;
  const labels = new Int32Array(W * W); // 0 = unvisited/below-threshold
  const comps = [];
  const stack = new Int32Array(W * W);
  for (let i = 0; i < W * W; i++) {
    if (labels[i] !== 0 || prob[i] <= thresh) continue;
    const label = comps.length + 1;
    let top = 0;
    stack[top++] = i;
    labels[i] = label;
    let minX = W, minY = W, maxX = 0, maxY = 0, sum = 0, count = 0;
    while (top > 0) {
      const p = stack[--top];
      const x = p % W;
      const y = (p / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sum += prob[p];
      count++;
      if (x > 0 && labels[p - 1] === 0 && prob[p - 1] > thresh) { labels[p - 1] = label; stack[top++] = p - 1; }
      if (x < W - 1 && labels[p + 1] === 0 && prob[p + 1] > thresh) { labels[p + 1] = label; stack[top++] = p + 1; }
      if (y > 0 && labels[p - W] === 0 && prob[p - W] > thresh) { labels[p - W] = label; stack[top++] = p - W; }
      if (y < W - 1 && labels[p + W] === 0 && prob[p + W] > thresh) { labels[p + W] = label; stack[top++] = p + W; }
    }
    comps.push({ minX, minY, maxX, maxY, score: sum / count });
  }

  let boxes = [];
  for (const c of comps) {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    if (w < minSize || h < minSize || c.score < minScore) continue;
    // DB's training shrinks text masks; grow the box back (approx unclip).
    const pad = Math.min(24, Math.max(2, Math.round(0.35 * Math.min(w, h))));
    boxes.push({
      x0: Math.max(0, c.minX - pad),
      y0: Math.max(0, c.minY - pad),
      x1: Math.min(W - 1, c.maxX + pad),
      y1: Math.min(W - 1, c.maxY + pad),
      score: c.score,
    });
  }

  // Merge boxes on the same text line: strong vertical overlap and a
  // horizontal gap smaller than the line height.
  boxes.sort((a, b) => a.x0 - b.x0);
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < boxes.length && !merged; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ha = a.y1 - a.y0;
        const hb = b.y1 - b.y0;
        const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (overlap < 0.5 * Math.min(ha, hb)) continue;
        const gap = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
        if (gap > 1.2 * Math.min(ha, hb)) continue;
        boxes[i] = {
          x0: Math.min(a.x0, b.x0),
          y0: Math.min(a.y0, b.y0),
          x1: Math.max(a.x1, b.x1),
          y1: Math.max(a.y1, b.y1),
          score: (a.score + b.score) / 2,
        };
        boxes.splice(j, 1);
        merged = true;
        break;
      }
    }
  }

  boxes.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
  return boxes;
}

/**
 * A det box wider than REC_MAX_RATIO × height must be read in several rec
 * windows. Split at prob-map "valleys" (columns inside the box where the
 * map is blank — i.e. gaps between words/characters) nearest to the ideal
 * cut positions, so no glyph is cut in half. Returns x-ranges in det space.
 */
export function splitLongBox(prob, box, maxRatio = REC_MAX_RATIO * 0.92) {
  const W = DET_SIZE;
  const h = box.y1 - box.y0 + 1;
  const w = box.x1 - box.x0 + 1;
  const maxW = Math.max(8, Math.round(h * maxRatio));
  if (w <= maxW) return [[box.x0, box.x1]];

  // Column ink profile from the prob map.
  const profile = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = box.y0; y <= box.y1; y++) s += prob[y * W + box.x0 + x];
    profile[x] = s / h;
  }

  const pieces = [];
  let start = 0;
  while (w - start > maxW) {
    const idealEnd = start + maxW;
    // Search a window left of the ideal cut for the emptiest column.
    let bestX = idealEnd;
    let bestV = Infinity;
    const from = Math.max(start + Math.round(maxW * 0.55), start + 4);
    for (let x = idealEnd; x >= from; x--) {
      if (profile[x] < bestV) {
        bestV = profile[x];
        bestX = x;
        if (bestV === 0) break;
      }
    }
    pieces.push([box.x0 + start, box.x0 + bestX]);
    start = bestX + 1;
  }
  pieces.push([box.x0 + start, box.x1]);
  return pieces;
}

/** RGBA ImageData of a line crop already resized to 48×contentW (≤320) →
 * rec input tensor data, zero-padded ((0/255−0.5)/0.5 = −1) to 48×320. */
export function recPreprocess(rgba, contentW) {
  const plane = REC_H * REC_W;
  const nchw = new Float32Array(3 * plane).fill(-1);
  for (let y = 0; y < REC_H; y++) {
    for (let x = 0; x < contentW; x++) {
      const src = (y * contentW + x) * 4;
      const dst = y * REC_W + x;
      nchw[dst] = rgba[src] / 255 / 0.5 - 1;
      nchw[plane + dst] = rgba[src + 1] / 255 / 0.5 - 1;
      nchw[2 * plane + dst] = rgba[src + 2] / 255 / 0.5 - 1;
    }
  }
  return nchw;
}

/** CTC greedy decode. logits [T, C] flat → {text, ids} where ids are the
 * per-timestep argmaxes (kept for backend-equivalence checks). */
export function ctcDecode(logits, T, C, chars) {
  const ids = new Int32Array(T);
  for (let t = 0; t < T; t++) {
    const off = t * C;
    let best = 0;
    let bestV = logits[off];
    for (let c = 1; c < C; c++) {
      const v = logits[off + c];
      if (v > bestV) { bestV = v; best = c; }
    }
    ids[t] = best;
  }
  let text = '';
  for (let t = 0; t < T; t++) {
    const c = ids[t];
    if (c !== 0 && (t === 0 || c !== ids[t - 1])) text += chars[c] ?? '';
  }
  return { text, ids: Array.from(ids) };
}

/** dict file text → CTC char table (blank + 18383 chars + space). */
export function buildCharTable(dictText) {
  const lines = dictText.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return ['', ...lines, ' '];
}
