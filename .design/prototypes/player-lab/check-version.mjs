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
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) return { exception: result.exceptionDetails.text };
  return result.result.value;
};
await send('Runtime.enable');
const info = await ev(`(async () => {
  try {
    const s = await window.__TAURI_INTERNALS__.invoke('get_state');
    return { version: s.version, connected: s.connected, login: s.login, rewards: s.rewards.length, body: document.body.innerText.includes('версия 1.8.0') };
  } catch (e) { return { error: String(e) }; }
})()`);
console.log(JSON.stringify(info));
ws.close();
process.exit(0);
