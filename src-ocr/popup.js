/** Popup: engine status (state, env, last OCR latency). */

const dot = document.getElementById('dot');
const detail = document.getElementById('detail');
const env = document.getElementById('env');
const loadBtn = document.getElementById('load');

function send(msg) {
  return chrome.runtime.sendMessage({ target: 'bg', ...msg }).catch(() => null);
}

function render(s) {
  if (!s || s.state === 'unloaded') {
    dot.className = 'dot';
    detail.textContent =
      'Engine not loaded. Right-click an image → "Select text in this image", or press Load models.';
    env.textContent = '';
    return;
  }
  env.textContent = s.env ?? '';
  if (s.state === 'error') {
    dot.className = 'dot error';
    detail.textContent = `Error: ${s.error}`;
  } else if (s.state === 'ready') {
    dot.className = 'dot ready';
    const st = s.stats;
    detail.textContent = st
      ? `Ready · last read ${st.lineCount} lines in det ${st.detMs} + rec ${st.recMs} ms · ${s.runs} runs`
      : 'Ready — right-click an image → "Select text in this image".';
  } else if (s.state === 'downloading') {
    dot.className = 'dot busy';
    detail.textContent = `Downloading PP-OCRv5 (one-time)… ${s.downloadedMB ?? 0} MB`;
  } else {
    dot.className = 'dot busy';
    detail.textContent = `${s.state}…`;
  }
}

loadBtn.addEventListener('click', async () => {
  render(await send({ type: 'preload' }));
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target === 'ui' && msg.type === 'status') render(msg);
});

(async () => {
  render(await send({ type: 'status' }));
})();
