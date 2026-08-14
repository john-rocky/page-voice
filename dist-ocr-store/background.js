(() => {
  // src-ocr/background.js
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "select-image-text",
      title: "Select text in this image",
      contexts: ["image"]
    });
  });
  async function ensureOffscreen() {
    if (!await chrome.offscreen.hasDocument())
      try {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["BLOBS"],
          justification: "Runs the local OCR models on image bytes; model files are held as blobs in the Cache API."
        });
      } catch (err) {
        if (!String(err).toLowerCase().includes("single offscreen")) throw err;
      }
  }
  async function sendToOffscreen(msg) {
    await ensureOffscreen();
    let lastErr = null;
    for (let i = 0; i < 4; i++)
      try {
        return await chrome.runtime.sendMessage({ target: "offscreen", ...msg });
      } catch (err) {
        lastErr = err, await new Promise((r) => setTimeout(r, 150 * (i + 1)));
      }
    return console.warn("offscreen unreachable:", lastErr), null;
  }
  function bytesToBase64(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 32768)
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(out);
  }
  async function fetchImageB64(url) {
    let response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let bytes = new Uint8Array(await response.arrayBuffer());
    return {
      ok: !0,
      b64: bytesToBase64(bytes),
      contentType: response.headers.get("content-type") ?? ""
    };
  }
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    info.menuItemId === "select-image-text" && tab?.id && info.srcUrl && chrome.tabs.sendMessage(tab.id, { type: "activate-ocr", srcUrl: info.srcUrl }).catch(() => {
    });
  });
  chrome.commands?.onCommand.addListener(async (command) => {
    if (command !== "toggle-find") return;
    let [tab] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
    tab?.id && chrome.tabs.sendMessage(tab.id, { type: "toggle-find" }).catch(() => {
    });
  });
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!(!msg || msg.target !== "bg"))
      switch (msg.type) {
        case "ocr":
          return sendToOffscreen({ type: "ocr", url: msg.url, background: msg.background }).then((r) => sendResponse(r ?? { ok: !1, error: "engine unreachable" })), !0;
        case "fetch-image":
          return fetchImageB64(msg.url).then(sendResponse).catch((err) => sendResponse({ ok: !1, error: String(err?.message ?? err) })), !0;
        case "preload":
          return sendToOffscreen({ type: "status" }).then((s) => sendResponse(s ?? { state: "unloaded" })), !0;
        case "status":
          return (async () => {
            if (!await chrome.offscreen.hasDocument()) {
              sendResponse({ state: "unloaded" });
              return;
            }
            try {
              sendResponse(await chrome.runtime.sendMessage({ target: "offscreen", type: "status" }));
            } catch {
              sendResponse({ state: "unloaded" });
            }
          })(), !0;
      }
  });
})();
