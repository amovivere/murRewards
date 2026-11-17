const { connect, sleep, screenshot } = require('./cdp');
const path = require('path');
const fs = require('fs');

const outDir = path.resolve(__dirname, '..', '..', '..', 'reward-sounds-tauri', 'screens');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(4200);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name) => {
    await send('Emulation.clearDeviceMetricsOverride');
    await screenshot(send, path.join(outDir, name));
    console.log('shot', name);
  };

  await evaluate(`window.RS.pollNow(); true`);
  await sleep(1200);

  await evaluate(`window.RS.render('rewards')`);
  await sleep(900);
  await shot('tauri-rewards-real.png');

  await evaluate(`document.querySelector('#view-mode [data-view="list"]').click()`);
  await sleep(1000);
  await shot('tauri-rewards-list.png');
  await evaluate(`document.querySelector('#view-mode [data-view="grid"]').click()`);
  await sleep(900);

  await evaluate(`document.querySelector('#health-chip').click()`);
  await sleep(400);
  await shot('tauri-status-popover.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  await evaluate(`window.RS.render('music')`);
  await sleep(900);
  await shot('tauri-music-real.png');
  await evaluate(`document.querySelector('#music-menu').click()`);
  await sleep(250);
  await evaluate(`Array.from(document.querySelectorAll('.popmenu-item')).find(el => el.textContent.includes('Награда и цена'))?.click()`);
  await sleep(500);
  await shot('tauri-music-price.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);
  await evaluate(`document.querySelector('#obs-settings').click()`);
  await sleep(500);
  await shot('tauri-obs.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  await evaluate(`window.RS.render('settings')`);
  await sleep(1000);
  await shot('tauri-settings-real.png');
  await evaluate(`document.querySelector('.content').scrollTop = 999999`);
  await sleep(400);
  await shot('tauri-settings-bottom.png');
  await evaluate(`document.querySelector('.content').scrollTop = 0`);

  await evaluate(`window.RS.render('log')`);
  await sleep(1200);
  await shot('tauri-log-real.png');

  await evaluate(`window.RS.render('rewards')`);
  await sleep(400);
  await evaluate(`document.querySelector('#health-chip').click()`);
  await sleep(300);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  // Чат: лента с демонстрационными сообщениями (реальные сообщения в канал не пишем)
  await evaluate(`window.RS.pausePolling(true); true`);
  await evaluate(`(() => {
    window.__origView = window.RS.state.view;
    const view = structuredClone(window.__origView);
    const now = Date.now();
    view.chat = Object.assign({}, view.chat, {
      connected: true,
      read_only: false,
      login: view.login,
      error: null,
      messages: [
        { id: 'm1', at_ms: now - 260000, user: 'nix', display_name: 'nix', color: '#FF7A00', text: 'привет всем', is_moderator: false, is_broadcaster: false },
        { id: 'm2', at_ms: now - 220000, user: 'goshanmur', display_name: 'goshanmur', color: null, text: 'начинаем через 5 минут', is_moderator: true, is_broadcaster: true },
        { id: 'm3', at_ms: now - 180000, user: 'druzhba', display_name: 'druzhba', color: '#00C8FF', text: '!queue', is_moderator: false, is_broadcaster: false },
        { id: 'm4', at_ms: now - 120000, user: 'spamer123', display_name: 'spamer123', color: '#FF5A5F', text: '!трек https://youtu.be/dQw4w9WgXcQ', is_moderator: false, is_broadcaster: false },
        { id: 'm5', at_ms: now - 90000, user: 'viewer1', display_name: 'viewer1', color: '#8B00FF', text: 'трек топ', is_moderator: false, is_broadcaster: false },
        { id: 'm6', at_ms: now - 40000, user: 'goshanmur', display_name: 'goshanmur', color: null, text: '!song', is_moderator: true, is_broadcaster: true }
      ]
    });
    window.RS.state.view = view;
    window.RS.render('chat');
    return true;
  })()`);
  await sleep(800);
  await shot('tauri-chat-feed.png');
  const chatScroll = await evaluate(`(() => { const f = document.querySelector('#chat-feed'); if (f) f.scrollTop = 9999; return true; })()`);
  await sleep(250);
  await shot('tauri-chat-real.png');
  await evaluate(`window.RS.state.view = window.__origView; window.RS.pausePolling(false); window.RS.pollNow(); window.RS.render('chat'); true`);
  await sleep(1200);
  await shot('tauri-chat-real.png');

  // Ошибка IPC → тост
  await evaluate(`window.RS.api.invoke('this_command_does_not_exist').catch(() => {}); true`);
  await sleep(500);
  await shot('tauri-toast-error.png');
  await evaluate(`document.querySelectorAll('.toast').forEach((node) => node.remove()); true`);

  // Онбординг
  await evaluate(`document.querySelector('#content').dataset.rendered = ''; window.RS.render('onboarding')`);
  await sleep(900);
  await shot('tauri-onboarding.png');

  // Модалка создания награды
  await evaluate(`window.RS.render('rewards')`);
  await sleep(700);
  await evaluate(`document.querySelector('#reward-create').click()`);
  await sleep(500);
  await shot('tauri-reward-modal.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  // 980×680
  await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 680, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  await evaluate(`document.querySelector('#content').dataset.rendered = ''; window.RS.render('rewards')`);
  await sleep(800);
  await screenshot(send, path.join(outDir, 'tauri-980-rewards.png'));
  console.log('shot tauri-980-rewards.png');
  await evaluate(`window.RS.render('chat')`);
  await sleep(700);
  await screenshot(send, path.join(outDir, 'tauri-980-chat.png'));
  console.log('shot tauri-980-chat.png');
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`window.RS.render('rewards'); window.RS.pollNow(); true`);
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
