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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Runtime.enable');
await new Promise((r) => setTimeout(r, 1000));
const before = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { connected: s.connected, clientId: s.client_id, auth: s.auth, page: document.querySelector('.page-title')?.textContent }; })()`);
const started = await ev(`window.__TAURI_INTERNALS__.invoke('twitch_start_login').then(() => 'ok').catch(e => String(e))`);
await new Promise((r) => setTimeout(r, 2500));
const after = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { auth: s.auth, codeInUi: document.querySelector('.onboarding-code__value')?.textContent || null, page: document.querySelector('.page-title')?.textContent }; })()`);
console.log(JSON.stringify({ before, started, after }, null, 2));
ws.close();
process.exit(0);
