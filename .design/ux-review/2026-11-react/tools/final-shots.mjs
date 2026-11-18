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
const rewards = await evaluate(`({ size: [innerWidth, innerHeight], shell: [document.querySelector('.app-shell').clientWidth, document.querySelector('.app-shell').clientHeight], cards: document.querySelectorAll('.reward-card').length, letters: document.querySelectorAll('.reward-letter').length, title: document.title })`);
const shot1 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/ux-review/2026-11-react/shots3/final-rewards.png', Buffer.from(shot1.data, 'base64'));
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await new Promise(r => setTimeout(r, 1500));
const overlay = await evaluate(`(() => {
  const wrap = document.querySelector('.overlay-preview__frame-wrap').getBoundingClientRect();
  const preview = document.querySelector('.overlay-preview').getBoundingClientRect();
  const content = document.querySelector('.content').getBoundingClientRect();
  return { wrap: [Math.round(wrap.width), Math.round(wrap.height)], previewBottom: Math.round(preview.bottom), contentBottom: Math.round(content.bottom), loaded: !document.querySelector('.overlay-preview__loading'), size: document.querySelector('.overlay-preview__size')?.textContent || '' };
})()`);
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/ux-review/2026-11-react/shots3/final-overlay.png', Buffer.from(shot2.data, 'base64'));
console.log(JSON.stringify({ rewards, overlay }, null, 2));
ws.close(); process.exit(0);
