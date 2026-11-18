import fs from 'node:fs';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
await send('Runtime.enable'); await send('Page.enable');
await evaluate(`window.__TAURI_INTERNALS__.invoke('open_react_preview').catch(() => {}); true`);
await new Promise(r => setTimeout(r, 2200));
for (let i = 0; i < 30; i++) { if (await evaluate(`document.querySelectorAll('.nav-item').length`)) break; await new Promise(r => setTimeout(r, 250)); }
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Настройки')).click(); true`);
await new Promise(r => setTimeout(r, 1500));
const info = await evaluate(`(async () => {
  const state = await window.__TAURI_INTERNALS__.invoke('get_state');
  return {
    healthRows: Array.from(document.querySelectorAll('.health-row')).map(r => r.textContent.trim()),
    backendHealth: state.health.map(h => h.title + ':' + h.state + ':' + h.detail),
    accent: document.querySelector('.url-code')?.textContent || '',
    backendAccent: state.accent,
    audio: state.audio_device,
    login: state.login,
    volume: state.volume
  };
})()`);
console.log(JSON.stringify(info, null, 2));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/overlay-port/react-settings-real.png', Buffer.from(shot.data, 'base64'));
ws.close(); process.exit(0);
