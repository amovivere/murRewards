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
await new Promise(r => setTimeout(r, 1200));
await ev(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await new Promise(r => setTimeout(r, 700));
const tabs = await ev(`Array.from(document.querySelectorAll('.overlay-tabs button')).map(b => b.textContent.replace(/\s+/g,' ').trim())`);
await ev(`Array.from(document.querySelectorAll('.overlay-tabs button')).find(b => b.textContent.includes('Картинки')).click(); true`);
await new Promise(r => setTimeout(r, 900));
const info = await ev(`(() => ({
  active: document.querySelector('.overlay-tabs button.is-active')?.textContent.replace(/\s+/g,' ').trim(),
  url: document.querySelector('.overlay-images-tab code')?.textContent,
  iframe: document.querySelector('.overlay-images-tab iframe')?.getAttribute('src'),
  empty: document.querySelector('.overlay-images-tab .empty-state__title')?.textContent,
  previewVisible: Boolean(document.querySelector('.overlay-images-tab .overlay-preview__frame-wrap--image'))
}))()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/overlay-images-tab.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({tabs, info}, null, 2));
ws.close(); process.exit(0);
