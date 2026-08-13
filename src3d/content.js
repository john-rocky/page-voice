/**
 * Content script (all pages): hover an image → ask the engine for its depth
 * map → overlay a WebGL canvas that re-renders the photo as a depth-displaced
 * plane mesh with mouse-follow parallax.
 *
 * The overlay never reads page pixels (cross-origin images taint canvases):
 * both the photo texture and the packed depth map come back from the
 * offscreen engine as data URLs, which are taint-free.
 *
 * Geometry: each pixel is unprojected through its depth (assumed 50° vfov),
 * the virtual camera orbits a pivot at the median depth, z-buffered. Depth
 * arrives packed as 16-bit disparity (R hi, G lo) relative to the median —
 * DISP_MIN/DISP_MAX must match src3d/offscreen/main.js.
 */

const DISP_MIN = 0.5;
const DISP_MAX = 2.2;
const ANCHOR = 1.6; // camera-space depth of the median-disparity plane
const TAN_HALF_VFOV = 0.4663; // tan(50°/2)
const GRID = 192;
const ZOOM = 1.06; // slight overscan so edges stay covered while orbiting
const YAW_AMP = 0.08;
const PITCH_AMP = 0.05;
const EXTRUDE_MS = 450;
const MIN_W = 150;
const MIN_H = 110;
const DWELL_MS = 200;
const LEAVE_MARGIN = 48;
const LEAVE_GRACE_MS = 220;
const CACHE_ENTRIES = 24;

let enabled = true;
let session = null; // the single active overlay
let activateToken = 0;
const resultCache = new Map(); // source url → engine payload (LRU)
const lastPointer = { x: -1, y: -1, movedAt: 0 };

function send(msg) {
  return chrome.runtime.sendMessage({ target: 'bg', ...msg }).catch(() => null);
}

// --- eligibility / source resolution -----------------------------------------

function eligible(img) {
  if (!(img instanceof HTMLImageElement)) return false;
  if (!img.complete || !img.naturalWidth) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_W || rect.height < MIN_H) return false;
  return Boolean(img.currentSrc || img.src);
}

/** URL the engine should fetch. blob: URLs are page-scoped (the engine can't
 * fetch them) but same-origin to this document, so re-encode locally. */
function sourceFor(img) {
  const src = img.currentSrc || img.src;
  if (!src) return null;
  if (!src.startsWith('blob:')) return src;
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  } catch {
    return null; // tainted
  }
}

/** The on-screen rect the effect should cover, honoring object-fit: for
 * 'contain'/'scale-down' shrink the overlay to the drawn content; for
 * 'cover' keep the rect and return the uv crop of the visible region. */
function fitRect(img) {
  const rect = img.getBoundingClientRect();
  const fit = getComputedStyle(img).objectFit || 'fill';
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  let { left, top, width, height } = rect;
  let uv = { x: 0, y: 0, w: 1, h: 1 };
  if (fit === 'contain' || fit === 'scale-down') {
    const s = Math.min(width / nw, height / nh);
    const w = nw * s;
    const h = nh * s;
    left += (width - w) / 2;
    top += (height - h) / 2;
    width = w;
    height = h;
  } else if (fit === 'cover') {
    const s = Math.max(width / nw, height / nh);
    uv = {
      w: width / s / nw,
      h: height / s / nh,
      x: (1 - width / s / nw) / 2,
      y: (1 - height / s / nh) / 2,
    };
  }
  return { left, top, width, height, uv };
}

// --- hover detection -----------------------------------------------------------

/** The image under the cursor. Sites layer hover chrome (links, gradients,
 * "save" buttons) over their photos, so the event target is rarely the <img>
 * itself — dig through the top few hit-test layers instead. */
function imageAtPoint(x, y) {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack.slice(0, 6)) {
    if (el instanceof HTMLImageElement) return eligible(el) ? el : null;
    // img styled under a positioned wrapper: check direct children too
    const child = el.firstElementChild;
    if (child instanceof HTMLImageElement && eligible(child)) return child;
  }
  return null;
}

let dwellTimer = null;
let dwellTarget = null;
let lastProbe = 0;
let settleTimer = null;

