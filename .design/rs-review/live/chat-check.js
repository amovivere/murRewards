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
  await sleep(4500);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  const errors = events.filter(
    (m) => m.method === 'Runtime.exceptionThrown' || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
  );
  console.log('errors:', errors.slice(0, 4).map((m) => m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.exception?.description : m.params.entry.text));
  console.log('chat view:', JSON.stringify(await evaluate(`(() => { const c = window.RS.state.view?.chat || {}; return {enabled:c.enabled, connected:c.connected, read_only:c.read_only, error:c.error, login:c.login, messages:(c.messages||[]).length, overlay:c.overlay_url, settings:c.settings, health:(window.RS.state.view?.health||[]).find(i=>i.key==='chat')}; })()`)));
  await evaluate(`window.RS.render('chat')`);
  await sleep(900);
  await screenshot(send, 'chat-tab');
  console.log('chat ui:', JSON.stringify(await evaluate(`({
    grid: !!document.querySelector('.chat-grid'),
    cards: document.querySelectorAll('.chat-card').length,
    commands: document.querySelectorAll('.chat-command').length,
    overlayUrl: document.querySelector('#chat-overlay-url')?.textContent,
    inputDisabled: document.querySelector('#chat-input')?.disabled,
    pills: Array.from(document.querySelectorAll('#chat-pills .pill')).map(el => el.textContent.trim()),
    readOnlyBanner: !!document.querySelector('#chat-readonly'),
  })`)));
  await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 680, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  await evaluate(`document.querySelector('#content').dataset.rendered = ''; window.RS.render('chat')`);
  await sleep(700);
  await screenshot(send, 'chat-980');
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
