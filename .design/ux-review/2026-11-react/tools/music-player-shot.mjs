import fs from 'node:fs';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Runtime.enable'); await send('Page.enable');
for (let i = 0; i < 50; i++) { if (await evaluate(`!!document.querySelector('.nav-item')`)) break; await new Promise(r => setTimeout(r, 250)); }
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Музыка')).click(); true`);
await new Promise(r => setTimeout(r, 1200));
const info = await evaluate(`(() => {
  const controls = document.querySelectorAll('.player__controls .ui-button');
  const volume = document.querySelector('.player__volume input');
  const add = document.querySelector('.queue-input input');
  return {
    current: document.querySelector('.player__track')?.textContent || '',
    controls: Array.from(controls).map(b => ({ w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), label: b.getAttribute('aria-label') || b.textContent.trim() })),
    volume: volume ? { value: volume.value, label: volume.getAttribute('aria-label') } : null,
    addPlaceholder: add?.placeholder || ''
  };
})()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/ux-review/2026-11-react/shots4/music-player.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(info, null, 2));
ws.close(); process.exit(0);
