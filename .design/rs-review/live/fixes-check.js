const { connect, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(4000);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  const shot = async (name) => {
    await screenshot(send, `fix-${name}.png`);
    console.log('shot', name);
  };

  await evaluate(`window.RS.render('rewards')`);
  await sleep(800);
  await shot('grid');

  // Мок «играет»: проверяем, что индикатор не сдвигает карточки.
  await evaluate(`window.RS.pausePolling(true); true`);
  await evaluate(`(() => {
    window.__orig = window.RS.state.view;
    const view = structuredClone(window.__orig);
    view.grid_view = true;
    const first = (view.rewards || []).find((reward) => reward.file);
    view.playing = first ? [first.id, first.id] : [];
    window.RS.state.view = view;
    document.querySelector('#content').dataset.rendered = '';
    window.RS.render('rewards');
    return true;
  })()`);
  await sleep(700);
  await shot('grid-playing');
  console.log('heights:', JSON.stringify(await evaluate(`Array.from(document.querySelectorAll('.reward-card')).map(card => card.offsetHeight)`)));
  console.log('playing badges:', await evaluate(`document.querySelectorAll('.tile-playing').length`));
  await evaluate(`document.querySelector('#view-mode [data-view="list"]').click()`);
  await sleep(900);
  await shot('list-playing');
  await evaluate(`window.RS.state.view = window.__orig; window.RS.pausePolling(false); window.RS.pollNow(); true`);
  await sleep(900);

  // Модалка с палитрой
  await evaluate(`window.RS.render('rewards')`);
  await sleep(600);
  await evaluate(`document.querySelector('#reward-create').click()`);
  await sleep(500);
  await shot('color-modal');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  // Журнал: новые сверху + очистка
  await evaluate(`window.RS.render('log')`);
  await sleep(1300);
  await shot('log');
  console.log('log:', JSON.stringify(await evaluate(`({
    first: document.querySelector('.log-row .log-time')?.textContent,
    second: document.querySelectorAll('.log-row')[1]?.querySelector('.log-time')?.textContent,
    clear: !!document.querySelector('#log-clear'),
    scrollTop: document.querySelector('#log-card')?.scrollTop,
  })`)));

  // Сайдбар: система внизу
  await evaluate(`window.RS.render('settings')`);
  await sleep(800);
  await shot('sidebar');
  console.log('sidebar:', JSON.stringify(await evaluate(`({
    mainBottom: Math.round(document.querySelector('.sidebar-main').getBoundingClientRect().bottom),
    systemTop: Math.round(document.querySelector('.sidebar-system').getBoundingClientRect().top),
    sidebarH: document.querySelector('#sidebar').offsetHeight,
  })`)));

  // Плеер без трека
  await evaluate(`window.RS.render('music')`);
  await sleep(900);
  await shot('player-empty');
  console.log('player:', JSON.stringify(await evaluate(`({
    current: !!window.RS.state.view?.music?.current,
    playDisabled: document.querySelector('#play-toggle')?.disabled,
    cursor: getComputedStyle(document.querySelector('#play-toggle')).cursor,
  })`)));
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
