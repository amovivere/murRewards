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

  await sleep(500);
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
