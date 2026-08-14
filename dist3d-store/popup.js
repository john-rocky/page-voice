(() => {
  // src3d/popup.js
  var dot = document.getElementById("dot"), detail = document.getElementById("detail"), env = document.getElementById("env"), toggleBtn = document.getElementById("toggle"), loadBtn = document.getElementById("load"), enabled = !0;
  function send(msg) {
    return chrome.runtime.sendMessage({ target: "bg", ...msg }).catch(() => null);
  }
  function render(s) {
    if (toggleBtn.classList.toggle("on", enabled), toggleBtn.textContent = enabled ? "Enabled" : "Disabled", !s || s.state === "unloaded") {
      dot.className = "dot", detail.textContent = "Engine not loaded. Hover an image on any page, or press Load model.", env.textContent = "";
      return;
    }
    if (env.textContent = s.env ?? "", s.state === "error")
      dot.className = "dot error", detail.textContent = `Error: ${s.error}`;
    else if (s.state === "ready") {
      dot.className = "dot ready";
      let st = s.stats;
      detail.textContent = st ? `Ready \xB7 last depth ${st.inferMs} ms (fetch ${st.fetchMs} ms via ${st.via}) \xB7 ${s.runs} runs` : "Ready \u2014 hover an image on any page.";
    } else s.state === "downloading" ? (dot.className = "dot busy", detail.textContent = `Downloading MoGe-2 (one-time)\u2026 ${s.downloadedMB ?? 0} MB`) : (dot.className = "dot busy", detail.textContent = `${s.state}\u2026`);
  }
  toggleBtn.addEventListener("click", async () => {
    enabled = !enabled, await chrome.storage.local.set({ "p3-enabled": enabled }).catch(() => {
    }), render(await send({ type: "status" }));
  });
  loadBtn.addEventListener("click", async () => {
    render(await send({ type: "preload" }));
  });
  chrome.runtime.onMessage.addListener((msg) => {
    msg?.target === "ui" && msg.type === "status" && render(msg);
  });
  (async () => (enabled = (await chrome.storage.local.get("p3-enabled").catch(() => null))?.["p3-enabled"] ?? !0, render(await send({ type: "status" }))))();
})();
