const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:8782'))
  || targets.find((target) => target.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails?.text || 'exception');
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
  }
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
  const ready = await evaluate(`document.querySelectorAll('.nav-item').length`);
  if (ready > 0) break;
  await sleep(300);
}
const probe = await evaluate(`({ url: location.href, title: document.title, html: document.body.innerText.slice(0, 200) })`);
console.log('probe:', JSON.stringify(probe));

const tabs = await evaluate(`Array.from(document.querySelectorAll('.nav-item')).map((b) => b.textContent.trim())`);
console.log('tabs:', JSON.stringify(tabs));

for (const [tab, expected] of [
  ['music', 'Музыка'],
  ['rewards', 'Награды'],
  ['overlay', 'Оверлей'],
  ['design', 'Дизайн-система'],
]) {
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith('${expected}')).click(); true`);
  await sleep(350);
  const title = await evaluate(`document.querySelector('.page-title')?.textContent || ''`);
  console.log(tab, '->', title);
}

// overlay page live preview + slider update
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await sleep(800);
const before = await evaluate(`document.querySelector('.overlay-preview__frame')?.src || ''`);
const range = await evaluate(`(() => {
  const input = document.querySelector('.overlay-controls input[type=range]');
  if (!input) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, String(Number(input.value) + 2));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`);
await sleep(500);
const frameTitle = await evaluate(`document.querySelector('.overlay-preview__frame')?.title || ''`);
console.log('preview src:', before);
console.log('range after:', range, 'frame title:', frameTitle);
console.log('errors:', JSON.stringify(errors));
ws.close();
if (errors.length) process.exit(1);
