/**
 * Interaction + screenshots: combined sound+image cards.
 * Run: node scripts/interaction-check.mjs   (dev server on 5177)
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP = process.env.LAB_URL || 'http://127.0.0.1:5177/?v=A';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9337;
const SHOTS = path.resolve('shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = await mkdtemp(path.join(tmpdir(), 'irl-cdp-'));
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40 && !target; i += 1) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch { target = null; }
}
if (!target) { console.error('FAIL: no CDP target'); edge.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let id = 1; const pending = new Map(); const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = id++; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params }));
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
}
async function shot(name, clip) {
  await sleep(320);
  const params = { format: 'png', fromSurface: true };
  if (clip) params.clip = { ...clip, scale: 1 };
  const { data } = await send('Page.captureScreenshot', params);
  await writeFile(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  console.log('shot:', name);
}
async function shotElement(selector, name) {
  const rect = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x + window.scrollX), y: Math.max(0, r.y + window.scrollY), width: r.width, height: r.height }; })()`);
  if (!rect) { console.error('no element', selector); return; }
  await shot(name, rect);
}
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${String(detail).slice(0, 130)})` : ''}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: APP });
for (let i = 0; i < 40; i += 1) {
  await sleep(250);
  if (await evaluate(`Boolean(document.querySelector('[data-testid="card"]'))`)) break;
}

/* ---------------------------------------------------------- состояния карточек */
const cardCount = await evaluate(`document.querySelectorAll('[data-testid="card"]').length`);
check('Плитка A: 8 карточек', cardCount === 8, `${cardCount}`);
const bothChip = await evaluate(`document.querySelector('[data-reward="both-main"] [data-testid="sound-chip"]')?.textContent`);
check('Комбинированная карточка показывает звук в чипе', /newbie\.mp3/.test(bothChip || ''), bothChip);
const bothHasImages = await evaluate(`document.querySelectorAll('[data-reward="both-main"] .poster__photo').length`);
check('Комбинированная карточка показывает стопку картинок', bothHasImages === 3, `${bothHasImages}`);
const soundCardStack = await evaluate(`document.querySelectorAll('[data-reward="sound-main"] .poster__photo').length`);
check('Звуковая карточка без картинок', soundCardStack === 0);
const emptyWarn = await evaluate(`document.querySelector('[data-reward="image-empty"] .card__empty')?.textContent || ''`);
check('Пустая карточка предупреждает', /не сработает/.test(emptyWarn), emptyWarn);
await shot('variant-A-grid.png');
await shotElement('[data-reward="both-main"]', 'state-both.png');
await shotElement('[data-reward="image-main"]', 'state-image.png');
await shotElement('[data-reward="sound-main"]', 'state-sound.png');

/* ---------------------------------------------------------- настройки «оба» */
await evaluate(`document.querySelector('[data-reward="both-main"]').click()`);
await sleep(900);
check('Открылись настройки комбинированной карточки', await evaluate(`Boolean(document.querySelector('.modal--both'))`));
check('Есть секция звука', await evaluate(`Boolean(document.querySelector('[data-testid="sound-section"]'))`));
check('Есть галерея картинок', await evaluate(`Boolean(document.querySelector('[data-testid="media-grid"]'))`));
await shot('settings-both.png');

