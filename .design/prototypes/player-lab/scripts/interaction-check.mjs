/**
 * Headless interaction check for the Player Lab concept.
 * Drives Edge through CDP (no extra deps) and verifies the core player
 * behaviours that a reviewer is expected to try by hand.
 *
 * Run: node scripts/interaction-check.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = process.env.PLAYER_LAB_URL || 'http://127.0.0.1:5175/?v=A';
const PORT = 9331;

const dir = await mkdtemp(path.join(tmpdir(), 'player-lab-cdp-'));
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${dir}`,
  '--window-size=1440,1000',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

let target = null;
for (let i = 0; i < 40 && !target; i += 1) {
  await sleep(250);
  try {
    const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    target = list.find((t) => t.type === 'page');
  } catch {
    target = null;
  }
}
if (!target) {
  console.error('FAIL: Edge DevTools endpoint did not start');
  edge.kill();
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  return result.result?.value;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: APP });

for (let i = 0; i < 40; i += 1) {
  await sleep(250);
  const ready = await evaluate(`Boolean(document.querySelector('.now__title'))`);
  if (ready) break;
}

const title0 = await evaluate(`document.querySelector('.now__title')?.textContent || ''`);
check('Плеер отрисован', Boolean(title0), title0);

/* 1. pause / resume */
await evaluate(`document.querySelector('.play-btn').click()`);
await sleep(200);
const paused = await evaluate(`document.querySelector('.play-btn')?.getAttribute('aria-label')`);
check('Play/pause переключается', paused === 'Продолжить', `aria-label=${paused}`);
await evaluate(`document.querySelector('.play-btn').click()`);
await sleep(150);

/* 2. next track (досрочное завершение, без возврата баллов) */
const queueFirst = await evaluate(`document.querySelector('.queue__row .queue__title')?.textContent || ''`);
await evaluate(`document.querySelector('.transport__next').click()`);
await sleep(900);
const titleNext = await evaluate(`document.querySelector('.now__title')?.textContent || ''`);
check('«Следующий трек» включает следующий из очереди', titleNext === queueFirst, `${titleNext}`);
const logNext = await evaluate(`[...document.querySelectorAll('.activity__text')].map(n => n.textContent).join(' | ')`);
check('«Следующий» пишет в журнал без возврата баллов', /Завершён досрочно/.test(logNext) && !/Пропуск/.test(logNext), logNext.slice(0, 80));

/* 3. skip dialog -> refund -> toast -> undo */
const titleBeforeSkip = await evaluate(`document.querySelector('.now__title')?.textContent || ''`);
await evaluate(`document.querySelector('.transport__skip').click()`);
await sleep(250);
const modalOpen = await evaluate(`Boolean(document.querySelector('.modal'))`);
check('«Пропустить» открывает диалог с причиной и возвратом', modalOpen);
await evaluate(`document.querySelector('.modal .btn--danger').click()`);
await sleep(600);
const toast = await evaluate(`document.querySelector('.toast')?.textContent || ''`);
check('Пропуск возвращает баллы и показывает undo', /Пропущен/.test(toast) && /Вернуть/.test(toast), toast);
const logSkip = await evaluate(`[...document.querySelectorAll('.activity__text')].map(n => n.textContent).join(' | ')`);
check('Пропуск пишет причину и возврат в журнал', /Пропуск:/.test(logSkip) && /Возврат/.test(logSkip), logSkip.slice(0, 90));
await evaluate(`document.querySelector('.toast button')?.click()`);
await sleep(400);
const titleAfterUndo = await evaluate(`document.querySelector('.now__title')?.textContent || ''`);
check('Undo возвращает пропущенный трек', titleAfterUndo === titleBeforeSkip, titleAfterUndo);

/* 4. seek — дождаться окончания буферизации после undo */
for (let i = 0; i < 25; i += 1) {
  await sleep(200);
  const busy = await evaluate(`Boolean(document.querySelector('.play-btn .spinner'))`);
  if (!busy) break;
}
await evaluate(`(() => {
  const el = document.querySelector('.seek');
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + r.height / 2, pointerId: 1 }));
  return true;
})()`);
await sleep(300);
const seekState = await evaluate(`(() => {
  const el = document.querySelector('.seek');
  return { now: Number(el.getAttribute('aria-valuenow')), max: Number(el.getAttribute('aria-valuemax')) };
})()`);
check('Seek перематывает трек', seekState.now > seekState.max * 0.3, JSON.stringify(seekState));

/* 5. volume */
await evaluate(`(() => {
  const el = document.querySelector('.range');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, '80');
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await sleep(200);
const volume = await evaluate(`document.querySelector('.volume__value')?.textContent`);
check('Громкость меняется', volume === '80%', volume);

/* 6. add link -> queue grows */
const queueLenBefore = await evaluate(`document.querySelectorAll('.queue__row').length`);
await evaluate(`(() => {
  const el = document.querySelector('.add-row__field input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, 'https://youtu.be/dQw4w9WgXcQ');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
})()`);
await sleep(400);
const queueLenAfter = await evaluate(`document.querySelectorAll('.queue__row').length`);
check('Ссылка добавляется в очередь', queueLenAfter === queueLenBefore + 1, `${queueLenBefore} -> ${queueLenAfter}`);

/* 7. variant switch to B */
await evaluate(`document.querySelectorAll('.segmented button')[1].click()`);
await sleep(300);
const isB = await evaluate(`document.querySelector('.app')?.classList.contains('app--B')`);
const urlB = await evaluate(`window.location.search`);
check('Переключение A/B работает и пишется в URL', isB && /v=B/.test(urlB), urlB);

/* 8. keyboard space in variant B */
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))`);
await sleep(200);
const kbPaused = await evaluate(`document.querySelector('.play-btn')?.getAttribute('aria-label')`);
check('Space ставит на паузу', kbPaused === 'Продолжить', `aria-label=${kbPaused}`);

const fail = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${String(r.detail).slice(0, 110)})` : ''}`);
}
console.log(`\n${results.length - fail.length}/${results.length} checks passed`);

ws.close();
edge.kill();
await sleep(400);
await rm(dir, { recursive: true, force: true }).catch(() => {});
process.exit(fail.length ? 1 : 0);
