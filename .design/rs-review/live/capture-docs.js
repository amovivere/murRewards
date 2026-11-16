const { connect, sleep, screenshot } = require('./cdp');
const fs = require('fs');
const path = require('path');

const screens = path.resolve(__dirname, '..', '..', '..', 'reward-sounds-tauri', 'screens');

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
    const file = await screenshot(send, name);
    console.log('shot', name);
    return file;
  };
  const copy = (from, to) => {
    fs.copyFileSync(from, path.join(screens, to));
    console.log('saved screens/' + to);
  };

  await evaluate(`window.RS.render('rewards')`);
  await sleep(700);
  copy(await shot('final-rewards'), 'tauri-rewards-real.png');

  if (await evaluate(`!!document.querySelector('#view-mode [data-view="list"]')`)) {
    await evaluate(`document.querySelector('#view-mode [data-view="list"]').click()`);
    await sleep(1000);
    copy(await shot('final-rewards-list'), 'tauri-rewards-list.png');
    await evaluate(`document.querySelector('#view-mode [data-view="grid"]').click()`);
    await sleep(1000);
  }

  await evaluate(`window.RS.render('music')`);
  await sleep(800);
  copy(await shot('final-music'), 'tauri-music-real.png');

  await evaluate(`window.RS.render('settings')`);
  await sleep(800);
  copy(await shot('final-settings'), 'tauri-settings-real.png');
  await evaluate(`document.querySelector('.content').scrollTop = 999999`);
  await sleep(400);
  copy(await shot('final-settings-bottom'), 'tauri-settings-bottom.png');
  await evaluate(`document.querySelector('.content').scrollTop = 0`);

  await evaluate(`window.RS.render('log')`);
  await sleep(1200);
  copy(await shot('final-log'), 'tauri-log-real.png');

  // Первый запуск в офлайн-состоянии: глушим опрос, чтобы шапка осталась офлайн.
  await evaluate(`(() => {
    window.__origInvoke = window.__TAURI__.core.invoke;
    window.__TAURI__.core.invoke = () => Promise.resolve(null);
    window.RS.state.view = Object.assign({}, window.RS.state.view, { connected: false, eventsub: 'stopped' });
    window.RS.render('onboarding');
    return true;
  })()`);
  await sleep(500);
  copy(await shot('final-onboarding'), 'tauri-onboarding.png');
  await evaluate(`window.__TAURI__.core.invoke = window.__origInvoke; window.RS.pollNow(); true`);
  await sleep(700);

  // Модалки
  await evaluate(`window.RS.render('rewards')`);
  await sleep(700);
  await evaluate(`document.querySelector('#reward-create')?.click()`);
  await sleep(500);
  copy(await shot('final-modal-reward'), 'tauri-reward-modal.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(300);

  await evaluate(`window.RS.render('music')`);
  await sleep(700);
  await evaluate(`document.querySelector('#music-price')?.click()`);
  await sleep(500);
  copy(await shot('final-modal-price'), 'tauri-music-price.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(300);

  await evaluate(`document.querySelector('#obs-settings')?.click()`);
  await sleep(500);
  copy(await shot('final-modal-obs'), 'tauri-obs.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(300);

  // Вернуть приложение в нормальное состояние
  await evaluate(`window.RS.render('rewards'); window.RS.pollNow(); true`);
  await sleep(500);
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
