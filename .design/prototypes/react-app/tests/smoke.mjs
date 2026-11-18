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
  if (await evaluate(`document.querySelectorAll('.nav-item').length`)) break;
  await sleep(300);
}

const tabs = [
  ['Награды', 'Награды'],
  ['Музыка', 'Музыка'],
  ['Оверлей', 'Оверлей чата'],
  ['Настройки', 'Настройки'],
  ['Журнал', 'Журнал'],
  ['Онбординг', 'Добро пожаловать'],
  ['Дизайн-система', 'Дизайн-система'],
];

for (const [label, expected] of tabs) {
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith('${label}')).click(); true`);
  await sleep(320);
  const title = await evaluate(`document.querySelector('.page-title')?.textContent || ''`);
  if (title !== expected) throw new Error(`tab ${label}: expected ${expected}, got ${title}`);
  console.log(label, '->', title);
}

// Overlay preview
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith('Оверлей')).click(); true`);
await sleep(1000);
const preview = await evaluate(`({ src: document.querySelector('.overlay-preview__frame')?.src || '', title: document.querySelector('.overlay-preview__frame')?.title || '' })`);
if (!preview.src.includes('/overlay.html?preview=1')) throw new Error('preview missing');
console.log('preview:', preview.title);

// Slider update
const range = await evaluate(`(() => {
  const input = document.querySelector('.overlay-controls input[type=range]');
  if (!input) return null;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const before = input.value;
  setter.call(input, String(Number(input.value) + 2));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return { before, after: input.value };
})()`);
console.log('range:', JSON.stringify(range));

// Create reward modal
await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith('Награды')).click(); true`);
await sleep(300);
await evaluate(`Array.from(document.querySelectorAll('.ui-button')).find((b) => b.textContent.includes('Создать награду')).click(); true`);
await sleep(400);
const modal = await evaluate(`({ open: !!document.querySelector('.ui-modal'), title: document.querySelector('.ui-modal__title')?.textContent || '' })`);
if (!modal.open || !modal.title.includes('Новая награда')) throw new Error('create modal missing');
console.log('modal:', JSON.stringify(modal));
await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);

console.log('errors:', JSON.stringify(errors));
ws.close();
if (errors.length) process.exit(1);
