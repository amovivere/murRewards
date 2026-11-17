const { connect, sleep, screenshot } = require('./cdp');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, 'design-pack');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name) => {
    const file = await screenshot(send, path.join('design-pack', name));
    console.log('shot', name);
    return file;
  };

  // Чистое состояние + базовые экраны
  await evaluate(`window.RS.pollNow(); true`);
  await sleep(1200);
  await evaluate(`window.RS.render('rewards')`);
  await sleep(700);
  await shot('01-rewards-grid');

  await evaluate(`window.RS.render('music')`);
  await sleep(700);
  await shot('02-music');

  await evaluate(`window.RS.render('settings')`);
  await sleep(700);
  await shot('03-settings-top');
  await evaluate(`document.querySelector('.content').scrollTop = 999999`);
  await sleep(400);
  await shot('04-settings-bottom');
  await evaluate(`document.querySelector('.content').scrollTop = 0`);

  await evaluate(`window.RS.render('log')`);
  await sleep(1200);
  await shot('05-log');

  // Награды: список, выключенные, локальные, пустой поиск
  await evaluate(`window.RS.render('rewards')`);
  await sleep(700);
  await evaluate(`document.querySelector('#view-mode [data-view="list"]').click()`);
  await sleep(1000);
  await shot('06-rewards-list');
  await evaluate(`document.querySelector('#view-mode [data-view="grid"]').click()`);
  await sleep(900);

  await evaluate(`document.querySelector('#disabled-toggle')?.click()`);
  await sleep(400);
  await evaluate(`document.querySelector('#local-toggle')?.click()`);
  await sleep(400);
  await shot('07-rewards-expanded-blocks');
  await evaluate(`document.querySelector('#disabled-toggle')?.click(); document.querySelector('#local-toggle')?.click(); true`);
  await sleep(300);

  await evaluate(`(() => { const el = document.querySelector('#reward-search'); el.value='zzz-not-found'; el.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
  await sleep(400);
  await shot('08-rewards-empty-search');
  await evaluate(`document.querySelector('[data-empty-action="reset"]')?.click()`);
  await sleep(400);

  // Плашка ошибки наград (временный мок)
  await evaluate(`(() => {
    window.__origView = window.RS.state.view;
    window.RS.state.view = Object.assign({}, window.__origView, { rewards_error: 'Не удалось загрузить награды: Twitch вернул 503. Попробуйте ещё раз.' });
    window.RS.render('rewards');
    return true;
  })()`);
  await sleep(500);
  await shot('09-rewards-error-banner');
  await evaluate(`window.RS.state.view = window.__origView; window.RS.render('rewards'); window.RS.pollNow(); true`);
  await sleep(800);

  // Музыка: мок очереди и префетча
  await evaluate(`(() => {
    window.__origView = window.RS.state.view;
    const view = structuredClone(window.__origView);
    view.music.items = [
      { id: 'a1', video_id: 'v1', title: 'ДИНАСТИЯ — Земляк', user_login: 'nix', channel: 'YouTube', duration_sec: 164, state: 'playing', prefetched: false },
      { id: 'a2', video_id: 'v2', title: 'Vulvas — Kanye West', user_login: 'goshanmur', channel: 'YouTube', duration_sec: 213, state: 'loading', prefetched: false },
      { id: 'a3', video_id: 'v3', title: 'run.mp3', user_login: 'viewer1', channel: 'YouTube', duration_sec: 6, state: 'queued', prefetched: true },
      { id: 'a4', video_id: 'v4', title: 'Ночной дрифт — длинное название трека для проверки обрезки', user_login: 'viewer2', channel: 'YouTube', duration_sec: 245, state: 'queued', prefetched: false },
    ];
    view.music.prefetched = 'v3';
    view.music.prefetched_title = 'run.mp3';
    view.music.current = view.music.items[0];
    view.music.player = { loaded: true, paused: false, position_sec: 58, duration_sec: 164 };
    window.RS.state.view = view;
    window.RS.render('music');
    return true;
  })()`);
  await sleep(700);
  await shot('10-music-queue-states');
  await evaluate(`window.RS.state.view = window.__origView; window.RS.render('music'); window.RS.pollNow(); true`);
  await sleep(900);

  // Меню
  await evaluate(`window.RS.render('rewards')`);
  await sleep(600);
  await evaluate(`document.querySelector('#rewards-menu')?.click()`);
  await sleep(350);
  await shot('11-rewards-menu');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);

  await evaluate(`window.RS.render('music')`);
  await sleep(600);
  await evaluate(`document.querySelector('#music-menu')?.click()`);
  await sleep(350);
  await shot('12-music-menu');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);

  // Модалки
  await evaluate(`window.RS.render('rewards')`);
  await sleep(600);
  await evaluate(`document.querySelector('#reward-create')?.click()`);
  await sleep(500);
  await shot('13-modal-reward-new');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  // Редактор существующей награды + confirm удаления
  await evaluate(`(() => { const card = document.querySelector('.reward-card'); card?.querySelector('[data-dots]')?.click(); return true; })()`);
  await sleep(350);
  await evaluate(`(() => { const items = Array.from(document.querySelectorAll('.popmenu-item')); const edit = items.find(i => i.textContent.includes('Изменить')); edit?.click(); return true; })()`);
  await sleep(500);
  await shot('14-modal-reward-edit');
  await evaluate(`document.querySelector('#reward-delete')?.click()`);
  await sleep(500);
  await shot('15-confirm-delete');
  await evaluate(`document.querySelector('[data-act="cancel"]')?.click()`);
  await sleep(300);
  await evaluate(`window.RS.pollNow(); true`);
  await sleep(600);

  await evaluate(`window.RS.render('music')`);
  await sleep(600);
  await evaluate(`document.querySelector('#music-price')?.click()`);
  await sleep(500);
  await shot('16-modal-music-price');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);
  await evaluate(`document.querySelector('#music-menu').click()`);
  await sleep(300);
  await evaluate(`Array.from(document.querySelectorAll('.popmenu-item')).find(i => i.textContent.includes('Настройки музыки'))?.click()`);
  await sleep(500);
  await shot('17-modal-music-settings');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);
  await evaluate(`document.querySelector('#obs-settings')?.click()`);
  await sleep(500);
  await shot('18-modal-obs');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  // Ошибка IPC (тост)
  await evaluate(`window.RS.api.invoke('this_command_does_not_exist').catch(() => {}); true`);
  await sleep(600);
  await shot('19-toast-error');
  await sleep(4500);

  // Офлайн-онбординг
  await evaluate(`(() => {
    window.__origInvoke = window.__TAURI__.core.invoke;
    window.__TAURI__.core.invoke = () => Promise.resolve(null);
    window.__origView = window.RS.state.view;
    window.RS.state.view = Object.assign({}, window.__origView, { connected: false, eventsub: 'stopped' });
    window.RS.render('onboarding');
    return true;
  })()`);
  await sleep(500);
  await shot('20-onboarding-offline');
  await evaluate(`window.__TAURI__.core.invoke = window.__origInvoke; window.RS.state.view = window.__origView; window.RS.render('rewards'); window.RS.pollNow(); true`);
  await sleep(900);

  // Минимальный размер 980x680
  await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 680, deviceScaleFactor: 1, mobile: false });
  for (const [tab, name] of [
    ['rewards', '21-980-rewards'],
    ['music', '22-980-music'],
    ['settings', '23-980-settings'],
    ['log', '24-980-log'],
  ]) {
    await evaluate(`window.RS.render('${tab}')`);
    await sleep(tab === 'log' ? 900 : 600);
    await shot(name);
  }
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`window.RS.render('rewards'); window.RS.pollNow(); true`);
  await sleep(600);

  console.log('done, files in', outDir);
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
