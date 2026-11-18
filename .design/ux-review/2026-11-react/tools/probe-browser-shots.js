const fs = require('fs');
const path = require('path');
const { evalJs, sleep, saveNote } = require('./cdp');

async function connectBrowser(port = 9444, urlPrefix = 'http://127.0.0.1:8780') {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page' && t.url.startsWith(urlPrefix));
  if (!page) throw new Error('no app page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result); } };
  await new Promise((r, reject) => { ws.onopen = r; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ws, send };
}

async function shot(send, name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1600, height: 1000, scale: 1 } });
  const file = path.resolve(__dirname, '..', 'shots', name + '.png');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

(async () => {
  const { send, ws } = await connectBrowser();
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const info = await evalJs(send, `({ innerW: innerWidth, innerH: innerHeight })`);
  console.log('EMULATED', JSON.stringify(info));

  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Онбординг')).click()`);
  await sleep(900);
  await shot(send, 'browser-10-onboarding-1600');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Музыка')).click()`);
  await sleep(700);
  await shot(send, 'browser-11-music-mock-1600');
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(300);
  await shot(send, 'browser-12-music-mock-bottom-1600');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Награды')).click()`);
  await sleep(700);
  await shot(send, 'browser-13-rewards-mock-1600');
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(300);
  await shot(send, 'browser-14-rewards-mock-bottom-1600');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Настройки')).click()`);
  await sleep(700);
  await shot(send, 'browser-15-settings-mock-1600');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Журнал')).click()`);
  await sleep(700);
  await shot(send, 'browser-16-log-mock-1600');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Оверлей')).click()`);
  await sleep(900);
  await shot(send, 'browser-17-overlay-mock-1600');
  // reset metrics
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
  console.log('BROWSER SHOTS DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
