(() => {
  // src-ocr/ocr-pipeline.js
  var CJK_EDGE = /[぀-ヿ㐀-䶿一-鿿。、!?」』)]$|^[぀-ヿ㐀-䶿一-鿿「『(]/;
  function groupLines(lines) {
    let out = [], prev = null;
    for (let line of lines) {
      if (line.group != null && line.group === prev && out.length) {
        let g = out[out.length - 1], sep = CJK_EDGE.test(g.text.slice(-1)) || CJK_EDGE.test(line.text[0]) ? "" : " ";
        g.text += sep + line.text, g.pieces.push(line);
      } else
        out.push({ text: line.text, pieces: [line] });
      prev = line.group ?? null;
    }
    return out;
  }

  // src-ocr/find.js
  var MIN_W = 120, MIN_H = 80, SCAN_MARGIN = 600, SCAN_DEBOUNCE_MS = 350, MAX_IMAGES = 60, index = /* @__PURE__ */ new Map(), inFlight = /* @__PURE__ */ new Set(), queue = [], draining = !1, ui = null, matches = [], current = -1, deps = null;
  function initFind(dependencies) {
    deps = dependencies, window.addEventListener("scroll", scheduleScan, { passive: !0 }), window.addEventListener("resize", () => {
      scheduleScan(), repaint();
    }, { passive: !0 });
  }
  function eligible(img) {
    if (!(img instanceof HTMLImageElement) || !img.complete || !img.naturalWidth) return !1;
    let r = img.getBoundingClientRect();
    return r.width < MIN_W || r.height < MIN_H ? !1 : r.bottom > -SCAN_MARGIN && r.top < window.innerHeight + SCAN_MARGIN;
  }
  var scanTimer = null;
  function scheduleScan() {
    clearTimeout(scanTimer), scanTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  }
  function scan() {
    if (!(index.size >= MAX_IMAGES)) {
      for (let img of document.images) {
        if (!eligible(img)) continue;
        let url = deps.sourceFor(img);
        !url || index.has(url) || inFlight.has(url) || queue.includes(url) || queue.push(url);
      }
      drain();
    }
  }
  async function drain() {
    if (!draining) {
      for (draining = !0; queue.length; ) {
        let url = queue.shift();
        if (index.has(url) || inFlight.has(url)) continue;
        inFlight.add(url), updateProgress();
        let payload = await deps.send({ type: "ocr", url, background: !0 });
        inFlight.delete(url), payload?.ok && (index.set(url, { groups: groupLines(payload.lines), natural: payload.natural }), ui && run(ui.input.value)), updateProgress(), await new Promise((r) => setTimeout(r, 0));
      }
      draining = !1;
    }
  }
  function indexedCount() {
    let n = 0;
    for (let { groups } of index.values()) groups.length && n++;
    return n;
  }
  function liveImages() {
    let byUrl = /* @__PURE__ */ new Map();
    for (let img of document.images) {
      if (!img.complete || !img.naturalWidth) continue;
      let url = deps.sourceFor(img);
      url && !byUrl.has(url) && byUrl.set(url, img);
    }
    return byUrl;
  }
  function run(query) {
    matches = [];
    let q = query.trim().toLowerCase();
    if (q) {
      let byUrl = liveImages();
      for (let [url, entry] of index) {
        let img = byUrl.get(url);
        if (img)
          for (let group of entry.groups)
            group.text.toLowerCase().includes(q) && matches.push({ img, url, group, text: group.text });
      }
      matches.sort((a, b) => {
        let ra = a.img.getBoundingClientRect(), rb = b.img.getBoundingClientRect();
        return ra.top + window.scrollY - (rb.top + window.scrollY) || a.group.pieces[0].y - b.group.pieces[0].y;
      });
    }
    current = matches.length ? 0 : -1, repaint(), updateCount();
  }
  function repaint() {
    document.querySelectorAll("[data-pagetext-hit]").forEach((el) => el.remove()), ui && matches.forEach((m, i) => {
      let { left, top, width, height, uv } = deps.fitRect(m.img), on = i === current, rects = [];
      for (let piece of m.group.pieces) {
        let r = {
          x: (piece.x - uv.x) / uv.w * width,
          y: (piece.y - uv.y) / uv.h * height,
          w: piece.w / uv.w * width,
          h: piece.h / uv.h * height
        }, row = rects.find((o) => Math.abs(o.y - r.y) < o.h * 0.6);
        if (row) {
          let right = Math.max(row.x + row.w, r.x + r.w), bottom = Math.max(row.y + row.h, r.y + r.h);
          row.x = Math.min(row.x, r.x), row.y = Math.min(row.y, r.y), row.w = right - row.x, row.h = bottom - row.y;
        } else
          rects.push(r);
      }
      for (let r of rects) {
        if (r.x + r.w < 0 || r.y + r.h < 0 || r.x > width || r.y > height) continue;
        let box = document.createElement("div");
        box.setAttribute("data-pagetext-hit", ""), box.style.cssText = `position:absolute;left:${left + window.scrollX + r.x}px;top:${top + window.scrollY + r.y}px;width:${r.w}px;height:${r.h}px;z-index:2147483645;pointer-events:none;border-radius:3px;background:${on ? "rgba(255,196,0,.42)" : "rgba(77,163,255,.28)"};outline:1.5px solid ${on ? "rgba(255,196,0,.95)" : "rgba(77,163,255,.6)"};transition:background .15s,outline-color .15s;`, document.body.appendChild(box);
      }
    });
  }
  function step(delta) {
    if (!matches.length) return;
    current = (current + delta + matches.length) % matches.length;
    let m = matches[current], r = m.img.getBoundingClientRect();
    (r.top < 80 || r.bottom > window.innerHeight - 80) && (m.img.scrollIntoView({ block: "center", behavior: "smooth" }), setTimeout(repaint, 400)), repaint(), updateCount();
  }
  function updateCount() {
    if (!ui) return;
    let imgs = new Set(matches.map((m) => m.url)).size;
    ui.count.textContent = matches.length ? `${current + 1}/${matches.length} \xB7 ${imgs} image${imgs > 1 ? "s" : ""}` : ui.input.value.trim() ? "no matches" : "";
  }
  function updateProgress() {
    if (!ui) return;
    let pending = queue.length + inFlight.size;
    ui.progress.textContent = pending ? `reading ${pending} more\u2026` : `${indexedCount()} image${indexedCount() === 1 ? "" : "s"} indexed`;
  }
  function toggleFind() {
    if (ui) {
      closeFind();
      return;
    }
    let host = document.createElement("div");
    host.setAttribute("data-pagetext-find", ""), host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:rgba(18,18,22,.95);box-shadow:0 6px 24px rgba(0,0,0,.4);font:13px/1.3 -apple-system,system-ui,sans-serif;color:#e8e8ec;";
    let input = document.createElement("input");
    input.type = "text", input.placeholder = "Find in images\u2026", input.style.cssText = "border:0;outline:0;background:transparent;color:#e8e8ec;font:inherit;width:190px;";
    let count = document.createElement("span");
    count.style.cssText = "color:#9a9aa5;font-size:12px;min-width:96px;text-align:right;";
    let progress = document.createElement("span");
    progress.style.cssText = "color:#6f6f7a;font-size:11px;border-left:1px solid #33333c;padding-left:10px;";
    let close = document.createElement("button");
    close.textContent = "\u2715", close.style.cssText = "border:0;background:transparent;color:#9a9aa5;font:inherit;cursor:pointer;padding:0 2px;", close.addEventListener("click", closeFind), host.append(input, count, progress, close), document.documentElement.appendChild(host), ui = { host, input, count, progress }, input.addEventListener("input", () => run(input.value)), input.addEventListener("keydown", (e) => {
      e.key === "Enter" && (e.preventDefault(), step(e.shiftKey ? -1 : 1)), e.key === "Escape" && (e.preventDefault(), closeFind());
    }), input.focus(), updateProgress(), scan();
  }
  function closeFind() {
    document.querySelectorAll("[data-pagetext-hit]").forEach((el) => el.remove()), ui?.host.remove(), ui = null, matches = [], current = -1;
  }

  // src-ocr/content.js
  var FLASH_MS = 900, CACHE_ENTRIES = 12, session = null, activateToken = 0, resultCache = /* @__PURE__ */ new Map();
  function send(msg) {
    return chrome.runtime.sendMessage({ target: "bg", ...msg }).catch(() => null);
  }
  function sourceFor(img) {
    let src = img.currentSrc || img.src;
    if (!src) return null;
    try {
      let u = new URL(src);
      u.hostname === "pbs.twimg.com" && u.pathname.startsWith("/media/") && ["small", "medium", "900x900", "360x360"].includes(u.searchParams.get("name")) && (u.searchParams.set("name", "large"), src = u.toString());
    } catch {
    }
    if (!src.startsWith("blob:")) return src;
    try {
      let c = document.createElement("canvas");
      return c.width = img.naturalWidth, c.height = img.naturalHeight, c.getContext("2d").drawImage(img, 0, 0), c.toDataURL("image/png");
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
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "toggle-find") {
      toggleFind();
      return;
    }
    if (msg?.type === "activate-ocr" && msg.srcUrl) {
      let img = [...document.images].find(
        (i) => i.currentSrc === msg.srcUrl || i.src === msg.srcUrl
      );
      img && activate(img);
    }
  });
  async function activate(img) {
    let source = sourceFor(img);
    if (!source) return;
    let token = ++activateToken;
    teardown();
    let badge = showBadge(img, "reading\u2026"), poll = setInterval(async () => {
      let s = await send({ type: "status" });
      !s || token !== activateToken || (s.state === "downloading" ? badge.set(`OCR models ${s.downloadedMB ?? 0} MB\u2026`) : s.state === "compiling" ? badge.set("compiling\u2026") : s.state === "ready" && badge.set("reading\u2026"));
    }, 900), payload = resultCache.get(source);
    if (payload || (payload = await send({ type: "ocr", url: source }), payload?.ok && (resultCache.set(source, payload), resultCache.size > CACHE_ENTRIES && resultCache.delete(resultCache.keys().next().value))), clearInterval(poll), badge.remove(), token === activateToken && img.isConnected) {
      if (!payload?.ok) {
        flashMessage(img, payload?.error ? `OCR failed: ${payload.error}` : "OCR failed");
        return;
      }
      if (!payload.lines.length) {
        flashMessage(img, "no text found in this image");
        return;
      }
      try {
        buildOverlay(img, payload);
      } catch (err) {
        console.warn("[pagetext] overlay failed:", err);
      }
    }
  }
  function teardown() {
    let s = session;
    s && (session = null, s.host.remove(), window.removeEventListener("resize", s.onResize), document.removeEventListener("pointerdown", s.onPointerDown, !0));
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
  function flashMessage(img, text) {
    let badge = showBadge(img, text);
    setTimeout(() => badge.remove(), 1800);
  }
  var JA_RE = /[぀-ヿ㐀-䶿一-鿿]/;
  function joinLines(lines) {
    return groupLines(lines).map((g) => g.text).join(`
`);
  }
  function buildOverlay(img, payload) {
    let { left, top, width, height, uv } = fitRect(img), host = document.createElement("div");
    host.setAttribute("data-pagetext", ""), host.style.cssText = `position:absolute;left:${left + window.scrollX}px;top:${top + window.scrollY}px;width:${width}px;height:${height}px;z-index:2147483646;overflow:hidden;cursor:text;user-select:text;-webkit-user-select:text;`;
    let style = document.createElement("style");
    style.textContent = `[data-pagetext] span::selection { background: rgba(77,163,255,.45); color: transparent; }[data-pagetext] span { color: transparent; position: absolute; white-space: pre; transform-origin: 0 50%; pointer-events: auto; caret-color: transparent; }[data-pagetext] .pt-box { position: absolute; border-radius: 3px; pointer-events: none; background: rgba(77,163,255,.18); outline: 1px solid rgba(77,163,255,.55); transition: opacity .5s ease ${FLASH_MS}ms; }`, host.appendChild(style), document.body.appendChild(host);
    let px = (line) => ({
      left: (line.x - uv.x) / uv.w * width,
      top: (line.y - uv.y) / uv.h * height,
      w: line.w / uv.w * width,
      h: line.h / uv.h * height
    }), measurer = document.createElement("span");
    measurer.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;", host.appendChild(measurer);
    for (let line of payload.lines) {
      let r = px(line);
      if (r.left + r.w < 0 || r.top + r.h < 0 || r.left > width || r.top > height) continue;
      let box = document.createElement("div");
      box.className = "pt-box", box.style.cssText += `left:${r.left}px;top:${r.top}px;width:${r.w}px;height:${r.h}px;`, host.appendChild(box);
      let span = document.createElement("span"), fontPx = Math.max(6, r.h * 0.82), family = JA_RE.test(line.text) ? '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif' : '-apple-system,"Helvetica Neue",Arial,sans-serif';
      span.textContent = line.text, span.style.font = `${fontPx}px/1 ${family}`, span.style.left = `${r.left}px`, span.style.top = `${r.top + r.h / 2 - fontPx / 2}px`, measurer.style.font = span.style.font, measurer.textContent = line.text;
      let natW = measurer.getBoundingClientRect().width || 1;
      span.style.transform = `scaleX(${r.w / natW})`, host.appendChild(span);
    }
    measurer.remove();
    let bar = document.createElement("div");
    bar.style.cssText = "position:absolute;right:6px;top:6px;display:flex;gap:6px;z-index:1;font:11px/1 -apple-system,system-ui,sans-serif;user-select:none;-webkit-user-select:none;";
    let mkBtn = (label) => {
      let b = document.createElement("button");
      return b.textContent = label, b.style.cssText = "border:0;border-radius:999px;padding:6px 10px;cursor:pointer;font:inherit;background:rgba(20,20,24,.88);color:#e8e8ec;box-shadow:0 2px 10px rgba(0,0,0,.35);", b;
    }, copyBtn = mkBtn("Copy all");
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      let text = joinLines(payload.lines);
      try {
        await navigator.clipboard.writeText(text), copyBtn.textContent = "Copied \u2713", setTimeout(() => {
          copyBtn.textContent = "Copy all";
        }, 1200);
      } catch {
        copyBtn.textContent = "Copy failed";
      }
    });
    let closeBtn = mkBtn("\u2715");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation(), teardown();
    }), bar.append(copyBtn, closeBtn), host.appendChild(bar), requestAnimationFrame(() => {
      for (let el of host.querySelectorAll(".pt-box")) el.style.opacity = "0";
    });
    let onResize = () => teardown(), onPointerDown = (e) => {
      host.contains(e.target) || teardown();
    };
    window.addEventListener("resize", onResize), document.addEventListener("pointerdown", onPointerDown, !0), session = { host, img, onResize, onPointerDown };
  }
  window.addEventListener("keydown", (event) => {
    event.key === "Escape" && teardown();
  }, !0);
  initFind({ send, sourceFor, fitRect });
  window.addEventListener("keydown", (event) => {
    event.altKey && event.shiftKey && (event.key === "F" || event.key === "f") && (event.preventDefault(), toggleFind());
  }, !0);
})();
