// Смоук-тесты React-интерфейса Reward Sounds через Chrome DevTools Protocol.
// Запуск: node tests-ui/run.mjs (приложение должно быть закрыто).
// Требуется собранный exe (cargo build --release) и Node.js 20+.
// Тесты безопасны: не создают и не удаляют награды, не меняют настройки.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PORT = Number(process.env.RS_TEST_PORT || 9444);
const root = path.resolve(import.meta.dirname, '..');
const candidates = [
  process.env.RS_TEST_EXE,
  path.join(root, 'src-tauri', 'target', 'release', 'reward-sounds-tauri.exe'),
  path.join(root, 'dist', 'Reward Sounds Tauri.exe'),
].filter(Boolean);
const exe = candidates.find((file) => existsSync(file));
if (!exe) {
  console.error('Не найден исполняемый файл. Соберите: cargo build --release');
  process.exit(2);
}

let failures = 0;
let passed = 0;
const pass = (name) => {
  passed += 1;
  console.log(`PASS  ${name}`);
};
const fail = (name, details) => {
  failures += 1;
  console.log(`FAIL  ${name}${details ? ` — ${details}` : ''}`);
};
const assert = (name, condition, details) => (condition ? pass(name) : fail(name, details));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('exe:', exe);
const child = spawn(exe, [], {
  cwd: path.dirname(exe),
  env: { ...process.env, REWARD_SOUNDS_DEVTOOLS_PORT: String(PORT) },
  stdio: 'ignore',
  detached: false,
});

let ws;
let messageId = 0;
const pending = new Map();
const events = [];

async function connect() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve, { once: true });
          ws.addEventListener('error', reject, { once: true });
        });
        ws.addEventListener('message', (message) => {
          const payload = JSON.parse(message.data);
          if (payload.id && pending.has(payload.id)) {
            const { resolve, reject } = pending.get(payload.id);
            pending.delete(payload.id);
            if (payload.error) reject(new Error(JSON.stringify(payload.error)));
            else resolve(payload.result);
          } else if (!payload.id) {
            events.push(payload);
          }
        });
        return;
      }
    } catch {
      // приложение ещё поднимает порт
    }
    await sleep(400);
  }
  throw new Error('CDP не поднялся за 30 секунд');
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

