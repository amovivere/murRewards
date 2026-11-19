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
await new Promise((r) => setTimeout(r, 1000));
const before = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { current: s.music?.current?.title || null, queued: (s.music?.items || []).filter(i => i.state === 'queued').length, autodj: s.music?.autodj, playlist: s.music?.autodj_playlist?.length }; })()`);
await ev(`window.__TAURI_INTERNALS__.invoke('music_start_autodj').catch(() => {})`);
await new Promise((r) => setTimeout(r, 12000));
const after = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { current: s.music?.current?.title || null, queued: (s.music?.items || []).filter(i => i.state === 'queued').length, items: (s.music?.items || []).slice(0, 3).map(i => ({ title: i.title, state: i.state, user: i.user_login })) }; })()`);
console.log(JSON.stringify({ before, after }, null, 2));
ws.close();
process.exit(0);
