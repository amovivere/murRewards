const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Runtime.enable');
const result = await evaluate(`(async () => {
  const s = await window.__TAURI_INTERNALS__.invoke('get_state');
  const test = (s.music?.items || []).find((i) => i.id === 'manual-1795012098739' || (i.title === 'так похуй' && i.state === 'queued'));
  if (!test) return { removed: false };
  await window.__TAURI_INTERNALS__.invoke('music_remove_item', { id: test.id });
  const after = await window.__TAURI_INTERNALS__.invoke('get_state');
  return { removed: true, id: test.id, items: (after.music?.items || []).map((i) => ({ title: i.title, state: i.state })) };
})()`);
console.log(JSON.stringify(result, null, 2));
ws.close(); process.exit(0);
