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

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    }
    return r.result.value;
  };

  const errors = [];
  const report = () => {
    const newErrors = events.filter(
      (m) =>
        m.method === 'Runtime.exceptionThrown' ||
        (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) ||
        (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    );
    events.length = 0;
    for (const m of newErrors) {
      const text =
        m.method === 'Runtime.exceptionThrown'
          ? `EXCEPTION ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`
          : m.method === 'Log.entryAdded'
            ? `LOG ${m.params.entry.level} ${m.params.entry.text}`
            : `CONSOLE ${m.params.args.map((a) => a.value || a.description).join(' ')}`;
      errors.push(text);
      console.log(text);
    }
    return newErrors.length;
  };

  const tabs = [
    ['rewards', `window.RS.render('rewards')`],
    ['music', `window.RS.render('music')`],
    ['settings', `window.RS.render('settings')`],
    ['log', `window.RS.render('log')`],
  ];
  for (const [name, expression] of tabs) {
    await evaluate(expression);
    await sleep(name === 'log' ? 900 : 500);
    await screenshot(send, `ui-tour-${name}`);
    report();
    const summary = await evaluate(`(() => ({
      cards: document.querySelectorAll('.reward-card').length,
      rows: document.querySelectorAll('.queue-row').length,
      settingsCards: document.querySelectorAll('.settings-card').length,
      logRows: document.querySelectorAll('.log-row').length,
      player: !!document.querySelector('#music-player'),
      title: document.querySelector('.h1')?.textContent,
    }))()`);
    console.log(name, JSON.stringify(summary));
  }

  // Модалки музыки
  await evaluate(`window.RS.render('music')`);
  await sleep(400);
  await evaluate(`document.querySelector('#music-price')?.click()`);
  await sleep(400);
  await screenshot(send, 'ui-tour-modal-price');
  console.log('price modal', JSON.stringify(await evaluate(`({open: !!document.querySelector('.modal-scrim'), choices: document.querySelectorAll('.reward-choice-row').length})`)));
  report();
  await evaluate(`document.querySelector('.modal-close')?.click()`);
  await sleep(250);

  await evaluate(`document.querySelector('#obs-settings')?.click()`);
  await sleep(400);
  await screenshot(send, 'ui-tour-modal-obs');
  console.log('obs modal', JSON.stringify(await evaluate(`({open: !!document.querySelector('.modal-scrim'), seconds: document.querySelector('#obs-seconds')?.value, font: document.querySelector('#obs-font')?.value})`)));
  report();
  await evaluate(`document.querySelector('.modal-close')?.click()`);
  await sleep(250);

  await evaluate(`document.querySelector('#music-menu')?.click()`);
  await sleep(300);
  await screenshot(send, 'ui-tour-menu');
  report();
  await evaluate(`document.querySelector('.popmenu')?.remove()`);

  // Редактор награды
  await evaluate(`window.RS.render('rewards')`);
  await sleep(500);
  await evaluate(`document.querySelector('#reward-create')?.click()`);
  await sleep(400);
  await screenshot(send, 'ui-tour-modal-reward');
  console.log('reward modal', JSON.stringify(await evaluate(`({open: !!document.querySelector('.modal-scrim'), autofocus: document.activeElement?.id})`)));
  report();
  await evaluate(`document.querySelector('.modal-close')?.click()`);
  await sleep(250);

  // Онбординг
  await evaluate(`window.RS.render('onboarding')`);
  await sleep(500);
  await screenshot(send, 'ui-tour-onboarding');
  report();
  console.log('onboarding', JSON.stringify(await evaluate(`({steps: document.querySelectorAll('.quick-step').length, locals: document.querySelectorAll('.local-binding').length})`)));

  console.log('TOTAL ERRORS:', errors.length);
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
