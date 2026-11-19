import fs from 'node:fs';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Runtime.enable'); await send('Page.enable');
await new Promise(r => setTimeout(r, 1100));
await ev(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Музыка')).click(); true`);
await new Promise(r => setTimeout(r, 900));
const info = await ev(`(() => ({
  scenes: Array.from(document.querySelectorAll('.scene-chip')).map(b => b.textContent.trim()),
  stats: Array.from(document.querySelectorAll('.music-stat')).map(x => x.textContent.trim()),
  queueRight: (() => { const s=document.querySelector('.music-stage')?.getBoundingClientRect(); const q=document.querySelector('.music-layout .two-col > .ui-panel')?.getBoundingClientRect(); return s&&q ? q.left >= s.right : false; })()
}))()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/music-scenes-autodj.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(info, null, 2));
ws.close(); process.exit(0);
