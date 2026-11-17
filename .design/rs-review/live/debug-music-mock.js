const { connect, sleep } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  console.log('tab before', await evaluate(`({tab: window.RS.state.tab, rendered: document.querySelector('#content')?.dataset.rendered})`));
  await evaluate(`(() => {
    window.__origInvoke2 = window.__TAURI__.core.invoke;
    window.__TAURI__.core.invoke = () => Promise.resolve(null);
    window.__origView2 = window.RS.state.view;
    const view = structuredClone(window.__origView2);
    view.music.items = [
      { id: 'a1', video_id: 'v1', title: 'ДИНАСТИЯ — Земляк', user_login: 'nix', channel: 'YouTube', duration_sec: 164, state: 'playing', prefetched: false },
      { id: 'a2', video_id: 'v2', title: 'Vulvas — Kanye West', user_login: 'goshanmur', channel: 'YouTube', duration_sec: 213, state: 'loading', prefetched: false },
      { id: 'a3', video_id: 'v3', title: 'run.mp3', user_login: 'viewer1', channel: 'YouTube', duration_sec: 6, state: 'queued', prefetched: true }
    ];
    view.music.prefetched = 'v3';
    view.music.current = view.music.items[0];
    view.music.player = { loaded: true, paused: false, position_sec: 58, duration_sec: 164 };
    window.RS.state.view = view;
    window.RS.render('music');
    return true;
  })()`);
  await sleep(400);
  console.log('after set', await evaluate(`({
    tab: window.RS.state.tab,
    items: window.RS.state.view.music.items.length,
    rows: document.querySelectorAll('.queue-row').length,
    queueTitle: document.querySelector('.queue-title')?.textContent,
    playerTitle: document.querySelector('#player-title')?.textContent,
    contentRendered: document.querySelector('#content')?.dataset.rendered
  })`));
  await evaluate(`window.__TAURI__.core.invoke = window.__origInvoke2; window.RS.state.view = window.__origView2; window.RS.pollNow(); true`);
  await sleep(600);
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
