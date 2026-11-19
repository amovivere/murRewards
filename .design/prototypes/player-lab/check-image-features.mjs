const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id;
  pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.text };
  return r.result.value;
};
await send('Runtime.enable');
await new Promise((r) => setTimeout(r, 1200));
await ev(`Array.from(document.querySelectorAll('.nav-item')).find(b => b.textContent.trim().startsWith('Награды')).click(); true`);
await new Promise((r) => setTimeout(r, 700));
await ev(`document.querySelector('.reward-card .reward-b-footer button')?.click(); true`);
await new Promise((r) => setTimeout(r, 800));
const info = await ev(`(() => ({
  photos: document.querySelectorAll('.editor-photo').length,
  covers: document.querySelectorAll('.editor-photo__cover').length,
  weights: Array.from(document.querySelectorAll('.editor-photo__weight')).map(i => i.value),
  draggable: Array.from(document.querySelectorAll('.editor-photo[draggable]')).length,
  placement: Boolean(document.querySelector('.reward-editor__gallery .ui-select, .reward-editor__gallery select')),
  delay: document.body.innerText.includes('Задержка'),
  noRepeat: document.body.innerText.includes('Без повторов подряд'),
  limit: document.body.innerText.includes('Лимит показов'),
  coverClass: document.querySelectorAll('.editor-photo.is-cover').length
}))()`);
console.log(JSON.stringify(info));
ws.close();
process.exit(0);
