import fs from 'node:fs';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
await send('Runtime.enable'); await send('Page.enable');
await evaluate(`window.__TAURI_INTERNALS__.invoke('open_react_preview').catch(() => {}); true`);
await new Promise(r => setTimeout(r, 2200));
for (let i = 0; i < 30; i++) { if (await evaluate(`document.querySelectorAll('.nav-item').length`)) break; await new Promise(r => setTimeout(r, 250)); }
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await new Promise(r => setTimeout(r, 1200));
const before = await evaluate(`({
  iframe: document.querySelector('.overlay-preview__frame')?.src || '',
  preset: document.querySelector('.preset-bar__select span')?.textContent || '',
  saved: document.querySelector('.preset-bar__status')?.textContent || ''
})`);
console.log('before:', JSON.stringify(before));
// меняем первый слайдер (размер шрифта) и применяем
await evaluate(`(() => {
  const input = document.querySelector('.overlay-controls input[type=range]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, String(Number(input.value) + 1));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await new Promise(r => setTimeout(r, 400));
const apply = await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('.ui-button')).find(b => b.textContent.trim() === 'Применить');
  if (!button) return 'no button';
  button.click();
  return button.disabled ? 'disabled' : 'clicked';
})()`);
await new Promise(r => setTimeout(r, 1200));
const after = await evaluate(`(async () => ({
  apply: '${apply}',
  settingsLength: await window.__TAURI_INTERNALS__.invoke('get_chat_overlay_settings').then(s => s.length).catch(e => 'err:' + e),
  saved: document.querySelector('.preset-bar__status')?.textContent || '',
  frame: document.querySelector('.overlay-preview__frame')?.src || ''
}))()`);
console.log('after:', JSON.stringify(after, null, 2));
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/overlay-port/react-overlay-real.png', Buffer.from(shot.data, 'base64'));
ws.close(); process.exit(0);
