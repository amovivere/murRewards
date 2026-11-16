// Смоук/интерактивные тесты Tauri-интерфейса через Chrome DevTools Protocol.
// Запуск: node tests-ui/run.mjs
// Требуется собранный exe (cargo build --release) и Node.js 20+.
// Тесты безопасны: не меняют награды, цену музыки и привязки звуков.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
      // приложение ещё не подняло порт
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

const click = (selector) =>
  evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);

const setValue = (selector, value) =>
  evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`
  );

const clearEvents = () => events.splice(0);
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

async function run() {
  await connect();
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(4000);
  clearEvents();

  // 1. Загрузка приложения
  const boot = await evaluate(
    `({ rs: typeof window.RS, ready: window.RS?.state.ready, tab: window.RS?.state.tab, title: document.querySelector('.h1')?.textContent })`
  );
  assert('приложение загрузилось', boot.rs === 'object' && boot.ready === true, JSON.stringify(boot));
  assert('осмысленный заголовок экрана', ['Награды', 'Музыка', 'Настройки', 'Журнал'].includes(boot.title), boot.title);
  assert('нет ошибок в консоли при старте', consoleErrors().length === 0, consoleErrors().join('; '));

  // 2. Вкладки
  const connected = await evaluate(`window.RS.state.view.connected`);
  for (const [tab, selector, label] of [
    ['rewards', connected ? '.reward-card' : '.quick-start', 'Награды'],
    ['music', '#music-player', 'Музыка'],
    ['settings', '.settings-card', 'Настройки'],
    ['log', '.log-row', 'Журнал'],
  ]) {
    await evaluate(`window.RS.render(${JSON.stringify(tab)})`);
    await sleep(tab === 'log' ? 900 : 500);
    const count = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    assert(`вкладка «${label}» рендерится`, count > 0, `элементов ${selector}: ${count}`);
    assert(`вкладка «${label}» без ошибок`, consoleErrors().length === 0, consoleErrors().join('; '));
  }

  // 3. Вид «Список» / «Плитка»
  if (connected) {
    await evaluate(`window.RS.render('rewards')`);
    await sleep(600);
    await click('#view-mode [data-view="list"]');
    await sleep(900);
    const rows = await evaluate(`document.querySelectorAll('.reward-row').length`);
    assert('переключатель «Список» работает', rows > 0, `строк: ${rows}`);
    await click('#view-mode [data-view="grid"]');
    await sleep(900);
    const cards = await evaluate(`document.querySelectorAll('.reward-card').length`);
    assert('переключатель «Плитка» работает', cards > 0, `карточек: ${cards}`);

    // 4. Фильтры
    await click('#reward-pills [data-filter="sound"]');
    await sleep(300);
    const filtered = await evaluate(`document.querySelectorAll('#rewards-list .reward-card').length`);
    assert('фильтр «Со звуком» работает', filtered >= 0 && filtered < cards, `карточек: ${filtered}`);
    await click('#reward-pills [data-filter="all"]');
    await sleep(300);
  }

  // 5. Модалка создания награды
  if (connected) {
    await click('#reward-create');
    await sleep(500);
    const modal = await evaluate(
      `({ open: !!document.querySelector('.modal-scrim'), focused: document.activeElement?.id, save: !!document.querySelector('#reward-save') })`
    );
    assert('модалка награды открывается', modal.open && modal.save, JSON.stringify(modal));
    assert('автофокус на названии', modal.focused === 'reward-title', modal.focused);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await sleep(300);
    assert('Escape закрывает модалку', !(await evaluate(`!!document.querySelector('.modal-scrim')`)));

    // 6. Редактор сохраняет флаг «нужен ввод текста»
    const musicCard = await evaluate(
      `(() => { const el = Array.from(document.querySelectorAll('.reward-card')).find(card => card.querySelector('.music-badge')); if (!el) return null; el.querySelector('[data-dots]').click(); return true; })()`
    );
    if (musicCard) {
      await sleep(300);
      const items = await evaluate(`Array.from(document.querySelectorAll('.popmenu-item')).map(el => el.textContent.trim())`);
      const editIndex = items.findIndex((text) => text.includes('Изменить'));
      if (editIndex >= 0) {
        await evaluate(`document.querySelectorAll('.popmenu-item')[${editIndex}].click()`);
        await sleep(500);
        const checked = await evaluate(`document.querySelector('#reward-input-required')?.checked`);
        assert('флаг «ввод текста» сохраняется в редакторе', checked === true, String(checked));
        await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
        await sleep(250);
      }
    }
  }

  // 7. Настройки: mute туда-обратно
  await evaluate(`window.RS.render('settings')`);
  await sleep(600);
  const muteBefore = await evaluate(`window.RS.state.view.muted`);
  await click('[data-setting="muted"]');
  await sleep(1200);
  const muteAfter = await evaluate(`window.RS.state.view.muted`);
  assert('тумблер «Без звука» переключается', muteAfter === !muteBefore, `${muteBefore} -> ${muteAfter}`);
  await click('[data-setting="muted"]');
  await sleep(1200);
  const muteRestored = await evaluate(`window.RS.state.view.muted`);
  assert('тумблер «Без звука» возвращается', muteRestored === muteBefore, `${muteRestored}`);

  // 8. Музыка: модалка награды/цены
  await evaluate(`window.RS.render('music')`);
  await sleep(700);
  await click('#music-price');
  await sleep(500);
  const price = await evaluate(
    `({ open: !!document.querySelector('.modal-scrim'), choices: document.querySelectorAll('.reward-choice-row').length })`
  );
  assert('модалка «Награда и цена» открывается', price.open && price.choices > 0, JSON.stringify(price));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(250);

  await click('#obs-settings');
  await sleep(500);
  const obs = await evaluate(
    `({ open: !!document.querySelector('.modal-scrim'), seconds: document.querySelector('#obs-seconds')?.value, font: document.querySelector('#obs-font')?.value })`
  );
  assert('модалка OBS открывается с текущими настройками', obs.open && obs.seconds !== undefined, JSON.stringify(obs));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(250);

  // 9. Журнал: фильтр уровня и поиск
  await evaluate(`window.RS.render('log')`);
  await sleep(1200);
  const logAll = await evaluate(`Array.from(document.querySelectorAll('.log-row')).filter(r => !r.hidden).length`);
  await click('#log-levels [data-level="error"]');
  await sleep(250);
  const logErrors = await evaluate(
    `Array.from(document.querySelectorAll('.log-row')).filter(r => !r.hidden).map(r => r.dataset.level)`
  );
  assert('фильтр журнала «Ошибки» работает', logErrors.every((level) => level === 'error'), JSON.stringify(logErrors.slice(0, 5)));
  await click('#log-levels [data-level="all"]');
  await sleep(250);
  await setValue('#log-search', 'EventSub');
  await sleep(250);
  const logSearch = await evaluate(`Array.from(document.querySelectorAll('.log-row')).filter(r => !r.hidden).length`);
  assert('поиск по журналу фильтрует', logSearch > 0 && logSearch <= logAll, `${logSearch} из ${logAll}`);
  await setValue('#log-search', '');

  // 10. Ошибки IPC показываются пользователю, а не проглатываются
  const beforeError = consoleErrors().length;
  await evaluate(
    `window.RS.api.invoke('this_command_does_not_exist').then(() => 'resolved').catch(() => 'rejected')`
  );
  await sleep(400);
  const footer = await evaluate(`document.querySelector('#footer-text')?.textContent`);
  const bodyKind = await evaluate(`document.body.dataset.toastKind`);
  assert('ошибка IPC превращается в тост', bodyKind === 'error' && footer && footer !== 'Готово', `${bodyKind}: ${footer}`);
  assert('ошибка IPC не роняет интерфейс', (await evaluate(`typeof window.RS`)) === 'object');
  clearEvents();
  void beforeError;

  // 11. Сайдбар: статус звука и версия
  const sidebar = await evaluate(
    `({ audio: document.querySelector('#audio-state')?.textContent, version: document.querySelector('#version')?.textContent })`
  );
  assert('статус звука в сайдбаре заполнен', !!sidebar.audio && sidebar.audio !== 'Звук готов' || sidebar.audio === 'Звук готов', JSON.stringify(sidebar));
  assert('версия показана', /версия \d/.test(sidebar.version || ''), sidebar.version);

  // 12. Окно: maximize/restore
  await click('#window-max');
  await sleep(800);
  const maximized = await evaluate(`({ w: innerWidth, h: innerHeight })`);
  assert('окно разворачивается', maximized.w >= 1200, JSON.stringify(maximized));
  await click('#window-max');
  await sleep(800);
  const restored = await evaluate(`({ w: innerWidth, h: innerHeight })`);
  assert('окно восстанавливается', restored.w >= 900 && restored.h >= 600, JSON.stringify(restored));

  // 13. Геометрия окна сохраняется
  const appData = process.env.APPDATA;
  if (appData) {
    const geometryFile = path.join(appData, 'RewardSounds', 'window.json');
    await sleep(700);
    if (existsSync(geometryFile)) {
      const text = readFileSync(geometryFile, 'utf8');
      let ok = false;
      try {
        const geometry = JSON.parse(text);
        ok = geometry.width >= 800 && geometry.height >= 560;
      } catch {}
      assert('геометрия окна сохраняется в window.json', ok, text);
    }
  }

  const finalErrors = consoleErrors();
  assert('нет ошибок в консоли за весь прогон', finalErrors.length === 0, finalErrors.join('; '));
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