/* звук: прослушать / заменить / громкость */
await evaluate(`document.querySelector('[data-testid="sound-play"]').click()`);
await sleep(150);
check('Прослушивание включает индикатор «играет»', await evaluate(`/играет/.test(document.querySelector('.sound-file__meta')?.textContent || '')`));
await shot('settings-both-play.png');
const nameBefore = await evaluate(`document.querySelector('[data-testid="sound-file-name"]')?.textContent`);
await evaluate(`document.querySelector('[data-testid="sound-replace"]').click()`);
await sleep(200);
const nameAfter = await evaluate(`document.querySelector('[data-testid="sound-file-name"]')?.textContent`);
check('Звук можно заменить', nameBefore !== nameAfter, `${nameBefore} -> ${nameAfter}`);
await evaluate(`(() => { const el = document.querySelector('[data-testid="sound-volume"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '150'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
const volText = await evaluate(`document.querySelector('[data-testid="sound-volume"]')?.closest('.range-row')?.querySelector('.range-row__value')?.textContent`);
check('Громкость звука меняется до 150%', volText === '150%', volText);

/* картинки: добавить / обложка / удалить */
await evaluate(`document.querySelector('[data-testid="add-media"]').click()`);
await sleep(250);
await evaluate(`document.querySelector('[data-testid="preset-pizza"]').click()`);
await sleep(250);
check('Картинка добавляется (4 / 8)', (await evaluate(`document.querySelector('[data-testid="gallery-counter"]')?.textContent`)) === '4 / 8');
await evaluate(`document.querySelector('[data-testid="media-cover"]').click()`);
await sleep(200);
check('Можно выбрать обложку', await evaluate(`document.querySelectorAll('.thumb.is-cover').length`) === 1);
await evaluate(`document.querySelector('[data-testid="media-remove"]').click()`);
await sleep(250);
check('Картинка удаляется (3 / 8)', (await evaluate(`document.querySelector('[data-testid="gallery-counter"]')?.textContent`)) === '3 / 8');

/* угол + превью, где одновременно звук и картинка */
await evaluate(`(() => { const el = document.querySelector('[data-testid="angle-range"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '25'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
await evaluate(`document.querySelector('[data-testid="preview-show"]').click()`);
await sleep(650);
const previewState = await evaluate(`(() => {
  const img = document.querySelector('.stage [data-testid="preview-image"]');
  const readout = img?.closest('.stage')?.querySelector('[data-testid="readout"]')?.textContent || '';
  const sound = document.querySelector('.stage [data-testid="preview-sound"]')?.textContent || '';
  return { visible: Boolean(img), readout, sound };
})()`);
check('Превью показывает картинку под углом', previewState.visible && /угол/.test(previewState.readout), previewState.readout);
check('Превью одновременно играет звук', /звук/.test(previewState.sound), previewState.sound);
check('Угол в пределах заданных ±25°', (() => { const m = /угол ([+-]?\d+(?:\.\d+)?)°/.exec(previewState.readout); return m ? Math.abs(Number(m[1])) <= 25 : false; })(), previewState.readout);
await shot('settings-both-preview.png');

/* переключение режимов */
await evaluate(`document.querySelector('[data-testid="mode-sound"]').click()`);
await sleep(400);
check('Режим «только звук»: галерея скрыта', !(await evaluate(`Boolean(document.querySelector('[data-testid="media-grid"]'))`)));
await evaluate(`document.querySelector('[data-testid="mode-image"]').click()`);
await sleep(400);
check('Режим «только картинки»: секция звука скрыта', !(await evaluate(`Boolean(document.querySelector('[data-testid="sound-section"]'))`)));
await evaluate(`document.querySelector('[data-testid="mode-both"]').click()`);
await sleep(300);
await evaluate(`document.querySelector('[data-testid="save-settings"]').click()`);
await sleep(350);
check('Сохранение показывает тост', /сохранены/.test(await evaluate(`document.querySelector('.toast')?.textContent || ''`)));

/* ---------------------------------------------------------- OBS-превью с обеими частями */
await evaluate(`document.querySelector('[data-testid="demo-show"]').click()`);
await sleep(750);
const globalPreview = await evaluate(`(() => {
  const img = document.querySelector('.modal--preview [data-testid="preview-image"]');
  const readout = document.querySelector('.modal--preview [data-testid="readout"]')?.textContent || '';
  const sound = document.querySelector('.modal--preview [data-testid="preview-sound"]')?.textContent || '';
  return { visible: Boolean(img), readout, sound };
})()`);
check('Кнопка «Показать в OBS» показывает картинку', globalPreview.visible, globalPreview.readout);
check('Кнопка «Показать в OBS» запускает звук', /звук/.test(globalPreview.sound), globalPreview.sound);
await shot('preview-both.png');
const firstReadout = globalPreview.readout;
await evaluate(`document.querySelector('.modal--preview [data-testid="preview-show"]').click()`);
await sleep(650);
const secondReadout = await evaluate(`document.querySelector('.modal--preview [data-testid="readout"]')?.textContent || ''`);
check('«Показать ещё раз» перебрасывает позицию/угол', secondReadout !== firstReadout, `${firstReadout} → ${secondReadout}`);
await evaluate(`document.querySelector('.modal--preview .stage__bottom .btn--ghost')?.click()`);
await sleep(300);

/* ---------------------------------------------------------- список и вариант B */
await evaluate(`document.querySelector('[data-testid="view-list"]').click()`);
await sleep(400);
check('Список показывает 8 строк', (await evaluate(`document.querySelectorAll('.row').length`)) === 8);
await shot('list-view.png');
await evaluate(`document.querySelector('[data-testid="view-grid"]').click()`);
await evaluate(`document.querySelector('[data-testid="variant-b"]').click()`);
await sleep(500);
check('Вариант B и URL ?v=B', /v=B/.test(await evaluate(`window.location.search`)));
await shot('variant-B-grid.png');
await evaluate(`document.querySelector('[data-reward="both-main"]').click()`);
await sleep(900);
check('Редактор B трёхколоночный', (await evaluate(`getComputedStyle(document.querySelector('.modal--b .settings-layout')).gridTemplateColumns`)).split(' ').length >= 3);
await shot('settings-both-B.png');

const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} checks passed`);
if (errors.length) console.log('runtime errors:\n' + errors.slice(0, 3).join('\n'));
ws.close(); edge.kill(); await sleep(400);
await rm(dir, { recursive: true, force: true }).catch(() => {});
process.exit(fail.length || errors.length ? 1 : 0);
