/**
 * Boot check: opens the lab in headless Edge via CDP, prints console errors and
 * whether the app rendered. Usage: node scripts/check.mjs [url]
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5177/?v=A';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9335;
const dir = await mkdtemp(path.join(tmpdir(), 'irl-cdp-'));
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${dir}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target = null;
for (let i = 0; i < 40 && !target; i += 1) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch { target = null; }
}
if (!target) { console.error('no target'); edge.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let id = 1; const pending = new Map(); const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') events.push(`EXCEPTION ${m.params.exceptionDetails?.text} ${m.params.exceptionDetails?.exception?.description || ''}`);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    events.push(`${m.params.type.toUpperCase()} ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = id++; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });
await sleep(3500);
const r = await send('Runtime.evaluate', {
  expression: `({ rootChildren: document.getElementById('root')?.children.length ?? -1, body: document.body.innerText.slice(0, 400), title: document.title })`,
  returnByValue: true,
});
console.log(JSON.stringify(r.result?.value, null, 1));
console.log('events:', events.length ? events.join('\n') : 'none');
ws.close(); edge.kill(); await sleep(300); await rm(dir, { recursive: true, force: true }).catch(() => {});
