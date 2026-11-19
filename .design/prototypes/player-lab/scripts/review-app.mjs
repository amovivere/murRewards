/**
 * Review driver for the implemented Reward Sounds app (CDP 127.0.0.1:9333).
 * Read-only walk-through: screenshots + DOM/geometry measurements.
 * Run: node scripts/review-app.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CDP = 'http://127.0.0.1:9333';
const SHOTS = path.resolve('shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) throw new Error('no CDP page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let id = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = id++;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
}

async function shot(name) {
  await sleep(450);
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = path.join(SHOTS, name);
  await writeFile(file, Buffer.from(data, 'base64'));
  console.log('shot:', name);
}

async function clickByText(tag, needle, exact = false, root = 'document') {
  return evaluate(`(() => {
    const root = ${root === 'document' ? 'document' : `document.querySelector(${JSON.stringify(root)})`};
    if (!root) return false;
    const nodes = [...root.querySelectorAll(${JSON.stringify(tag)})];
    const n = nodes.find((el) => ${exact
      ? `el.textContent.trim() === ${JSON.stringify(needle)}`
      : `el.textContent.includes(${JSON.stringify(needle)})`});
    if (!n) return false;
    n.click();
    return n.textContent.trim().slice(0, 60);
  })()`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1694, height: 1063, deviceScaleFactor: 1, mobile: false });

const report = {};

/* ---------------------------------------------------- find music screen */
await sleep(800);
report.screen0 = await evaluate(`document.querySelector('.page-title')?.textContent || document.title`);
if (!/Музыка/.test(report.screen0 || '')) {
  await clickByText('.nav-item, button, a', 'Музыка');
  await sleep(900);
}
report.screen = await evaluate(`document.querySelector('.page-title')?.textContent`);
report.viewport = await evaluate(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);

/* ---------------------------------------------------- buttons & hints */
report.transport = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('button')];
  const pick = (re) => buttons.find((b) => re.test((b.textContent || '').trim()));
  const next = pick(/Следующий/);
  const skip = buttons.find((b) => /Пропустить/.test(b.textContent || '') && !/с причиной/.test(b.textContent || ''));
  const play = pick(/Пауза|Продолжить/);
  const rect = (el) => el ? el.getBoundingClientRect().toJSON() : null;
  const cs = (el) => el ? { font: getComputedStyle(el).fontSize, bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color } : null;
  return {
    next: { text: next?.textContent.trim(), title: next?.title, rect: rect(next), cs: cs(next) },
    skip: { text: skip?.textContent.trim(), title: skip?.title, rect: rect(skip), cs: cs(skip) },
    play: { rect: rect(play), label: play?.getAttribute('aria-label') },
    hintText: [...document.querySelectorAll('*')].filter((n) => n.children.length === 0 && /Space|Shift|пропуск с причиной/.test(n.textContent || '')).slice(0, 6).map((n) => n.textContent.trim()),
  };
})()`);

/* ---------------------------------------------------- skip dialog */
report.skipClicked = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Пропустить/.test(x.textContent || '') && !/с причиной/.test(x.textContent || ''));
  if (!b) return false;
  b.click();
  return b.textContent.trim();
})()`);
await sleep(500);
report.skipDialog = await evaluate(`(() => {
  const dlg = document.querySelector('[role="dialog"], .modal, .modal-backdrop');
  if (!dlg) return null;
  const text = dlg.innerText;
  const buttons = [...dlg.querySelectorAll('button')].map((b) => b.textContent.trim());
  const inputs = [...dlg.querySelectorAll('input')].map((i) => ({ type: i.type, checked: i.checked }));
  return { text: text.slice(0, 1400), buttons, inputs };
})()`);
await shot('review-skip-dialog.png');
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
await sleep(350);
report.skipDialogClosed = await evaluate(`!document.querySelector('[role="dialog"], .modal-backdrop')`);

/* ---------------------------------------------------- rules card text */
report.rules = await evaluate(`(() => {
  const panels = [...document.querySelectorAll('.panel, section, .card')];
  const p = panels.find((n) => /Правила и модерация/.test(n.innerText || ''));
  return p ? p.innerText.slice(0, 1200) : null;
})()`);

/* ---------------------------------------------------- queue & states */
report.queue = await evaluate(`(() => {
  const rows = [...document.querySelectorAll('.queue-row')];
  return rows.map((r) => r.innerText.replace(/\\n+/g, ' | ').slice(0, 160)).slice(0, 8);
})()`);
report.overlay = await evaluate(`(() => {
  const ytdlp = document.querySelector('.page')?.innerText || '';
  return ytdlp.includes('yt-dlp') ? 'yt-dlp status visible' : 'no yt-dlp status';
})()`);