function probeAt(x, y) {
  const img = imageAtPoint(x, y);
  if (img === dwellTarget) return;
  clearTimeout(dwellTimer);
  dwellTarget = img;
  if (img && session?.img !== img) {
    dwellTimer = setTimeout(() => {
      if (dwellTarget === img) activate(img);
    }, DWELL_MS);
  }
}

window.addEventListener('pointermove', (event) => {
  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;
  lastPointer.movedAt = performance.now();
  if (!enabled) return;
  // Throttled probe while moving (hit-testing is not free) + a trailing
  // probe once the pointer settles: the throttle can swallow the final
  // pointermove of a glide, leaving the resting position unevaluated and
  // the dwell never starting.
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => probeAt(lastPointer.x, lastPointer.y), 130);
  if (lastPointer.movedAt - lastProbe < 120) return;
  lastProbe = lastPointer.movedAt;
  probeAt(event.clientX, event.clientY);
}, { passive: true });

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') teardown();
}, true);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'activate-3d' && msg.srcUrl) {
    const img = [...document.images].find(
      (i) => i.currentSrc === msg.srcUrl || i.src === msg.srcUrl,
    );
    if (img) activate(img, { force: true });
  }
});

// --- activation flow --------------------------------------------------------------

async function activate(img, { force = false } = {}) {
  if (!eligible(img) && !force) return;
  const source = sourceFor(img);
  if (!source) return;
  const token = ++activateToken;
  teardown(true);

  const badge = showBadge(img, 'depth…');
  const poll = setInterval(async () => {
    const s = await send({ type: 'status' });
    if (!s || token !== activateToken) return;
    if (s.state === 'downloading') badge.set(`depth model ${s.downloadedMB ?? 0} MB…`);
    else if (s.state === 'compiling') badge.set('compiling…');
    else if (s.state === 'ready') badge.set('depth…');
  }, 900);

  let payload = resultCache.get(source);
  if (!payload) {
    payload = await send({ type: 'depth', url: source });
    if (payload?.ok) {
      resultCache.set(source, payload);
      if (resultCache.size > CACHE_ENTRIES) {
        resultCache.delete(resultCache.keys().next().value);
      }
    }
  }
  clearInterval(poll);
  badge.remove();
  if (token !== activateToken) return; // superseded
  if (!payload?.ok) return;

  // If the pointer wandered off during inference, don't pop the overlay
  // (the result stays cached — re-hover is instant). Menu activations skip this.
  if (!force) {
    const r = img.getBoundingClientRect();
    if (
      lastPointer.x < r.left - LEAVE_MARGIN || lastPointer.x > r.right + LEAVE_MARGIN ||
      lastPointer.y < r.top - LEAVE_MARGIN || lastPointer.y > r.bottom + LEAVE_MARGIN
    ) return;
  }
  if (!img.isConnected) return;

  try {
    await buildOverlay(img, payload, token);
  } catch (err) {
    console.warn('[page3d] overlay failed:', err);
  }
}

function teardown(immediate = false) {
  clearTimeout(dwellTimer);
  dwellTarget = null;
  const s = session;
  if (!s) return;
  session = null;
  cancelAnimationFrame(s.raf);
  const kill = () => {
    try { s.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* gone */ }
    s.host.remove();
  };
  if (immediate) kill();
  else {
    s.host.style.opacity = '0';
    setTimeout(kill, 180);
  }
}

// --- badges ------------------------------------------------------------------------

function pill(textContent) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;' +
    'font:11px/1.2 -apple-system,system-ui,sans-serif;color:#e8e8ec;' +
    'background:rgba(20,20,24,.88);padding:5px 10px;border-radius:999px;' +
    'box-shadow:0 2px 10px rgba(0,0,0,.35);transition:opacity .3s;';
  el.textContent = textContent;
  return el;
}

function showBadge(img, text) {
  const el = pill(text);
  const r = img.getBoundingClientRect();
  el.style.left = `${Math.max(8, r.left + 8)}px`;
  el.style.top = `${Math.max(8, r.top + 8)}px`;
  document.documentElement.appendChild(el);
  return {
    set: (t) => { el.textContent = t; },
    remove: () => el.remove(),
  };
}

