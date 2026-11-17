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
  await sleep(4000);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  const errors = events.filter(
    (m) =>
      m.method === 'Runtime.exceptionThrown' ||
      (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') ||
      (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
  );
  console.log('console errors:', errors.map((m) =>
    m.method === 'Runtime.exceptionThrown'
      ? m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text
      : m.method === 'Log.entryAdded'
        ? m.params.entry.text
        : m.params.args.map((a) => a.value || a.description).join(' ')
  ));
  console.log('health:', JSON.stringify(await evaluate(`({state: document.querySelector('#health-chip')?.dataset.state, text: document.querySelector('#health-text')?.textContent, items: window.RS.state.view?.health?.length, footer: document.querySelector('#footer-version')?.textContent})`)));
  await screenshot(send, 'status-rewards');
  await evaluate(`document.querySelector('#health-chip').click()`);
  await sleep(400);
  await screenshot(send, 'status-popover');
  console.log('popover:', JSON.stringify(await evaluate(`({open: !!document.querySelector('.health-popover'), rows: document.querySelectorAll('.health-popover .health-row').length})`)));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(300);
  await evaluate(`window.RS.render('settings')`);
  await sleep(800);
  await screenshot(send, 'status-settings');
  console.log('settings health card:', JSON.stringify(await evaluate(`({card: !!document.querySelector('#settings-health'), rows: document.querySelectorAll('#settings-health .health-row').length})`)));
  // ошибка IPC → тост
  await evaluate(`window.RS.api.invoke('this_command_does_not_exist').catch(() => {}); true`);
  await sleep(500);
  await screenshot(send, 'status-toast');
  console.log('toast:', JSON.stringify(await evaluate(`(() => { const t = document.querySelector('.toast.toast-error'); return {exists: !!t, text: t?.querySelector('.toast-text')?.textContent, action: t?.querySelector('.toast-action')?.textContent}; })()`)));
  await evaluate(`document.querySelector('#settings-menu')?.click()`);
  await sleep(300);
  await screenshot(send, 'status-settings-menu');
  console.log('settings menu:', JSON.stringify(await evaluate(`Array.from(document.querySelectorAll('.popmenu-item')).map(el => el.textContent.trim())`)));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
