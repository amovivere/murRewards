import fs from 'node:fs';

const outDir = 'F:/WorkSpaces/Mur rewards/.design/prototypes/react-app/shots';
fs.mkdirSync(outDir, { recursive: true });

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:8782'))
  || targets.find((target) => target.type === 'page');
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
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await send('Runtime.enable');
await send('Page.enable');
for (let attempt = 0; attempt < 30; attempt += 1) {
  if (await evaluate(`document.querySelectorAll('.nav-item').length`)) break;
  await sleep(300);
}

const tabs = [
  ['rewards', 'Награды', 'rewards-1600.png'],
  ['music', 'Музыка', 'music-1600.png'],
  ['overlay', 'Оверлей', 'overlay-1600.png'],
  ['settings', 'Настройки', 'settings-1600.png'],
  ['log', 'Журнал', 'log-1600.png'],
  ['design', 'Дизайн-система', 'design-1600.png'],
];

for (const [id, label, file] of tabs) {
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith('${label}')).click(); true`);
  await sleep(id === 'overlay' ? 1400 : 500);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`${outDir}/${file}`, Buffer.from(data, 'base64'));
  const size = fs.statSync(`${outDir}/${file}`).size;
  console.log(file, Math.round(size / 1024) + ' KB');
}
ws.close();