// --- WebGL overlay -----------------------------------------------------------------

const VS = `#version 300 es
precision highp float;
in vec2 aUv;
uniform sampler2D uDepth;
uniform vec2 uTanHalf;
uniform vec2 uRot;        // yaw, pitch (radians)
uniform float uDispScale; // 0 = flat photo, 1 = full extrusion
uniform vec4 uUvRect;     // x, y, w, h crop (object-fit: cover)
out vec2 vUv;
const float DISP_MIN = ${DISP_MIN};
const float DISP_MAX = ${DISP_MAX};
const float ANCHOR = ${ANCHOR};
const float ZOOM = ${ZOOM};
const float NEAR = 0.05;
const float FAR = 30.0;
void main() {
  vec2 uv = uUvRect.xy + aUv * uUvRect.zw;
  vUv = uv;
  vec4 t = texture(uDepth, uv);
  float n = (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0;
  float q = mix(DISP_MIN, DISP_MAX, n);
  float depth = ANCHOR / mix(1.0, q, uDispScale);
  vec2 ndc = vec2(aUv.x * 2.0 - 1.0, 1.0 - aUv.y * 2.0);
  vec3 P = vec3(ndc * uTanHalf * depth, -depth);
  vec3 C = vec3(0.0, 0.0, -ANCHOR);
  vec3 rel = P - C;
  float cy = cos(uRot.x), sy = sin(uRot.x);
  rel = vec3(cy * rel.x + sy * rel.z, rel.y, -sy * rel.x + cy * rel.z);
  float cp = cos(uRot.y), sp = sin(uRot.y);
  rel = vec3(rel.x, cp * rel.y - sp * rel.z, sp * rel.y + cp * rel.z);
  vec3 Q = rel + C;
  float w = max(-Q.z, NEAR);
  float zNdc = ((w - NEAR) / (FAR - NEAR)) * 2.0 - 1.0;
  gl_Position = vec4(Q.xy / uTanHalf * ZOOM, zNdc * w, w);
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uPhoto;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uPhoto, vUv).rgb, 1.0);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

/** Decode a data URL without an <img> element: element/resource loads made
 * by a content script are subject to the page's CSP (x.com's img-src could
 * reject data:), while programmatic Blob decoding is not. */
function loadImage(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return createImageBitmap(new Blob([bytes], { type: mime }));
}

function makeTexture(gl, image, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return tex;
}

async function buildOverlay(img, payload, token) {
  const [photoImg, depthImg] = await Promise.all([
    loadImage(payload.photo.url),
    loadImage(payload.depth.url),
  ]);
  if (token !== activateToken || !img.isConnected) return;

  const host = document.createElement('div');
  host.setAttribute('data-page3d', 'loading');
  host.style.cssText =
    'position:fixed;z-index:2147483646;pointer-events:none;overflow:hidden;' +
    'opacity:0;transition:opacity .18s ease-out;';
  const radius = getComputedStyle(img).borderRadius;
  if (radius && radius !== '0px') host.style.borderRadius = radius;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  host.appendChild(canvas);
  document.documentElement.appendChild(host);

  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, depth: true, premultipliedAlpha: true,
  });
  if (!gl) {
    host.remove();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    host.remove();
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // Grid mesh: (GRID+1)² vertices, uv attribute only.
  const verts = new Float32Array((GRID + 1) * (GRID + 1) * 2);
  let vi = 0;
  for (let y = 0; y <= GRID; y++) {
    for (let x = 0; x <= GRID; x++) {
      verts[vi++] = x / GRID;
      verts[vi++] = y / GRID;
    }
  }
  const indices = new Uint32Array(GRID * GRID * 6);
  let ii = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = y * (GRID + 1) + x;
      const b = a + 1;
      const c = a + GRID + 1;
      const d = c + 1;
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
      indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
    }
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.activeTexture(gl.TEXTURE0);
  makeTexture(gl, photoImg, gl.LINEAR);
  gl.activeTexture(gl.TEXTURE1);
  // LINEAR is safe on the packed depth: decode is linear in (r, g), so
  // bilinear filtering commutes with it.
  makeTexture(gl, depthImg, gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program, 'uPhoto'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uDepth'), 1);
  const uTanHalf = gl.getUniformLocation(program, 'uTanHalf');
  const uRot = gl.getUniformLocation(program, 'uRot');
  const uDispScale = gl.getUniformLocation(program, 'uDispScale');
  const uUvRect = gl.getUniformLocation(program, 'uUvRect');

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0, 0, 0, 0);

  const startedAt = performance.now();
  const rot = { yaw: 0, pitch: 0 };
  let leaveAt = 0;
  let shownLatency = false;

  session = { img, host, canvas, gl, raf: 0 };

  const frame = () => {
    if (session?.host !== host) return;
    if (!img.isConnected) {
      teardown();
      return;
    }
    const { left, top, width, height, uv } = fitRect(img);
    if (width < 10 || height < 10) {
      teardown();
      return;
    }
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }

    // Leave detection: pointer outside the inflated rect for a grace period.
    const inside =
      lastPointer.x >= left - LEAVE_MARGIN && lastPointer.x <= left + width + LEAVE_MARGIN &&
      lastPointer.y >= top - LEAVE_MARGIN && lastPointer.y <= top + height + LEAVE_MARGIN;
    const now = performance.now();
    if (inside) leaveAt = 0;
    else if (!leaveAt) leaveAt = now;
    else if (now - leaveAt > LEAVE_GRACE_MS) {
      teardown();
      return;
    }

    // Parallax target: mouse-follow, drifting into a gentle sway when idle.
    let yawT;
    let pitchT;
    if (now - lastPointer.movedAt < 1300) {
      const nx = Math.max(-1, Math.min(1, (lastPointer.x - (left + width / 2)) / (width / 2)));
      const ny = Math.max(-1, Math.min(1, (lastPointer.y - (top + height / 2)) / (height / 2)));
      yawT = nx * YAW_AMP;
      pitchT = -ny * PITCH_AMP;
    } else {
      const t = now / 1000;
      yawT = Math.sin(t * (Math.PI * 2) / 6) * 0.045;
      pitchT = Math.sin(t * (Math.PI * 2) / 3 + 1.3) * 0.02;
    }
    rot.yaw += (yawT - rot.yaw) * 0.12;
    rot.pitch += (pitchT - rot.pitch) * 0.12;

    const extrude = Math.min(1, (now - startedAt) / EXTRUDE_MS);
    const dispScale = 1 - (1 - extrude) ** 3; // ease-out cubic

    gl.viewport(0, 0, pw, ph);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(uTanHalf, TAN_HALF_VFOV * (width / height), TAN_HALF_VFOV);
    gl.uniform2f(uRot, rot.yaw, rot.pitch);
    gl.uniform1f(uDispScale, dispScale);
    gl.uniform4f(uUvRect, uv.x, uv.y, uv.w, uv.h);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);

    if (host.style.opacity !== '1') {
      host.style.opacity = '1';
      host.dataset.page3d = 'active';
    }
    if (!shownLatency && payload.stats) {
      shownLatency = true;
      const env = payload.stats.backend === 'webgpu' ? 'WebGPU' : 'WASM';
      const b = pill(`MoGe-2 · ${payload.stats.inferMs} ms · ${env} · on-device`);
      b.style.position = 'absolute';
      b.style.left = '10px';
      b.style.bottom = '10px';
      host.appendChild(b);
      setTimeout(() => { b.style.opacity = '0'; }, 2800);
      setTimeout(() => b.remove(), 3200);
    }
    session.raf = requestAnimationFrame(frame);
  };
  // First frame synchronously: rAF is throttled to zero in occluded windows,
  // and the overlay must still appear (and mark itself active) there.
  frame();
}

// --- settings ----------------------------------------------------------------------

chrome.storage.local.get('p3-enabled').then((v) => {
  enabled = v?.['p3-enabled'] ?? true;
}).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'p3-enabled' in changes) {
    enabled = changes['p3-enabled'].newValue ?? true;
    if (!enabled) teardown();
  }
});
