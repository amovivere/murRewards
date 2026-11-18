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
await new Promise(r => setTimeout(r, 800));
// edit focus return
const edit = await evaluate(`(async () => {
  const card = document.querySelector('.reward-card');
  const dots = card.querySelector('.icon-ghost'); dots.focus(); dots.click();
  await new Promise(r => setTimeout(r, 200));
  Array.from(document.querySelectorAll('.reward-menu button')).find(b => b.textContent.includes('Редактировать')).click();
  await new Promise(r => setTimeout(r, 250));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 250));
  return { focusClass: document.activeElement?.className || '', isDots: document.activeElement === card.querySelector('.icon-ghost') };
})()`);
// overlay preview bounds and form typing
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await new Promise(r => setTimeout(r, 1600));
const overlay = await evaluate(`(() => {
  const wrap = document.querySelector('.overlay-preview__frame-wrap');
  const preview = document.querySelector('.overlay-preview');
  const content = document.querySelector('.content');
  const w = wrap.getBoundingClientRect(), p = preview.getBoundingClientRect(), c = content.getBoundingClientRect();
  return { wrap: [Math.round(w.width), Math.round(w.height)], previewBottom: Math.round(p.bottom), contentBottom: Math.round(c.bottom), sizeLabel: document.querySelector('.overlay-preview__size')?.textContent || '' };
})()`);
const hex = await evaluate(`(() => {
  const input = document.querySelector('.overlay-controls .ui-color-field__hex');
  if (!input) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '#ABCDEF'); input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`);
const tag = await evaluate(`(() => {
  const input = document.querySelector('.overlay-controls input.is-mono[placeholder*="arstotsky"]') || document.querySelector('.overlay-controls input.is-mono');
  if (!input) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'a, b'); input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`);
console.log(JSON.stringify({ edit, overlay, hex, tag }, null, 2));
ws.close(); process.exit(0);
