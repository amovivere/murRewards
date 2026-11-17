// Small CDP helper for the running Reward Sounds Tauri app (port 9333).
const fs = require('fs');
const path = require('path');

const OUT = __dirname;

async function connect() {
  const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
  const page = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  };
  await new Promise((r, reject) => {
    ws.onopen = r;
    ws.onerror = reject;
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { ws, send };
}

const evalJs = async (send, expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
    awaitPromise: awaitPromise,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function screenshot(send, name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const base = path.isAbsolute(name) ? name : path.join(OUT, name);
  const file = base.endsWith('.png') ? base : base + '.png';
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

const PROPS = [
  'background-color',
  'background-image',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'outline-style',
  'outline-color',
  'outline-width',
  'box-shadow',
  'filter',
  'opacity',
  'transform',
  'text-decoration-line',
  'width',
  'height',
  'top',
  'left',
  'margin-left',
];

const SNAP_FN = `function () {
  const cs = getComputedStyle(this);
  const out = {};
  for (const p of ${JSON.stringify(PROPS)}) out[p] = cs.getPropertyValue(p);
  out.__cursor = cs.cursor;
  const svgs = this.querySelectorAll('svg');
  out.__svg = Array.from(svgs).map((s) => ({
    stroke: getComputedStyle(s).stroke,
    fill: getComputedStyle(s).fill,
    opacity: getComputedStyle(s).opacity,
  }));
  out.__title = (this.getAttribute('title') || '').slice(0, 40);
  out.__text = (this.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
  return out;
}`;

async function snapshot(nodeObjectId, send) {
  const r = await send('Runtime.callFunctionOn', {
    objectId: nodeObjectId,
    functionDeclaration: SNAP_FN,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

module.exports = { connect, evalJs, sleep, screenshot, snapshot, OUT };
