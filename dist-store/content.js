(() => {
  // src/content.js
  var ADAPTERS = [
    { host: /(^|\.)chatgpt\.com$/, selector: '[data-message-author-role="assistant"]' },
    // claude.ai and gemini DOM shift often — selectors are best-effort, verify live.
    { host: /(^|\.)claude\.ai$/, selector: '[data-testid="assistant-message"], .font-claude-message' },
    { host: /(^|\.)gemini\.google\.com$/, selector: "message-content" },
    // dev: synthetic stream pages (tools/stream-test.html) use the ChatGPT shape
    { host: /^(127\.0\.0\.1|localhost)$/, selector: '[data-message-author-role="assistant"]' }
  ], adapter = ADAPTERS.find((a) => a.host.test(location.hostname)), AUTOREAD_KEY = `autoread:${location.hostname}`, BOUNDARY = /[.!?…。!?]["')\]]*\s/g, SCAN_DEBOUNCE_MS = 300, QUIET_FLUSH_MS = 2e3, autoRead = !1, observer = null, tracked = /* @__PURE__ */ new WeakMap(), lastStatus = null;
  function send(msg) {
    return chrome.runtime.sendMessage({ target: "bg", ...msg }).catch(() => null);
  }
  var port = null;
  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: "ui" });
    } catch {
      return;
    }
    port.onMessage.addListener((msg) => {
      msg?.type === "status" && (lastStatus = msg, updateHud());
    }), port.onDisconnect.addListener(() => {
      port = null, setTimeout(connectPort, 1e3);
    });
  }
  connectPort();
  function setAutoRead(on) {
    autoRead = on, chrome.storage.local.set({ [AUTOREAD_KEY]: on }).catch(() => {
    }), on && (startWatch(), send({ type: "preload" })), updateHud();
  }
  function startWatch() {
    if (!(observer || !adapter)) {
      for (let el of document.querySelectorAll(adapter.selector))
        tracked.set(el, { consumed: (el.innerText || "").length, timer: null });
      observer = new MutationObserver(scheduleScan), observer.observe(document.body, { childList: !0, subtree: !0, characterData: !0 });
    }
  }
  var scanScheduled = !1;
  function scheduleScan() {
    scanScheduled || (scanScheduled = !0, setTimeout(() => {
      scanScheduled = !1, scan();
    }, SCAN_DEBOUNCE_MS));
  }
  function scan() {
    if (!autoRead || !adapter) return;
    let els = document.querySelectorAll(adapter.selector);
    els.forEach((el, i) => {
      let st = tracked.get(el);
      st || (st = { consumed: i === els.length - 1 ? 0 : (el.innerText || "").length, timer: null }, tracked.set(el, st));
      let text = el.innerText || "";
      if (text.length <= st.consumed) return;
      let fresh = text.slice(st.consumed);
      BOUNDARY.lastIndex = 0;
      let lastEnd = -1;
      for (let m; (m = BOUNDARY.exec(fresh)) !== null; ) lastEnd = m.index + m[0].length;
      if (lastEnd > 0) {
        let out = fresh.slice(0, lastEnd).trim();
        st.consumed += lastEnd, out && send({ type: "speak", text: out });
      }
      clearTimeout(st.timer), st.timer = setTimeout(() => {
        let t = el.innerText || "";
        if (t.length > st.consumed) {
          let out = t.slice(st.consumed).trim();
          st.consumed = t.length, out && send({ type: "speak", text: out });
        }
      }, QUIET_FLUSH_MS);
    });
  }
  var hud = null;
  function ensureHud() {
    if (hud) return hud;
    let hostEl = document.createElement("div");
    hostEl.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483647;";
    let root = hostEl.attachShadow({ mode: "open" });
    return root.innerHTML = `
    <style>
      .pill { display:flex; align-items:center; gap:8px; font:12px/1.4 -apple-system, system-ui, sans-serif;
        background:rgba(20,20,24,.92); color:#e8e8ec; padding:8px 12px; border-radius:999px;
        box-shadow:0 4px 16px rgba(0,0,0,.35); }
      .dot { width:8px; height:8px; border-radius:50%; background:#7a7a85; flex:none; }
      .dot.ready { background:#3ecf6e; }
      .dot.busy { background:#f0b62f; }
      .dot.speaking { background:#4da3ff; animation:pulse 1s infinite; }
      .dot.error { background:#ff5d5d; }
      @keyframes pulse { 50% { opacity:.35; } }
      button { font:inherit; border:0; border-radius:999px; padding:2px 10px; cursor:pointer;
        background:#33333d; color:#e8e8ec; }
      button.on { background:#4da3ff; color:#0b0b10; }
      #stop { display:none; }
    </style>
    <div class="pill">
      <span class="dot" id="dot"></span><span id="label">voice</span>
      <button id="auto">Auto-read</button><button id="stop">Stop</button>
    </div>`, root.getElementById("auto").addEventListener("click", () => setAutoRead(!autoRead)), root.getElementById("stop").addEventListener("click", () => send({ type: "stop" })), document.documentElement.appendChild(hostEl), hud = {
      dot: root.getElementById("dot"),
      label: root.getElementById("label"),
      auto: root.getElementById("auto"),
      stop: root.getElementById("stop")
    }, hud;
  }
  function updateHud() {
    let h = ensureHud();
    h.auto.classList.toggle("on", autoRead);
    let s = lastStatus, dot = "idle", label = autoRead ? "voice armed" : "voice off";
    s && s.state !== "unloaded" && (s.state === "error" ? (dot = "error", label = `error \u2014 ${s.error ?? "see console"}`) : s.speaking ? (dot = "speaking", label = s.stats ? `speaking \xB7 RTF ${s.stats.rtf} \xB7 ${s.env}` : "speaking\u2026") : s.state === "ready" ? (dot = "ready", label = `ready \xB7 ${s.env}`) : s.state === "downloading" ? (dot = "busy", label = `downloading model (one-time)\u2026 ${s.downloadedMB ?? 0} MB`) : (dot = "busy", label = `${s.state}\u2026`)), h.dot.className = `dot ${dot}`, h.label.textContent = label, h.stop.style.display = s?.speaking ? "inline-block" : "none";
  }
  chrome.storage.local.get(AUTOREAD_KEY).then((v) => {
    v?.[AUTOREAD_KEY] ? setAutoRead(!0) : updateHud();
  }).catch(() => updateHud());
})();
