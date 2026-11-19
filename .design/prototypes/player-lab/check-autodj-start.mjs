const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Runtime.enable');
const info = await ev(`(async () => {
  const s = await window.__TAURI_INTERNALS__.invoke('get_state');
  const btn = document.querySelector('.music-transport .ui-button');
  return {
    current: s.music?.current?.title || null,
    autodj: s.music?.autodj,
    playlist: s.music?.autodj_playlist?.length,
    button: btn?.textContent.trim(),
    disabled: btn?.disabled,
    queued: (s.music?.items || []).filter(i => i.state === 'queued').length
  };
})()`);
console.log(JSON.stringify(info));
ws.close(); process.exit(0);
