const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((x) => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
await send('Runtime.enable');
for (let i = 0; i < 40; i++) { if (await evaluate(`!!window.__TAURI_INTERNALS__`)) break; await new Promise(r => setTimeout(r, 250)); }
const before = await evaluate(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return (s.music?.items||[]).map(i=>i.video_id); })()`);
await evaluate(`window.__TAURI_INTERNALS__.invoke('music_add_manual', { url: 'https://youtu.be/tRAmPLYjbGg' })`);
await new Promise(r => setTimeout(r, 12000));
const after = await evaluate(`(async () => { const s = await window.__TAURI_INTERNALS__.invoke('get_state'); return { items: (s.music?.items||[]).map(i=>({id:i.id,title:i.title,state:i.state,prefetched:i.prefetched})), current:s.music?.current?.title, error:s.music?.error }; })()`);
console.log(JSON.stringify({ before, after }, null, 2));
ws.close(); process.exit(0);
