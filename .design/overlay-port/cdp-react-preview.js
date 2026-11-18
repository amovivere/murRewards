const fs = require('node:fs');
const path = require('node:path');

async function targets() {
  return (await (await fetch('http://127.0.0.1:9333/json')).json());
}

async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  return { ws, send };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

(async () => {
  let pages = await targets();
  const main = pages.find((page) => page.type === 'page' && !page.url.includes('next/index.html'));
  console.log('main:', main?.url);
  const { ws, send } = await connect(main);
  await send('Runtime.enable');
  const result = await evaluate(send, `window.__TAURI_INTERNALS__.invoke('open_react_preview').then(() => 'ok').catch((e) => 'error: ' + e)`);
  console.log('invoke:', result);
  ws.close();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  pages = await targets();
  console.log('targets:', pages.map((page) => ({ type: page.type, url: page.url })));
  const preview = pages.find((page) => page.type === 'page' && page.url.includes('next/index.html'));
  if (!preview) process.exit(2);
  const previewConn = await connect(preview);
  await previewConn.send('Runtime.enable');
  await previewConn.send('Page.enable');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const title = await evaluate(previewConn.send, `document.title + ' | ' + (document.querySelector('.page-title')?.textContent || '')`);
  console.log('preview:', title);
  const shot = await previewConn.send('Page.captureScreenshot', { format: 'png' });
  const out = 'F:/WorkSpaces/Mur rewards/.design/overlay-port/react-preview-in-tauri.png';
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('shot:', out);
  previewConn.ws.close();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
