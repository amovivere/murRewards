const { connect, sleep, screenshot } = require('./cdp');

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
    await screenshot(send, `design-pack/${name}`);
    console.log('shot', name);
  };

  await evaluate(`window.RS.pollNow(); true`);
  await sleep(1200);
  await evaluate(`window.RS.pausePolling(true); true`);

  // 1. Музыка: мок очереди с состояниями и префетчем.
  await evaluate(`(() => {
    window.__origView = window.RS.state.view;
    const view = structuredClone(window.__origView);
    view.connected = true;
    view.eventsub = 'listening';
    view.music.items = [
      { id: 'a1', video_id: 'v1', title: 'ДИНАСТИЯ — Земляк', user_login: 'nix', channel: 'YouTube', duration_sec: 164, state: 'playing', prefetched: false },
      { id: 'a2', video_id: 'v2', title: 'Vulvas — Kanye West', user_login: 'goshanmur', channel: 'YouTube', duration_sec: 213, state: 'loading', prefetched: false },
      { id: 'a3', video_id: 'v3', title: 'run.mp3', user_login: 'viewer1', channel: 'YouTube', duration_sec: 6, state: 'queued', prefetched: true },
      { id: 'a4', video_id: 'v4', title: 'Ночной дрифт — длинное название трека для проверки обрезки', user_login: 'viewer2', channel: 'YouTube', duration_sec: 245, state: 'queued', prefetched: false }
    ];
    view.music.prefetched = 'v3';
    view.music.prefetched_title = 'run.mp3';
    view.music.current = view.music.items[0];
    view.music.player = { loaded: true, paused: false, position_sec: 58, duration_sec: 164 };
    window.RS.state.view = view;
    window.RS.render('music');
    return true;
  })()`);
  await sleep(500);
  await shot('10-music-queue-states');

  // 2. Награды: плашка ошибки загрузки.
  await evaluate(`(() => {
    const view = structuredClone(window.__origView);
    view.rewards_error = 'Не удалось загрузить награды: Twitch вернул 503. Попробуйте ещё раз.';
    window.RS.state.view = view;
    window.RS.render('rewards');
    return true;
  })()`);
  await sleep(500);
  await shot('09-rewards-error-banner');

  // Возврат к реальному состоянию
  await evaluate(`window.RS.state.view = window.__origView; window.RS.render('rewards'); window.RS.pausePolling(false); window.RS.pollNow(); true`);
  await sleep(1000);

  // 3. Безопасный фокус в подтверждении удаления.
  await evaluate(`(() => { const card = document.querySelector('.reward-card'); card?.querySelector('[data-dots]')?.click(); return true; })()`);
  await sleep(350);
  await evaluate(`(() => { const edit = Array.from(document.querySelectorAll('.popmenu-item')).find(i => i.textContent.includes('Изменить')); edit?.click(); return true; })()`);
  await sleep(500);
  await evaluate(`document.querySelector('#reward-delete')?.click()`);
  await sleep(500);
  await shot('15-confirm-delete');
  console.log('focused in confirm:', await evaluate(`document.activeElement?.textContent?.trim()`));
  await evaluate(`document.querySelector('[data-act="cancel"]')?.click()`);
  await sleep(300);
  await evaluate(`window.RS.pollNow(); true`);
  await sleep(700);
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
