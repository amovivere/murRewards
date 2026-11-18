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
await new Promise(r => setTimeout(r, 800));
await evaluate(`Array.from(document.querySelectorAll('.ui-button')).find(b => b.textContent.includes('Настроить музыку')).click(); true`);
await new Promise(r => setTimeout(r, 500));
const info = await evaluate(`(() => ({
  title: document.querySelector('.ui-modal__title')?.textContent || '',
  cookies: Array.from(document.querySelectorAll('.ui-modal input')).some(i => (i.placeholder||'').includes('cookies.txt')),
  controls: Array.from(document.querySelectorAll('.ui-modal .ui-input')).map(i => i.placeholder || i.value).slice(-3)
}))()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/ux-review/2026-11-react/shots4/music-settings-cookies.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(info, null, 2));
ws.close(); process.exit(0);
