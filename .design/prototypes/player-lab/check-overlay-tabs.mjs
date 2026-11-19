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
await new Promise(r => setTimeout(r, 1000));
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await new Promise(r => setTimeout(r, 700));
const info = await evaluate(`(() => ({
  title: document.querySelector('.page-title')?.textContent,
  tabs: Array.from(document.querySelectorAll('.overlay-tabs button')).map(b => ({ text: b.textContent.trim(), active: b.classList.contains('is-active') })),
  activeTab: document.querySelector('.overlay-tabs button.is-active')?.textContent.trim()
}))()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/overlay-tabs-chat.png', Buffer.from(shot.data, 'base64'));
await evaluate(`Array.from(document.querySelectorAll('.overlay-tabs button')).find(b => b.textContent.includes('Музыка')).click(); true`);
await new Promise(r => setTimeout(r, 700));
const info2 = await evaluate(`(() => ({
  tabs: Array.from(document.querySelectorAll('.overlay-tabs button')).map(b => ({ text: b.textContent.trim(), active: b.classList.contains('is-active') })),
  active: document.querySelector('.overlay-tabs button.is-active')?.textContent.trim(),
  url: document.querySelector('.overlay-music-url code')?.textContent || '',
  hasSave: Array.from(document.querySelectorAll('.overlay-music-actions .ui-button')).some(b => b.textContent.includes('Применить'))
}))()`);
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/overlay-tabs-music.png', Buffer.from(shot2.data, 'base64'));
console.log(JSON.stringify({ info, info2 }, null, 2));
ws.close(); process.exit(0);
