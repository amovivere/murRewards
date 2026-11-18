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
await new Promise(r => setTimeout(r, 1000));
const state = await evaluate(`window.__TAURI_INTERNALS__.invoke('get_state')`);
// буквенные аватары
const letters = await evaluate(`document.querySelectorAll('.reward-letter').length`);
// открыть меню первой карточки и измерить
await evaluate(`document.querySelector('.reward-card .icon-ghost').click(); true`);
await new Promise(r => setTimeout(r, 250));
const menu = await evaluate(`(() => {
  const menu = document.querySelector('.reward-menu');
  const card = document.querySelector('.reward-card');
  if (!menu || !card) return null;
  const m = menu.getBoundingClientRect(), c = card.getBoundingClientRect();
  const deleteBtn = Array.from(menu.querySelectorAll('button')).find(b => b.textContent.includes('Удалить'));
  const d = deleteBtn?.getBoundingClientRect();
  return { menu: [m.x,m.y,m.width,m.height], card: [c.x,c.y,c.width,c.height], delete: d ? [d.x,d.y,d.width,d.height] : null, viewport: [innerWidth,innerHeight] };
})()`);
await evaluate(`Array.from(document.querySelectorAll('.reward-menu button')).find(b => b.textContent.includes('Удалить')).click(); true`);
await new Promise(r => setTimeout(r, 300));
const deleteModal = await evaluate(`document.querySelector('.ui-modal__title')?.textContent || ''`);
await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);
await new Promise(r => setTimeout(r, 200));
// редактирование
await evaluate(`document.querySelector('.reward-card .icon-ghost').click(); true`);
await new Promise(r => setTimeout(r, 200));
await evaluate(`Array.from(document.querySelectorAll('.reward-menu button')).find(b => b.textContent.includes('Редактировать')).click(); true`);
await new Promise(r => setTimeout(r, 350));
const edit = await evaluate(`({ title: document.querySelector('.ui-modal__title')?.textContent || '', values: Array.from(document.querySelectorAll('.ui-modal input')).map(i => i.value), saveDisabled: Array.from(document.querySelectorAll('.ui-modal button')).find(b => b.textContent.includes('Сохранить'))?.disabled })`);
await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);
// maximize → fluid
await evaluate(`window.__TAURI_INTERNALS__.invoke('win_toggle_maximize'); true`);
await new Promise(r => setTimeout(r, 900));
const fluid = await evaluate(`({ inner: [innerWidth, innerHeight], shell: [document.querySelector('.app-shell').clientWidth, document.querySelector('.app-shell').clientHeight], left: document.querySelector('.app-shell').getBoundingClientRect().left })`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('F:/WorkSpaces/Mur rewards/.design/ux-review/2026-11-react/shots/fix-01-fluid-maximized.png', Buffer.from(shot.data, 'base64'));
await evaluate(`window.__TAURI_INTERNALS__.invoke('win_toggle_maximize'); true`);
console.log(JSON.stringify({ state: { login: state.login, rewards: state.rewards.length }, letters, menu, deleteModal, edit, fluid }, null, 2));
ws.close(); process.exit(0);