const consoleErrors = () =>
  events
    .filter(
      (event) =>
        event.method === 'Runtime.exceptionThrown' ||
        (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') ||
        (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error')
    )
    .map((event) =>
      event.method === 'Runtime.exceptionThrown'
        ? event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text
        : event.method === 'Log.entryAdded'
          ? event.params.entry.text
          : event.params.args.map((arg) => arg.value || arg.description).join(' ')
    );

async function clickTab(label) {
  return evaluate(
    `(() => { const el = Array.from(document.querySelectorAll('.nav-item')).find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!el) return false; el.click(); return true; })()`
  );
}

async function run() {
  await connect();
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate(`!!document.querySelector('.app-shell')`)) break;
    await sleep(250);
  }
  await sleep(1200);

  assert('React-интерфейс загрузился', await evaluate(`!!document.querySelector('.app-shell')`));

  const tabs = await evaluate(`Array.from(document.querySelectorAll('.nav-item')).map((b) => b.textContent.trim())`);
  const tabNames = tabs.map((name) => name.replace('proto', '').trim());
  assert('есть вкладки «Награды, Музыка, Оверлей, Настройки, Журнал»', ['Награды', 'Музыка', 'Оверлей', 'Настройки', 'Журнал'].every((name) => tabNames.includes(name)), JSON.stringify(tabs));
  assert('в интерфейсе нет вкладки «Чат»', !tabNames.includes('Чат'), JSON.stringify(tabs));
  assert('нет служебных вкладок прототипа', !tabNames.includes('Дизайн-система'), JSON.stringify(tabs));

  const size = await evaluate(`({ w: innerWidth, h: innerHeight })`);
  assert('окно не меньше 1600×1000', size.w >= 1600 && size.h >= 1000, JSON.stringify(size));

  const state = await evaluate(`window.__TAURI_INTERNALS__.invoke('get_state')`);
  const overview = { connected: state.connected, rewards: state.rewards.length };

  const rewards = await evaluate(`(async () => ({ cards: document.querySelectorAll('.reward-card').length, backend: (await window.__TAURI_INTERNALS__.invoke('get_state')).rewards.length }))()`);
  assert('награды: карточки соответствуют бэкенду', rewards.cards === rewards.backend && rewards.cards >= 0, JSON.stringify(rewards));
  assert('награды: есть первая карточка или пустое состояние', await evaluate(`!!document.querySelector('.reward-card') || !!document.querySelector('.reward-empty')`));

  assert('переключение на «Музыку»', await clickTab('Музыка'));
  await sleep(500);
  assert('музыка: экран открылся', (await evaluate(`document.querySelector('.page-title')?.textContent`)) === 'Музыка');
  assert('музыка: состояние из бэкенда', await evaluate(`!!document.querySelector('.player, .empty-state')`));

  assert('переключение на «Оверлей»', await clickTab('Оверлей'));
  await sleep(900);
  assert('оверлей: экран открылся', (await evaluate(`document.querySelector('.page-title')?.textContent`)) === 'Оверлей чата');
  const preview = await evaluate(`document.querySelector('.overlay-preview__frame')?.src || ''`);
  assert('оверлей: превью — реальный сервер', preview.includes('127.0.0.1:8770/chat-overlay'), preview);

  assert('переключение на «Настройки»', await clickTab('Настройки'));
  await sleep(700);
  assert('настройки: экран открылся', (await evaluate(`document.querySelector('.page-title')?.textContent`)) === 'Настройки');
  const health = await evaluate(`document.querySelectorAll('.health-row').length`);
  assert('настройки: строки здоровья из бэкенда', health > 0, `${health}`);

  assert('переключение на «Журнал»', await clickTab('Журнал'));
  await sleep(1600);
  const logTitle = await evaluate(`document.querySelector('.page-title')?.textContent || ''`);
  assert('журнал: экран открылся', logTitle.includes('Журнал'), logTitle);
  const logRows = await evaluate(`document.querySelectorAll('.log-row').length`);
  assert('журнал: записи загружаются', logRows > 0, `${logRows}`);

  assert('переключение на «Награды»', await clickTab('Награды'));
  await sleep(500);
  const createOpened = await evaluate(
    `(() => { const button = Array.from(document.querySelectorAll('.ui-button')).find((b) => b.textContent.includes('Создать награду')); if (!button) return false; button.click(); return true; })()`
  );
  await sleep(400);
  assert('модалка создания награды открывается', createOpened && (await evaluate(`document.querySelector('.ui-modal__title')?.textContent === 'Новая награда'`)));
  await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);

  // P0-фиксы: буквенные аватары, меню карточки, редактирование.
  assert('в карточках нет буквенных аватаров', (await evaluate(`document.querySelectorAll('.reward-letter').length`)) === 0);

  await evaluate(`document.querySelector('.reward-card .icon-ghost').click(); true`);
  await sleep(250);
  const menuInfo = await evaluate(`(() => {
    const menu = document.querySelector('.reward-menu');
    if (!menu) return null;
    const items = Array.from(menu.querySelectorAll('button')).map((b) => b.textContent.trim());
    const rect = menu.getBoundingClientRect();
    return { items, insideViewport: rect.bottom <= innerHeight && rect.right <= innerWidth };
  })()`);
  assert('меню карточки содержит удаление и не обрезано', Boolean(menuInfo) && menuInfo.items.includes('Удалить награду') && menuInfo.insideViewport, JSON.stringify(menuInfo));
  await evaluate(`Array.from(document.querySelectorAll('.reward-menu button')).find((b) => b.textContent.includes('Удалить')).click(); true`);
  await sleep(300);
  assert('удаление открывает подтверждение', (await evaluate(`document.querySelector('.ui-modal__title')?.textContent || ''`)).includes('Удалить'));
  await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);
  await sleep(200);

  await evaluate(`document.querySelector('.reward-card .icon-ghost').click(); true`);
  await sleep(200);
  await evaluate(`Array.from(document.querySelectorAll('.reward-menu button')).find((b) => b.textContent.includes('Редактировать')).click(); true`);
  await sleep(300);
  const editInfo = await evaluate(`(async () => {
    const state = await window.__TAURI_INTERNALS__.invoke('get_state');
    const first = state.rewards[0];
    return {
      values: Array.from(document.querySelectorAll('.ui-modal input')).map((i) => i.value),
      title: first.title,
      cost: String(first.cost),
      saveDisabled: Array.from(document.querySelectorAll('.ui-modal button')).find((b) => b.textContent.includes('Сохранить'))?.disabled
    };
  })()`);
  assert('редактирование заполнено реальными значениями', editInfo.values[0] === editInfo.title && editInfo.values[1] === editInfo.cost && editInfo.saveDisabled === false, JSON.stringify(editInfo));
  await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);

  // Поиск и список
  await sleep(250);
  const searchBefore = await evaluate(`document.querySelectorAll('.reward-card').length`);
  await evaluate(`(() => {
    const input = document.querySelector('.search-field input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ставка');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  const searchAfter = await evaluate(`document.querySelectorAll('.reward-card').length`);
  assert('поиск наград фильтрует список', searchAfter < searchBefore && searchAfter > 0, `${searchBefore} -> ${searchAfter}`);
  await evaluate(`(() => {
    const input = document.querySelector('.search-field input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(200);
  await evaluate(`Array.from(document.querySelectorAll('.view-switch button')).find((b) => b.textContent.includes('Список')).click(); true`);
  await sleep(250);
  assert('переключатель «Список» работает', await evaluate(`!!document.querySelector('.reward-grid.is-list')`));
  await evaluate(`(() => {
    const cards = document.querySelectorAll('.reward-card');
    const last = cards[cards.length - 1];
    last.scrollIntoView({ block: 'center' });
    last.querySelector('.icon-ghost').click();
    return true;
  })()`);
  await sleep(350);
  const listMenu = await evaluate(`(() => {
    const menu = document.querySelector('.reward-menu');
    if (!menu) return null;
    const r = menu.getBoundingClientRect();
    return { items: Array.from(menu.querySelectorAll('button')).map((b) => b.textContent.trim()), bottom: r.bottom, innerHeight };
  })()`);
  assert('меню нижней карточки в списке не схлопнуто', Boolean(listMenu) && listMenu.items.length === 4 && listMenu.bottom <= listMenu.innerHeight, JSON.stringify(listMenu));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await evaluate(`Array.from(document.querySelectorAll('.view-switch button')).find((b) => b.textContent.includes('Плитка')).click(); true`);
  await sleep(200);

  // Возврат фокуса после модалки.
  await evaluate(`(() => { const b = Array.from(document.querySelectorAll('.ui-button')).find((x) => x.textContent.includes('Создать награду')); b.focus(); b.click(); return true; })()`);
  await sleep(350);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(350);
  assert('фокус возвращается на кнопку после Esc', await evaluate(`document.activeElement?.id === 'create-reward-btn'`));

  // Health popover: Esc.
  await evaluate(`document.querySelector('.health-chip').click(); true`);
  await sleep(250);
  const healthRows = await evaluate(`document.querySelectorAll('.health-popover__rows button').length`);
  assert('health-поповер показывает реальные подсистемы', healthRows >= 5, `${healthRows}`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(200);
  assert('health-поповер закрывается по Esc', await evaluate(`!document.querySelector('.health-popover')`));

  // Music settings: поллинг не перетирает форму.
  await clickTab('Музыка');
  await sleep(400);
  await evaluate(`Array.from(document.querySelectorAll('.ui-button')).find((b) => b.textContent.includes('Настроить музыку')).click(); true`);
  await sleep(300);
  const switchBefore = await evaluate(`(() => { const sw = document.querySelector('.ui-modal .ui-switch'); const before = sw.classList.contains('is-on'); sw.click(); return { before, after: sw.classList.contains('is-on') }; })()`);
  await sleep(1300);
  const switchAfter = await evaluate(`document.querySelector('.ui-modal .ui-switch')?.classList.contains('is-on')`);
  assert('поллинг не перетирает настройки музыки', switchBefore.before !== switchAfter, JSON.stringify({ ...switchBefore, afterPoll: switchAfter }));
  await evaluate(`document.querySelector('.ui-modal__close')?.click(); true`);

  // Fluid shell при maximize.
  await evaluate(`window.__TAURI_INTERNALS__.invoke('win_toggle_maximize'); true`);
  await sleep(800);
  const fluid = await evaluate(`(() => { const shell = document.querySelector('.app-shell'); const r = shell.getBoundingClientRect(); return { inner: [innerWidth, innerHeight], shell: [Math.round(r.width), Math.round(r.height)], left: Math.round(r.left) }; })()`);
  assert('оболочка заполняет maximized-окно', fluid.shell[0] === fluid.inner[0] && fluid.shell[1] === fluid.inner[1] && fluid.left === 0, JSON.stringify(fluid));
  await evaluate(`window.__TAURI_INTERNALS__.invoke('win_toggle_maximize'); true`);
  await sleep(500);

  await sleep(300);
  const errors = consoleErrors();
  assert('нет ошибок в консоли за весь прогон', errors.length === 0, errors.join('; '));
}

run()
  .catch((error) => {
    failures += 1;
    console.error('FAIL  исключение тестового прогона —', error.message);
  })
  .finally(async () => {
    try {
      ws?.close();
    } catch {}
    child.kill();
    await sleep(500);
    console.log(`\nИтог: ${passed} passed, ${failures} failed`);
    process.exit(failures === 0 ? 0 : 1);
  });
