(() => {
  // src/background.js
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "read-selection",
      title: "Read aloud",
      contexts: ["selection"]
    });
  });
  async function ensureOffscreen() {
    if (!await chrome.offscreen.hasDocument())
      try {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["AUDIO_PLAYBACK", "BLOBS"],
          justification: "Runs the local TTS model and plays the synthesized speech; model files are held as blobs in the Cache API."
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
  async function stopSpeaking() {
    if (await chrome.offscreen.hasDocument())
      try {
        await chrome.runtime.sendMessage({ target: "offscreen", type: "stop" });
      } catch {
      }
  }
  async function getSelectionText(tabId, fallback) {
    try {
      let [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => String(getSelection())
      }), text = res?.result?.trim();
      if (text) return text;
    } catch {
    }
    return (fallback ?? "").trim();
  }
  async function readSelection(tabId, fallback) {
    let text = await getSelectionText(tabId, fallback);
    text && await sendToOffscreen({ type: "speak", text });
  }
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    info.menuItemId === "read-selection" && tab?.id && readSelection(tab.id, info.selectionText);
  });
  chrome.commands.onCommand.addListener((command, tab) => {
    command === "read-selection" && tab?.id ? readSelection(tab.id) : command === "stop-speaking" && stopSpeaking();
  });
  var uiPorts = /* @__PURE__ */ new Set();
  chrome.runtime.onConnect.addListener((port) => {
    port.name === "ui" && (uiPorts.add(port), port.onDisconnect.addListener(() => uiPorts.delete(port)));
  });
  function relayToContent(msg) {
    for (let port of uiPorts)
      try {
        port.postMessage(msg);
      } catch {
      }
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg) {
      if (msg.target === "ui" && sender.url?.includes("offscreen.html")) {
        relayToContent(msg);
        return;
      }
      if (msg.target === "bg")
        switch (msg.type) {
          case "speak":
            return sendToOffscreen({ type: "speak", text: msg.text }).then(() => sendResponse({ ok: !0 })), !0;
          case "stop":
            return stopSpeaking().then(() => sendResponse({ ok: !0 })), !0;
          case "read-active":
            return chrome.tabs.query({ active: !0, currentWindow: !0 }).then(([tab]) => {
              tab?.id && readSelection(tab.id), sendResponse({ ok: !0 });
            }), !0;
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
    }
  });
})();
