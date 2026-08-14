(() => {
  // src3d/content.js
  var enabled = !0, session = null, activateToken = 0, resultCache = /* @__PURE__ */ new Map(), lastPointer = { x: -1, y: -1, movedAt: 0 };
  function send(msg) {
    return chrome.runtime.sendMessage({ target: "bg", ...msg }).catch(() => null);
  }
  function eligible(img) {
    if (!(img instanceof HTMLImageElement) || !img.complete || !img.naturalWidth) return !1;
    let rect = img.getBoundingClientRect();
    return rect.width < 150 || rect.height < 110 ? !1 : !!(img.currentSrc || img.src);
  }
  function sourceFor(img) {
    let src = img.currentSrc || img.src;
    if (!src) return null;
    if (!src.startsWith("blob:")) return src;
    try {
      let c = document.createElement("canvas");
      return c.width = img.naturalWidth, c.height = img.naturalHeight, c.getContext("2d").drawImage(img, 0, 0), c.toDataURL("image/jpeg", 0.92);
    } catch {
      return null;
    }
  }
  function fitRect(img) {
    let rect = img.getBoundingClientRect(), fit = getComputedStyle(img).objectFit || "fill", nw = img.naturalWidth, nh = img.naturalHeight, { left, top, width, height } = rect, uv = { x: 0, y: 0, w: 1, h: 1 };
    if (fit === "contain" || fit === "scale-down") {
      let s = Math.min(width / nw, height / nh), w = nw * s, h = nh * s;
      left += (width - w) / 2, top += (height - h) / 2, width = w, height = h;
    } else if (fit === "cover") {
      let s = Math.max(width / nw, height / nh);
      uv = {
        w: width / s / nw,
        h: height / s / nh,
        x: (1 - width / s / nw) / 2,
        y: (1 - height / s / nh) / 2
      };
    }
    return { left, top, width, height, uv };
  }
  function imageAtPoint(x, y) {
    let stack = document.elementsFromPoint(x, y);
    for (let el of stack.slice(0, 6)) {
      if (el instanceof HTMLImageElement) return eligible(el) ? el : null;
      let scanned = 0;
      for (let img of el.querySelectorAll("img")) {
        if (++scanned > 20) break;
        if (!eligible(img)) continue;
        let r = img.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return img;
      }
    }
    return null;
  }
  var dwellTimer = null, dwellTarget = null, lastProbe = 0, settleTimer = null;
  function probeAt(x, y) {
    let img = imageAtPoint(x, y);
    img !== dwellTarget && (clearTimeout(dwellTimer), dwellTarget = img, img && session?.img !== img && (dwellTimer = setTimeout(() => {
      dwellTarget === img && activate(img);
    }, 200)));
  }
  window.addEventListener("pointermove", (event) => {
    lastPointer.x = event.clientX, lastPointer.y = event.clientY, lastPointer.movedAt = performance.now(), enabled && (clearTimeout(settleTimer), settleTimer = setTimeout(() => probeAt(lastPointer.x, lastPointer.y), 130), !(lastPointer.movedAt - lastProbe < 120) && (lastProbe = lastPointer.movedAt, probeAt(event.clientX, event.clientY)));
  }, { passive: !0 });
  var shiftDown = !1;
  window.addEventListener("keydown", (event) => {
    event.key === "Escape" && teardown(), event.key === "Shift" && (shiftDown = !0);
  }, !0);
  window.addEventListener("keyup", (event) => {
    event.key === "Shift" && (shiftDown = !1);
  }, !0);
  window.addEventListener("blur", () => {
    shiftDown = !1;
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "activate-3d" && msg.srcUrl) {
      let img = [...document.images].find(
        (i) => i.currentSrc === msg.srcUrl || i.src === msg.srcUrl
      );
      img && activate(img, { force: !0 });
    }
  });
  async function activate(img, { force = !1 } = {}) {
    if (!eligible(img) && !force) return;
    let source = sourceFor(img);
    if (!source) return;
    let token = ++activateToken;
    teardown(!0);
    let badge = showBadge(img, "depth\u2026"), poll = setInterval(async () => {
      let s = await send({ type: "status" });
      !s || token !== activateToken || (s.state === "downloading" ? badge.set(`depth model ${s.downloadedMB ?? 0} MB\u2026`) : s.state === "compiling" ? badge.set("compiling\u2026") : s.state === "ready" && badge.set("depth\u2026"));
    }, 900), payload = resultCache.get(source);
    if (payload || (payload = await send({ type: "depth", url: source }), payload?.ok && (resultCache.set(source, payload), resultCache.size > 24 && resultCache.delete(resultCache.keys().next().value))), clearInterval(poll), badge.remove(), token === activateToken && payload?.ok) {
      if (!force) {
        let r = img.getBoundingClientRect();
        if (lastPointer.x < r.left - 48 || lastPointer.x > r.right + 48 || lastPointer.y < r.top - 48 || lastPointer.y > r.bottom + 48) return;
      }
      if (img.isConnected)
        try {
          await buildOverlay(img, payload, token);
        } catch (err) {
          console.warn("[page3d] overlay failed:", err);
        }
    }
  }
  function teardown(immediate = !1) {
    clearTimeout(dwellTimer), dwellTarget = null;
    let s = session;
    if (!s) return;
    session = null, cancelAnimationFrame(s.raf);
    let kill = () => {
      try {
        s.gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
      }
      s.host.remove();
    };
    immediate ? kill() : (s.host.style.opacity = "0", setTimeout(kill, 180));
  }
  function pill(textContent) {
    let el = document.createElement("div");
    return el.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;font:11px/1.2 -apple-system,system-ui,sans-serif;color:#e8e8ec;background:rgba(20,20,24,.88);padding:5px 10px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.35);transition:opacity .3s;", el.textContent = textContent, el;
  }
  function showBadge(img, text) {
    let el = pill(text), r = img.getBoundingClientRect();
    return el.style.left = `${Math.max(8, r.left + 8)}px`, el.style.top = `${Math.max(8, r.top + 8)}px`, document.documentElement.appendChild(el), {
      set: (t) => {
        el.textContent = t;
      },
      remove: () => el.remove()
    };
  }
  var VS = `#version 300 es
precision highp float;
in vec2 aUv;
uniform sampler2D uDepth;
uniform vec2 uTanHalf;
uniform vec2 uRot;        // yaw, pitch (radians)
uniform float uDispScale; // 0 = flat photo, 1 = full extrusion
uniform vec4 uUvRect;     // x, y, w, h crop (object-fit: cover)
out vec2 vUv;
out vec3 vPos;            // post-rotation view-space position, for lighting
const float DISP_MIN = ${0.5};
const float DISP_MAX = ${2.2};
const float ANCHOR = ${1.6};
const float ZOOM = ${1.06};
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
  vPos = Q;
  float w = max(-Q.z, NEAR);
  float zNdc = ((w - NEAR) / (FAR - NEAR)) * 2.0 - 1.0;
  gl_Position = vec4(Q.xy / uTanHalf * ZOOM, zNdc * w, w);
}`, FS = `#version 300 es
precision highp float; // uRot is shared with the VS \u2014 precisions must match
in vec2 vUv;
in vec3 vPos;
uniform sampler2D uPhoto;
uniform sampler2D uNormal;
uniform vec3 uLight;    // view-space light position (cursor, unprojected)
uniform float uLightOn; // 0 = plain photo \u2026 1 = flashlight
uniform vec2 uRot;      // same yaw/pitch the geometry was rotated by
out vec4 outColor;
const float AMBIENT = 0.34;
const float GAIN = 2.3;
const float ATT = 0.6;         // 1 / (1 + ATT\xB7d\xB2) distance falloff
const vec2 CONE = vec2(0.80, 0.95); // spot cone cos(outer), cos(inner)
const vec3 LIGHT_COLOR = vec3(1.0, 0.95, 0.85);
void main() {
  vec3 base = texture(uPhoto, vUv).rgb;
  if (uLightOn < 0.004) {
    outColor = vec4(base, 1.0);
    return;
  }
  // MoGe normals are OpenCV camera frame (x right, y down, z away from the
  // camera) \u2014 flip y and z into this view space, then rotate with the mesh.
  vec3 n = texture(uNormal, vUv).rgb * 2.0 - 1.0;
  vec3 N = normalize(vec3(n.x, -n.y, -n.z));
  float cy = cos(uRot.x), sy = sin(uRot.x);
  N = vec3(cy * N.x + sy * N.z, N.y, -sy * N.x + cy * N.z);
  float cp = cos(uRot.y), sp = sin(uRot.y);
  N = vec3(N.x, cp * N.y - sp * N.z, sp * N.y + cp * N.z);
  vec3 toLight = uLight - vPos;
  float dist = length(toLight);
  vec3 L = toLight / max(dist, 1e-4);
  float lambert = max(dot(N, L), 0.0);
  float cone = smoothstep(CONE.x, CONE.y, dot(-L, vec3(0.0, 0.0, -1.0)));
  float intensity = GAIN * lambert * cone / (1.0 + ATT * dist * dist);
  vec3 lit = base * (AMBIENT + intensity * LIGHT_COLOR);
  outColor = vec4(mix(base, lit, uLightOn), 1.0);
}`;
  function compile(gl, type, src) {
    let shader = gl.createShader(type);
    if (gl.shaderSource(shader, src), gl.compileShader(shader), !gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function loadImage(dataUrl) {
    let b64 = dataUrl.slice(dataUrl.indexOf(",") + 1), mime = dataUrl.slice(5, dataUrl.indexOf(";")), bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return createImageBitmap(new Blob([bytes], { type: mime }));
  }
  function makeTexture(gl, image, filter) {
    let tex = gl.createTexture();
    return gl.bindTexture(gl.TEXTURE_2D, tex), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE), gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE), gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image), tex;
  }
  async function buildOverlay(img, payload, token) {
    let [photoImg, depthImg, normalImg] = await Promise.all([
      loadImage(payload.photo.url),
      loadImage(payload.depth.url),
      payload.normal ? loadImage(payload.normal.url) : null
    ]);
    if (token !== activateToken || !img.isConnected) return;
    let host = document.createElement("div");
    host.setAttribute("data-page3d", "loading"), host.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .18s ease-out;";
    let radius = getComputedStyle(img).borderRadius;
    radius && radius !== "0px" && (host.style.borderRadius = radius);
    let canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;", host.appendChild(canvas), document.documentElement.appendChild(host);
    let gl = canvas.getContext("webgl2", {
      alpha: !0,
      antialias: !0,
      depth: !0,
      premultipliedAlpha: !0
    });
    if (!gl) {
      host.remove();
      return;
    }
    let program = gl.createProgram();
    if (gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VS)), gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FS)), gl.linkProgram(program), !gl.getProgramParameter(program, gl.LINK_STATUS))
      throw host.remove(), new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    let verts = new Float32Array(37249 * 2), vi = 0;
    for (let y = 0; y <= 192; y++)
      for (let x = 0; x <= 192; x++)
        verts[vi++] = x / 192, verts[vi++] = y / 192;
    let indices = new Uint32Array(36864 * 6), ii = 0;
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 192; x++) {
        let a = y * 193 + x, b = a + 1, c = a + 192 + 1, d = c + 1;
        indices[ii++] = a, indices[ii++] = c, indices[ii++] = b, indices[ii++] = b, indices[ii++] = c, indices[ii++] = d;
      }
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo), gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    let loc = gl.getAttribLocation(program, "aUv");
    gl.enableVertexAttribArray(loc), gl.vertexAttribPointer(loc, 2, gl.FLOAT, !1, 0, 0);
    let ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo), gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW), gl.activeTexture(gl.TEXTURE0), makeTexture(gl, photoImg, gl.LINEAR), gl.activeTexture(gl.TEXTURE1), makeTexture(gl, depthImg, gl.LINEAR);
    let lightable = !!normalImg;
    lightable && (gl.activeTexture(gl.TEXTURE2), makeTexture(gl, normalImg, gl.LINEAR), gl.uniform1i(gl.getUniformLocation(program, "uNormal"), 2)), gl.uniform1i(gl.getUniformLocation(program, "uPhoto"), 0), gl.uniform1i(gl.getUniformLocation(program, "uDepth"), 1);
    let uTanHalf = gl.getUniformLocation(program, "uTanHalf"), uRot = gl.getUniformLocation(program, "uRot"), uDispScale = gl.getUniformLocation(program, "uDispScale"), uUvRect = gl.getUniformLocation(program, "uUvRect"), uLight = gl.getUniformLocation(program, "uLight"), uLightOn = gl.getUniformLocation(program, "uLightOn");
    gl.enable(gl.DEPTH_TEST), gl.depthFunc(gl.LEQUAL), gl.clearColor(0, 0, 0, 0);
    let startedAt = performance.now(), rot = { yaw: 0, pitch: 0 }, light = 0, leaveAt = 0, shownLatency = !1;
    session = { img, host, canvas, gl, raf: 0 };
    let frame = () => {
      if (session?.host !== host) return;
      if (!img.isConnected) {
        teardown();
        return;
      }
      let { left, top, width, height, uv } = fitRect(img);
      if (width < 10 || height < 10) {
        teardown();
        return;
      }
      host.style.left = `${left}px`, host.style.top = `${top}px`, host.style.width = `${width}px`, host.style.height = `${height}px`;
      let dpr = Math.min(devicePixelRatio || 1, 2), pw = Math.round(width * dpr), ph = Math.round(height * dpr);
      (canvas.width !== pw || canvas.height !== ph) && (canvas.width = pw, canvas.height = ph);
      let inside = lastPointer.x >= left - 48 && lastPointer.x <= left + width + 48 && lastPointer.y >= top - 48 && lastPointer.y <= top + height + 48, now = performance.now();
      if (inside) leaveAt = 0;
      else if (!leaveAt) leaveAt = now;
      else if (now - leaveAt > 220) {
        teardown();
        return;
      }
      let yawT, pitchT;
      if (now - lastPointer.movedAt < 1300) {
        let nx = Math.max(-1, Math.min(1, (lastPointer.x - (left + width / 2)) / (width / 2))), ny = Math.max(-1, Math.min(1, (lastPointer.y - (top + height / 2)) / (height / 2)));
        yawT = nx * 0.08, pitchT = -ny * 0.05;
      } else {
        let t = now / 1e3;
        yawT = Math.sin(t * (Math.PI * 2) / 6) * 0.045, pitchT = Math.sin(t * (Math.PI * 2) / 3 + 1.3) * 0.02;
      }
      rot.yaw += (yawT - rot.yaw) * 0.12, rot.pitch += (pitchT - rot.pitch) * 0.12;
      let dispScale = 1 - (1 - Math.min(1, (now - startedAt) / 450)) ** 3;
      light += ((lightable && shiftDown ? 1 : 0) - light) * 0.16;
      let tanHalfX = 0.4663 * (width / height), lnx = Math.max(-1.2, Math.min(1.2, (lastPointer.x - left) / width * 2 - 1)), lny = Math.max(-1.2, Math.min(1.2, 1 - (lastPointer.y - top) / height * 2));
      if (gl.viewport(0, 0, pw, ph), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT), gl.uniform2f(uTanHalf, tanHalfX, 0.4663), gl.uniform2f(uRot, rot.yaw, rot.pitch), gl.uniform1f(uDispScale, dispScale), gl.uniform4f(uUvRect, uv.x, uv.y, uv.w, uv.h), gl.uniform3f(
        uLight,
        lnx / 1.06 * tanHalfX * 0.5,
        lny / 1.06 * 0.4663 * 0.5,
        -0.5
      ), gl.uniform1f(uLightOn, light < 4e-3 ? 0 : light), gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0), host.style.opacity !== "1" && (host.style.opacity = "1", host.dataset.page3d = "active"), !shownLatency && payload.stats) {
        shownLatency = !0;
        let env = payload.stats.backend === "webgpu" ? "WebGPU" : "WASM", hint = lightable ? " \xB7 hold \u21E7 for light" : "", b = pill(`MoGe-2 \xB7 ${payload.stats.inferMs} ms \xB7 ${env} \xB7 on-device${hint}`);
        b.style.position = "absolute", b.style.left = "10px", b.style.bottom = "10px", host.appendChild(b), setTimeout(() => {
          b.style.opacity = "0";
        }, 2800), setTimeout(() => b.remove(), 3200);
      }
      session.raf = requestAnimationFrame(frame);
    };
    frame();
  }
  chrome.storage.local.get("p3-enabled").then((v) => {
    enabled = v?.["p3-enabled"] ?? !0;
  }).catch(() => {
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    area === "local" && "p3-enabled" in changes && (enabled = changes["p3-enabled"].newValue ?? !0, enabled || teardown());
  });
})();
