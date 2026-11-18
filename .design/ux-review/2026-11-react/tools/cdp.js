// CDP helper for the running Reward Sounds Tauri app (REWARD_SOUNDS_DEVTOOLS_PORT=9333).
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..');
const SHOTS = path.join(OUT, 'shots');
const NOTES = path.join(OUT, 'notes');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(NOTES, { recursive: true });

async function connect(port = 9333) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page') || targets[0];
  if (!page) throw new Error('no page target');
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

async function evalJs(send, expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
    userGesture: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 2000));
  return r.result.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function screenshot(send, name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(SHOTS, name.endsWith('.png') ? name : name + '.png');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

function saveNote(name, data) {
  const file = path.join(NOTES, name.endsWith('.json') ? name : name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

// Injected into the page: INVENTORY_FN() returns every interactive/visible element with metrics.
const INVENTORY_FN = `function () {
  const round = (n) => Math.round(n * 10) / 10;
  const sels = 'button, a, input, select, textarea, [role="button"], [role="switch"], [role="tab"], [role="menuitem"], [tabindex]';
  const nodes = Array.from(document.querySelectorAll(sels));
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) };
  };
  const css = (el) => {
    const s = getComputedStyle(el);
    return {
      color: s.color, bg: s.backgroundColor, font: s.fontSize + '/' + s.lineHeight + ' ' + s.fontFamily.split(',')[0],
      cursor: s.cursor, outline: s.outlineStyle + ' ' + s.outlineWidth, opacity: s.opacity, overflow: s.overflow,
    };
  };
  const reactProps = (el) => {
    const k = Object.keys(el).find((key) => key.startsWith('__reactProps'));
    if (!k) return null;
    const p = el[k] || {};
    return { hasOnClick: typeof p.onClick === 'function', hasOnChange: typeof p.onChange === 'function', onClick: typeof p.onClick === 'function' };
  };
  return nodes.map((el, i) => {
    const r = rectOf(el);
    if (r.w === 0 && r.h === 0) return null;
    return {
      i,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      cls: (el.getAttribute('class') || '').slice(0, 160),
      id: el.id || '',
      role: el.getAttribute('role') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      ariaChecked: el.getAttribute('aria-checked'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      title: el.getAttribute('title') || '',
      placeholder: el.getAttribute('placeholder') || '',
      tabIndex: el.tabIndex,
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      text: (el.value !== undefined && el.value !== '' && el.tagName !== 'BUTTON' ? String(el.value) : (el.textContent || '')).replace(/\\s+/g, ' ').trim().slice(0, 120),
      value: el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' ? String(el.value).slice(0, 80) : undefined,
      rect: r,
      css: css(el),
      react: reactProps(el),
    };
  }).filter(Boolean);
}`;

async function inventory(send) {
  return evalJs(send, `(${INVENTORY_FN})()`);
}

// Generic click by JS selector path. Returns true if clicked.
async function click(send, selector, index = 0) {
  return evalJs(
    send,
    `(() => {
      const els = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const el = els[${index}];
      if (!el) return { ok: false, count: els.length };
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { ok: true, count: els.length };
    })()`
  );
}

async function pageInfo(send) {
  return evalJs(send, `(() => ({
    innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    dpr: devicePixelRatio,
    scrollX: window.scrollX, scrollY: window.scrollY,
    docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight,
    active: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null,
    hasTauri: Boolean(window.__TAURI_INTERNALS__),
    title: document.title,
  }))()`);
}

module.exports = { connect, evalJs, sleep, screenshot, saveNote, inventory, click, pageInfo, OUT, SHOTS, NOTES };
