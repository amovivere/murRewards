/**
 * Second pass: keyboard, empty-queue next, overlay tabs, screenshots.
 * Run: node scripts/review-app2.mjs  (app must listen on CDP 9333)
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const CDP = 'http://127.0.0.1:9333';
const SHOTS = path.resolve('shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});
let id = 1;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = id++; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
}
async function shot(name) {
  await sleep(450);
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  console.log('shot:', name);
}
async function clickNav(label) {
  return evaluate(`(() => {
    const item = [...document.querySelectorAll('button, a, [role="treeitem"], .nav-item, [class*="nav"]')]
      .find((el) => el.textContent.trim() === ${JSON.stringify(label)} || el.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (!item) return false;
    item.click(); return item.textContent.trim().slice(0, 40);
  })()`);
}

await send('Page.enable');
await send('Runtime.enable');
await sleep(600);
const report = {};

if (!/Музыка/.test(await evaluate(`document.querySelector('.page-title')?.textContent || ''`))) {
  await clickNav('Музыка'); await sleep(900);
}

/* ---------------------------------------------------- keyboard */
const pauseText = () => evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Пауза|Продолжить/.test(x.textContent || ''));
  return b ? b.textContent.trim() : null;
})()`);
report.pauseBefore = await pauseText();
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))`);
await sleep(600);
report.pauseAfterSpace = await pauseText();
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))`);
await sleep(400);

await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true }))`);
await sleep(600);
report.skipViaHotkey = await evaluate(`(() => {
  const d = document.querySelector('.ui-modal, [role="dialog"]');
  return d ? d.innerText.slice(0, 400) : null;
})()`);
await shot('review-hotkey-skip-dialog.png');
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await sleep(400);
let stillOpen = await evaluate(`Boolean(document.querySelector('.ui-modal, [role="dialog"]'))`);
if (stillOpen) {
  await evaluate(`[...document.querySelectorAll('button')].find((b) => /Отмена|×/.test(b.textContent || ''))?.click()`);
  await sleep(400);
}
report.skipClosedByEsc = !(await evaluate(`Boolean(document.querySelector('.ui-modal, [role="dialog"]'))`));

/* ---------------------------------------------------- next with empty queue */
report.nextBefore = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Следующий трек/.test(x.textContent || ''));
  return { text: b?.textContent.trim(), disabled: b?.disabled };
})()`);
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Следующий трек/.test(x.textContent || ''));
  b?.click();
})()`);
await sleep(1600);
report.afterNext = await evaluate(`(() => {
  const stage = [...document.querySelectorAll('.panel, section')].find((n) => /СЕЙЧАС ИГРАЕТ/.test(n.innerText || '')) || document.body;
  const toast = document.querySelector('.ui-toast, [class*="toast"]');
  const queueTitle = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && /^Очередь$/.test(n.textContent.trim()));
  const countText = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && /из 10/.test(n.textContent || ''));
  return {
    stageText: stage.innerText.slice(0, 500),
    toast: toast?.textContent.trim(),
    count: countText?.textContent.trim(),
    hasEmptyState: /Ничего не играет|ничего не играет/.test(document.body.innerText),
  };
})()`);
await shot('review-next-empty-queue.png');

/* ---------------------------------------------------- overlay tabs */
await clickNav('Оверлей');
await sleep(900);
report.overlayScreen = await evaluate(`document.querySelector('.page-title')?.textContent`);
report.tabs = await evaluate(`[...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.textContent.trim().slice(0, 60), selected: t.getAttribute('aria-selected'), controls: t.getAttribute('aria-controls'), cls: t.className }))`);

async function openTab(prefix) {
  await evaluate(`(() => {
    const t = [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(prefix)}));
    t?.click();
  })()`);
  await sleep(900);
}
await openTab('Чат');
report.chatTab = await evaluate(`(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.textContent.trim().slice(0, 30), selected: t.getAttribute('aria-selected') }));
  const body = document.querySelector('main, .page')?.innerText || document.body.innerText;
  return { tabs, text: body.slice(0, 1600) };
})()`);
await shot('review-overlay-tab-chat.png');

await openTab('Музыка');
report.musicTab = await evaluate(`(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.textContent.trim().slice(0, 30), selected: t.getAttribute('aria-selected') }));
  const body = document.querySelector('main, .page')?.innerText || document.body.innerText;
  const frame = document.querySelector('iframe');
  const wrap = frame?.parentElement;
  return {
    tabs,
    text: body.slice(0, 1600),
    frame: frame ? { src: frame.getAttribute('src'), visible: frame.offsetParent !== null, w: frame.clientWidth, h: frame.clientHeight, bg: getComputedStyle(wrap).backgroundColor } : null,
    emptyHintVisible: /Сейчас ничего не играет|Строка появится/.test(body),
  };
})()`);
await shot('review-overlay-tab-music.png');

report.afterTabs = await evaluate(`[...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.textContent.trim().slice(0, 30), selected: t.getAttribute('aria-selected') }))`);

/* back to music for a clean final state */
await clickNav('Музыка');
await sleep(800);

await writeFile(path.join(SHOTS, 'review-report-2.json'), JSON.stringify(report, null, 1), 'utf8');
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
ws.close();
