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
await new Promise(r => setTimeout(r, 1800));
const info = await ev(`(() => {
  const card = document.querySelector('.reward-card');
  return {
    title: card?.querySelector('.reward-b-title')?.textContent,
    cover: card?.querySelector('.reward-b-cover img')?.getAttribute('src'),
    hasFilename: (card?.innerText || '').includes('.mp3'),
    mode: card?.querySelector('.reward-mode')?.textContent,
    footer: Array.from(card?.querySelectorAll('.reward-b-footer button') || []).map(b => b.textContent.trim()),
    cardHeight: Math.round(card?.getBoundingClientRect().height || 0),
  };
})()`);
let shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/rewards-B-app.png', Buffer.from(shot.data, 'base64'));
await ev(`document.querySelector('.reward-card .reward-b-footer button')?.click(); true`);
await new Promise(r => setTimeout(r, 700));
const editor = await ev(`(() => ({
  title: document.querySelector('.ui-modal__title')?.textContent,
  modes: Array.from(document.querySelectorAll('.reward-editor__modes button')).map(b => b.textContent.trim()),
  photos: document.querySelectorAll('.editor-photo img').length,
  hasPreview: Boolean(document.querySelector('.editor-preview iframe')),
  hasSoundPath: Boolean(document.querySelector('.editor-sound__path')?.textContent),
  columns: getComputedStyle(document.querySelector('.reward-editor__body')).gridTemplateColumns
}))()`);
shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/prototypes/player-lab/shots/editor-B-app.png', Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({info, editor}, null, 2));
ws.close(); process.exit(0);
