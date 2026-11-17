const { connect, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  const events = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (!m.id) events.push(m);
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(3800);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  const errors = events.filter(
    (m) => m.method === 'Runtime.exceptionThrown' || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
  );
  console.log('errors:', errors.slice(0, 3).map((m) => m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.exception?.description : m.params.entry.text));

  await evaluate(`window.RS.render('rewards')`);
  await sleep(900);
  await screenshot(send, 't3-grid-1220');
  console.log('grid 1220:', JSON.stringify(await evaluate(`({
    grid: document.querySelectorAll('#rewards-list.grid .reward-card').length,
    list: document.querySelectorAll('#rewards-list.reward-list .reward-row').length,
    cols: getComputedStyle(document.querySelector('#rewards-list.grid')).gridTemplateColumns,
    cardH: document.querySelector('.reward-card')?.offsetHeight,
    colsCount: window.RS.state.view?.grid_view,
    modeActive: document.querySelector('#view-mode .active')?.dataset.view,
  })`)));

  // 980x680: должен включиться список по умолчанию + рейл-сайдбар + «Фильтры»
  await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 680, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  await evaluate(`document.querySelector('#content').dataset.rendered = ''; window.RS.render('rewards')`);
  await sleep(900);
  await screenshot(send, 't4-980-rewards');
  console.log('980 rewards:', JSON.stringify(await evaluate(`({
    rows: document.querySelectorAll('#rewards-list .reward-row').length,
    cards: document.querySelectorAll('#rewards-list .reward-card').length,
    sidebarW: document.querySelector('#sidebar')?.offsetWidth,
    filtersVisible: getComputedStyle(document.querySelector('#rewards-filters')).display !== 'none',
    pillsVisible: getComputedStyle(document.querySelector('#reward-pills')).display !== 'none',
    volumeVisible: getComputedStyle(document.querySelector('.rr-volume')).display !== 'none',
    toolbarRows: new Set(Array.from(document.querySelectorAll('.toolbar > *')).map(el => Math.round(el.getBoundingClientRect().top))).size,
  })`)));
  await evaluate(`document.querySelector('#rewards-filters').click()`);
  await sleep(350);
  await screenshot(send, 't4-980-filters');
  console.log('filters menu:', JSON.stringify(await evaluate(`Array.from(document.querySelectorAll('.popmenu-item')).map(el => el.textContent.trim())`)));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);

  await evaluate(`window.RS.render('music')`);
  await sleep(900);
  await screenshot(send, 't4-980-music');
  await evaluate(`window.RS.render('settings')`);
  await sleep(900);
  await screenshot(send, 't4-980-settings');
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`window.RS.render('rewards')`);
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
