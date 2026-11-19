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
await ev(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Музыка')).click(); true`);
await new Promise(r => setTimeout(r, 900));
const info = await ev(`(() => ({
  title: document.querySelector('.music-stage__title')?.textContent,
  transport: Array.from(document.querySelectorAll('.music-transport .ui-button')).map(b => b.textContent.trim()),
  rules: Array.from(document.querySelectorAll('.rules-row__title')).map(x => x.textContent.trim()),
  queueStates: Array.from(document.querySelectorAll('.queue-state')).slice(0,5).map(x => x.textContent),
  hasVinyl: !!document.querySelector('.music-stage__vinyl')
}))()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/music-stage-app.png', Buffer.from(shot.data, 'base64'));
await ev(`Array.from(document.querySelectorAll('.music-transport .ui-button')).find(b => b.textContent.includes('Пропустить')).click(); true`);
await new Promise(r => setTimeout(r, 500));
const skip = await ev(`({ open: !!document.querySelector('.skip-reasons'), reasons: Array.from(document.querySelectorAll('.skip-reason strong')).map(x=>x.textContent) })`);
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/music-skip-dialog-app.png', Buffer.from(shot2.data, 'base64'));
console.log(JSON.stringify({ info, skip }, null, 2));
ws.close(); process.exit(0);
