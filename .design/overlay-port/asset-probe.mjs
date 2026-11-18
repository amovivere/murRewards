const t = await (await fetch('http://127.0.0.1:9333/json')).json();
const p = t.find(x => x.type === 'page');
const ws = new WebSocket(p.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const expr = `(async () => {
  const out = {};
  for (const u of ['/next/index.html', '/next/assets/index-CIk3RJS_.js', '/next/overlay.html']) {
    try { const r = await fetch(u); out[u] = r.status + ' ' + (await r.text()).slice(0, 120); }
    catch (e) { out[u] = 'ERR ' + e; }
  }
  return out;
})()`;
const result = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(result.result.value, null, 2));
ws.close(); process.exit(0);
