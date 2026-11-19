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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Runtime.enable');
await sleep(1000);
const start = await ev(`(async () => {
  const s = await window.__TAURI_INTERNALS__.invoke('get_state');
  const url = s.music.autodj_playlist[0];
  await window.__TAURI_INTERNALS__.invoke('music_start_autodj');
  return { url, interrupt: s.music.autodj_interrupt };
})()`);
let autoPlaying = null;
for (let i = 0; i < 12; i++) {
  await sleep(1500);
  autoPlaying = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { current: s.music.current?.title || null, user: s.music.current?.user_login || null, pos: s.music.player?.position_sec || 0, active: s.music.autodj_active }; })()`);
  if (autoPlaying.user === 'AutoDJ' && autoPlaying.pos > 0) break;
}
await ev(`window.__TAURI_INTERNALS__.invoke('music_add_manual', { url: '${start.url}' })`);
let interrupted = null;
for (let i = 0; i < 20; i++) {
  await sleep(1500);
  interrupted = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { current: s.music.current?.title || null, user: s.music.current?.user_login || null, pos: s.music.player?.position_sec || 0, active: s.music.autodj_active, queued: (s.music.items || []).filter(x => x.state === 'queued').length }; })()`);
  if (interrupted.user === 'manual') break;
}
await ev(`window.__TAURI_INTERNALS__.invoke('music_skip', { reason: 'test interruption' })`);
let resumed = null;
for (let i = 0; i < 20; i++) {
  await sleep(1500);
  resumed = await ev(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { current: s.music.current?.title || null, user: s.music.current?.user_login || null, pos: s.music.player?.position_sec || 0, active: s.music.autodj_active }; })()`);
  if (resumed.user === 'AutoDJ') break;
}
await ev(`window.__TAURI_INTERNALS__.invoke('music_stop_autodj')`);
console.log(JSON.stringify({ start, autoPlaying, interrupted, resumed }, null, 2));
ws.close();
process.exit(0);
