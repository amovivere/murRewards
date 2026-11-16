const { connect, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  const events = [];
  const orig = ws.onmessage;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (!m.id) events.push(m);
    if (orig) orig(e);
  };
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(3500);

  let totalErrors = 0;
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      console.log('EVAL ERROR:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return null;
    }
    return r.result.value;
  };
  const report = (label) => {
    const found = events.splice(0).filter(
      (m) =>
        m.method === 'Runtime.exceptionThrown' ||
        (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') ||
        (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    );
    for (const m of found) {
      totalErrors += 1;
      console.log(
        `[${label}]`,
        m.method === 'Runtime.exceptionThrown'
          ? m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text
          : m.method === 'Log.entryAdded'
            ? m.params.entry.text
            : m.params.args.map((a) => a.value || a.description).join(' ')
      );
    }
  };
  const click = async (selector) => {
    const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
    if (!ok) console.log('MISSING CLICK TARGET:', selector);
    return ok;
  };
  const setInput = async (selector, value, eventName = 'input') => {
    return evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(eventName)}, {bubbles:true})); return true; })()`);
  };
  const check = async (label, expression) => {
    const value = await evaluate(expression);
    console.log(label, JSON.stringify(value));
    report(label);
    return value;
  };

  // ---- Награды
  await evaluate(`window.RS.render('rewards')`);
  await sleep(600);
  await check('rewards initial', `({cards: document.querySelectorAll('.reward-card').length, rows: document.querySelectorAll('.reward-row').length, disabledBlock: !!document.querySelector('#disabled-block')})`);
  await click('#view-mode [data-view="list"]');
  await sleep(900);
  await check('list view', `({rows: document.querySelectorAll('.reward-row').length, cards: document.querySelectorAll('.reward-card').length, grid: window.RS.state.view.grid_view})`);
  await click('#view-mode [data-view="grid"]');
  await sleep(900);
  await check('grid view', `({cards: document.querySelectorAll('.reward-card').length, rows: document.querySelectorAll('.reward-row').length, grid: window.RS.state.view.grid_view})`);

  await click('#reward-pills [data-filter="disabled"]');
  await sleep(300);
  await check('disabled filter', `({cards: document.querySelectorAll('#rewards-list .reward-card').length, isDisabled: Array.from(document.querySelectorAll('#rewards-list .reward-card')).every(el => el.classList.contains('is-disabled'))})`);
  await click('#reward-pills [data-filter="all"]');
  await sleep(300);

  await click('#disabled-toggle');
  await sleep(300);
  await check('disabled expanded', `({disabledCards: document.querySelectorAll('#disabled-grid .reward-card').length, chev: document.querySelector('#disabled-toggle .chev')?.textContent})`);

  await click('#local-toggle');
  await sleep(300);
  await check('local expanded', `({locals: document.querySelectorAll('.local-binding').length})`);

  await setInput('#reward-search', 'zzz-not-found');
  await sleep(400);
  await check('empty search', `({empty: !!document.querySelector('.empty-card'), reset: !!document.querySelector('[data-empty-action="reset"]')})`);
  await click('[data-empty-action="reset"]');
  await sleep(400);
  await check('reset search', `({cards: document.querySelectorAll('.reward-card').length, value: document.querySelector('#reward-search')?.value})`);

  await click('#rewards-menu');
  await sleep(300);
  await check('rewards menu', `({items: document.querySelectorAll('.popmenu-item').length})`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);

  // ---- Настройки
  await evaluate(`window.RS.render('settings')`);
  await sleep(600);
  await check('settings initial', `({cards: document.querySelectorAll('.settings-card').length, save: document.querySelector('#settings-save-state')?.textContent})`);
  const mutedBefore = await evaluate(`window.RS.state.view.muted`);
  await click('[data-setting="muted"]');
  await sleep(1200);
  const mutedAfter = await evaluate(`({muted: window.RS.state.view.muted, body: document.body.classList.contains('muted'), toggle: document.querySelector('[data-setting="muted"]')?.classList.contains('on')})`);
  console.log('mute toggle', JSON.stringify({ mutedBefore, mutedAfter }));
  await click('[data-setting="muted"]');
  await sleep(1200);
  await check('mute reverted', `({muted: window.RS.state.view.muted, body: document.body.classList.contains('muted')})`);
  await click('#open-music-settings');
  await sleep(400);
  await check('music settings modal', `({open: !!document.querySelector('.modal-scrim'), maxQueue: document.querySelector('#ms-max-queue')?.value})`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);

  // ---- Журнал
  await evaluate(`window.RS.render('log')`);
  await sleep(1200);
  await check('log initial', `({rows: document.querySelectorAll('.log-row').length, visible: Array.from(document.querySelectorAll('.log-row')).filter(r=>!r.hidden).length, count: document.querySelector('#log-count')?.textContent})`);
  await click('#log-levels [data-level="error"]');
  await sleep(200);
  await check('log errors filter', `({visible: Array.from(document.querySelectorAll('.log-row')).filter(r=>!r.hidden).length, levels: Array.from(document.querySelectorAll('.log-row')).filter(r=>!r.hidden).map(r=>r.dataset.level).slice(0,5)})`);
  await click('#log-levels [data-level="all"]');
  await sleep(200);
  await setInput('#log-search', 'EventSub');
  await sleep(200);
  await check('log search', `({visible: Array.from(document.querySelectorAll('.log-row')).filter(r=>!r.hidden).length, focused: document.activeElement?.id})`);
  await setInput('#log-search', '');
  await sleep(200);

  // ---- Музыка
  await evaluate(`window.RS.render('music')`);
  await sleep(700);
  await check('music initial', `({player: !!document.querySelector('#music-player'), queue: document.querySelectorAll('.queue-row').length, clearDisabled: document.querySelector('#queue-clear')?.disabled, obsDisabled: document.querySelector('#obs-show-now')?.disabled})`);
  await click('#music-menu');
  await sleep(300);
  await check('music menu', `({items: document.querySelectorAll('.popmenu-item').length})`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);
  await click('#music-price');
  await sleep(400);
  await check('music price modal', `({open: !!document.querySelector('.modal-scrim'), choices: document.querySelectorAll('.reward-choice-row').length, active: document.querySelector('.reward-choice-row.active')?.textContent.trim().slice(0,20)})`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);
  await click('#obs-settings');
  await sleep(400);
  await check('obs modal values', `({seconds: document.querySelector('#obs-seconds')?.value, font: document.querySelector('#obs-font')?.value, pos: document.querySelector('#obs-pos .active')?.dataset.pos})`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(200);
  await click('#ytdlp-pill');
  await sleep(700);
  await check('ytdlp recheck', `({version: window.RS.state.view.music.ytdlp_version, footer: document.querySelector('#footer-text')?.textContent})`);

  // ---- Онбординг
  await evaluate(`window.RS.render('onboarding')`);
  await sleep(500);
  await click('#onb-local-toggle');
  await sleep(300);
  await check('onboarding local expand', `({locals: document.querySelectorAll('.local-binding').length})`);

  // ---- Окно (развернуть/восстановить)
  await click('#window-max');
  await sleep(800);
  await check('window maximized', `({w: window.innerWidth, h: window.innerHeight})`);
  await click('#window-max');
  await sleep(800);
  await check('window restored', `({w: window.innerWidth, h: window.innerHeight})`);

  await screenshot(send, 'ui-actions-final');
  console.log('TOTAL ERRORS:', totalErrors);
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
