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
for (let i = 0; i < 30; i++) { if (await evaluate(`!!document.querySelector('.app-shell')`)) break; await new Promise(r => setTimeout(r, 250)); }
await new Promise(r => setTimeout(r, 1200));
console.log(JSON.stringify(await evaluate(`({ title: document.title, url: location.href, nav: Array.from(document.querySelectorAll('.nav-item')).map(b => b.textContent.trim()), back: !!document.querySelector('.sidebar__back'), size: [innerWidth, innerHeight] })`), null, 2));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/overlay-port/react-default-app.png', Buffer.from(shot.data, 'base64'));
ws.close(); process.exit(0);
