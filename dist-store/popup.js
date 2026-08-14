(() => {
  // src/popup.js
  var TEST_SENTENCE = "This page can talk now. Everything you hear is generated locally, on this computer, and the text never leaves your device.", dot = document.getElementById("dot"), label = document.getElementById("label"), detail = document.getElementById("detail");
  function send(msg) {
    return chrome.runtime.sendMessage({ target: "bg", ...msg }).catch(() => null);
  }
  function render(s) {
    if (!s) return;
    let cls = "idle", text;
    s.state === "unloaded" ? text = "idle \u2014 model not loaded yet" : s.state === "error" ? (cls = "error", text = `error \u2014 ${s.error ?? "see offscreen console"}`) : s.speaking ? (cls = "speaking", text = `speaking${s.queued ? ` (+${s.queued} queued)` : ""}`) : s.state === "ready" ? (cls = "ready", text = "ready") : s.state === "downloading" ? (cls = "busy", text = `downloading model (one-time)\u2026 ${s.downloadedMB ?? 0} MB`) : (cls = "busy", text = `${s.state}\u2026`), dot.className = `dot ${cls}`, label.textContent = text;
    let bits = [];
    s.env && bits.push(s.env), s.flags && (bits.push(`webgpu ${s.flags.webgpu ? "yes" : "no"}`), bits.push(`threads ${s.flags.threads ? "yes" : "no"}`), bits.push(`jspi ${s.flags.jspi ? "yes" : "no"}`)), s.stats && bits.push(`RTF ${s.stats.rtf}`), detail.textContent = bits.join(" \xB7 ");
  }
  async function refresh() {
    render(await send({ type: "status" }));
  }
  chrome.runtime.onMessage.addListener((msg) => {
    msg?.target === "ui" && msg.type === "status" && render(msg);
  });
  document.getElementById("read").addEventListener("click", () => send({ type: "read-active" }));
  document.getElementById("stop").addEventListener("click", () => send({ type: "stop" }));
  document.getElementById("test").addEventListener("click", () => send({ type: "speak", text: TEST_SENTENCE }));
  document.getElementById("load").addEventListener("click", async () => {
    render(await send({ type: "preload" }));
  });
  refresh();
  setInterval(refresh, 1e3);
})();
