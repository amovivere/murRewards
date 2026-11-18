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
for (let i = 0; i < 40; i++) { if (await evaluate(`!!document.querySelector('.reward-card')`)) break; await new Promise(r => setTimeout(r, 250)); }
await new Promise(r => setTimeout(r, 900));
const heights = await evaluate(`Array.from(document.querySelectorAll('.reward-card')).slice(0, 12).map(c => ({ h: Math.round(c.getBoundingClientRect().height), sound: !!c.querySelector('.play-large:not(.is-empty)'), name: c.querySelector('.card-sound-title')?.textContent || '' }))`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/ux-review/2026-11-react/shots4/cards-final.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify(heights, null, 2));
ws.close(); process.exit(0);
