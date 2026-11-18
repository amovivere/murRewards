import fs from 'node:fs';

const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
};
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://tauri.localhost/next/index.html' });
await sleep(2500);
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const ready = await evaluate(`document.querySelectorAll('.nav-item').length`);
    if (ready > 0) break;
  } catch {
    // СЃС‚СЂР°РЅРёС†Р° РµС‰С‘ РїРµСЂРµР·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ
  }
  await sleep(300);
}
const info = await evaluate(`({
  title: document.title,
  url: location.href,
  nav: Array.from(document.querySelectorAll('.nav-item')).map((b) => b.textContent.trim()),
  pageTitle: document.querySelector('.page-title')?.textContent || '',
  back: !!document.querySelector('.sidebar__back'),
  body: document.body.innerText.slice(0, 180)
})`);
console.log(JSON.stringify(info, null, 2));
const shot = await send('Page.captureScreenshot', { format: 'png' });
const out = 'F:/WorkSpaces/Mur rewards/.design/overlay-port/react-inside-tauri.png';
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('shot:', out, fs.statSync(out).size);
ws.close();
process.exit(0);

