import fs from 'node:fs';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((target) => target.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0; const pending = new Map();
ws.onmessage = (event) => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
const send = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
await send('Runtime.enable'); await send('Page.enable');
console.log('invoke:', await evaluate(`window.__TAURI_INTERNALS__.invoke('open_react_preview').then(() => 'ok').catch((e) => 'err:' + e)`));
await new Promise(r => setTimeout(r, 2200));
for (let i = 0; i < 20; i++) { if (await evaluate(`document.querySelectorAll('.nav-item').length`)) break; await new Promise(r => setTimeout(r, 300)); }
console.log(JSON.stringify(await evaluate(`({ innerWidth, innerHeight, title: document.title, pageTitle: document.querySelector('.page-title')?.textContent || '', back: !!document.querySelector('.sidebar__back') })`), null, 2));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/overlay-port/react-inside-tauri-2.png', Buffer.from(shot.data, 'base64'));
ws.close(); process.exit(0);