/* ---------------------------------------------------- sizes 1600 / 1800 */
async function measureAt(width, height, name) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(700);
  const metrics = await evaluate(`(() => {
    const overflow = [...document.querySelectorAll('.stage, .player, .queue-panel, .rules, .panel, .music-stage')]
      .filter((n) => n.scrollWidth > n.clientWidth + 2)
      .map((n) => ({
        cls: n.className?.toString().slice(0, 60),
        sw: n.scrollWidth, cw: n.clientWidth,
      }));
    const next = [...document.querySelectorAll('button')].find((b) => /Следующий трек/.test(b.textContent || ''));
    const skip = [...document.querySelectorAll('button')].find((b) => /^Пропустить\\.\\.\\.$/.test(b.textContent || ''));
    const vol = document.querySelector('.player__volume, .volume');
    const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    return {
      innerWidth, innerHeight,
      next: r(next), skip: r(skip), volume: r(vol),
      gapNextSkip: next && skip ? skip.getBoundingClientRect().left - next.getBoundingClientRect().right : null,
      bodyScroll: { sw: document.body.scrollWidth, cw: document.body.clientWidth, sh: document.body.scrollHeight, ch: document.body.clientHeight },
      overflow,
    };
  })()`);
  await shot(name);
  return metrics;
}
report.at1600 = await measureAt(1600, 900, 'review-music-1600.png');
report.at1800 = await measureAt(1800, 1000, 'review-music-1800.png');

/* restore original */
await send('Emulation.setDeviceMetricsOverride', { width: 1694, height: 1063, deviceScaleFactor: 1, mobile: false });
await sleep(500);

/* ---------------------------------------------------- overlay tabs */
await clickByText('.nav-item, button, a', 'Оверлей');
await sleep(1000);
report.overlayScreen = await evaluate(`document.querySelector('.page-title')?.textContent || document.title`);
report.overlayTabs = await evaluate(`(() => {
  const tabs = [...document.querySelectorAll('[role="tab"], .tab, .tabs button, .segmented button')].map((t) => ({ text: t.textContent.trim(), selected: t.getAttribute('aria-selected'), cls: t.className }));
  return tabs;
})()`);
const chatTab = await clickByText('button, [role="tab"]', 'Чат', true, '.page');
await sleep(800);
report.overlayChat = await evaluate(`(() => {
  const body = document.querySelector('.page')?.innerText || '';
  return { clicked: ${JSON.stringify(chatTab)}, text: body.slice(0, 1600) };
})()`);
await shot('review-overlay-chat.png');

const musicTab = await clickByText('button, [role="tab"]', 'Музыка', true, '.page');
await sleep(800);
report.overlayMusic = await evaluate(`(() => {
  const body = document.querySelector('.page')?.innerText || '';
  return { clicked: ${JSON.stringify(musicTab)}, text: body.slice(0, 1600) };
})()`);
await shot('review-overlay-music.png');

report.overlayTabState = await evaluate(`(() => {
  const tabs = [...document.querySelectorAll('[role="tab"], .tab, .tabs button, .segmented button')].map((t) => ({ text: t.textContent.trim(), selected: t.getAttribute('aria-selected'), cls: t.className }));
  return tabs;
})()`);

/* ---------------------------------------------------- back to music */
await clickByText('.nav-item, button, a', 'Музыка');
await sleep(900);

const out = path.join(SHOTS, 'review-report.json');
await writeFile(out, JSON.stringify(report, null, 1), 'utf8');
console.log('report:', out);
console.log(JSON.stringify({
  screen: report.screen,
  transport: report.transport,
  skipDialog: report.skipDialog && { text: report.skipDialog.text?.slice(0, 500), buttons: report.skipDialog.buttons, inputs: report.skipDialog.inputs },
  rules: report.rules?.slice(0, 700),
  queue: report.queue,
  at1600: { gapNextSkip: report.at1600.gapNextSkip, overflow: report.at1600.overflow, bodyScroll: report.at1600.bodyScroll, next: report.at1600.next && [report.at1600.next.x, report.at1600.next.width], skip: report.at1600.skip && [report.at1600.skip.x, report.at1600.skip.width] },
  at1800: { gapNextSkip: report.at1800.gapNextSkip, overflow: report.at1800.overflow, bodyScroll: report.at1800.bodyScroll },
  overlayScreen: report.overlayScreen,
  overlayTabs: report.overlayTabs,
  overlayChat: report.overlayChat?.text?.slice(0, 400),
  overlayMusic: report.overlayMusic?.text?.slice(0, 400),
  overlayTabState: report.overlayTabState,
}, null, 1));

ws.close();
