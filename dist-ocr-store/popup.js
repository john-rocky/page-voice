(() => {
  // src-ocr/popup.js
  var dot = document.getElementById("dot"), detail = document.getElementById("detail"), env = document.getElementById("env"), loadBtn = document.getElementById("load");
  function send(msg) {
    return chrome.runtime.sendMessage({ target: "bg", ...msg }).catch(() => null);
  }
  function render(s) {
    if (!s || s.state === "unloaded") {
      dot.className = "dot", detail.textContent = 'Engine not loaded. Right-click an image \u2192 "Select text in this image", or press Load models.', env.textContent = "";
      return;
    }
    if (env.textContent = s.env ?? "", s.state === "error")
      dot.className = "dot error", detail.textContent = `Error: ${s.error}`;
    else if (s.state === "ready") {
      dot.className = "dot ready";
      let st = s.stats;
      detail.textContent = st ? `Ready \xB7 last read ${st.lineCount} lines in det ${st.detMs} + rec ${st.recMs} ms \xB7 ${s.runs} runs` : 'Ready \u2014 right-click an image \u2192 "Select text in this image".';
    } else s.state === "downloading" ? (dot.className = "dot busy", detail.textContent = `Downloading PP-OCRv5 (one-time)\u2026 ${s.downloadedMB ?? 0} MB`) : (dot.className = "dot busy", detail.textContent = `${s.state}\u2026`);
  }
  loadBtn.addEventListener("click", async () => {
    render(await send({ type: "preload" }));
  });
  chrome.runtime.onMessage.addListener((msg) => {
    msg?.target === "ui" && msg.type === "status" && render(msg);
  });
  (async () => render(await send({ type: "status" })))();
})();
