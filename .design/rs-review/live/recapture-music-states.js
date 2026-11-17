const { connect, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  // Дождёмся, пока сервис найдёт yt-dlp, чтобы мок-скриншот не выглядел как ошибка.
  for (let i = 0; i < 30; i += 1) {
    const ready = await evaluate(`window.RS?.state?.view?.music?.ytdlp_version || null`);
    if (ready) {
      console.log('yt-dlp ready:', ready);
      break;
    }
    await sleep(500);
  }
  await evaluate(`window.RS.pollNow(); true`);
  await sleep(400);
  await evaluate(`window.RS.pausePolling(true); true`);
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
  await sleep(600);
  await screenshot(send, 'design-pack/10-music-queue-states');
  console.log('recaptured 10-music-queue-states');
  await evaluate(`window.RS.state.view = window.__origView; window.RS.render('music'); window.RS.pausePolling(false); window.RS.pollNow(); true`);
  await sleep(800);
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
