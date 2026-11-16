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
    if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };

  console.log('== events ==');
  for (const m of events) {
    if (m.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION:', m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description || '');
    } else if (m.method === 'Log.entryAdded') {
      console.log('LOG:', m.params.entry.level, m.params.entry.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      console.log('CONSOLE ERROR:', m.params.args.map((a) => a.value || a.description).join(' '));
    }
  }
  console.log('== state ==');
  console.log('RS:', JSON.stringify(await evaluate('typeof window.RS')));
  console.log('view:', JSON.stringify(await evaluate('window.RS && {tab: window.RS.state.tab, ready: window.RS.state.ready, connected: window.RS.state.view?.connected, rewards: window.RS.state.view?.rewards?.length, local: window.RS.state.view?.local_bindings?.length, music: window.RS.state.view?.music?.ready, audio: window.RS.state.view?.audio_ready, eventsub: window.RS.state.view?.eventsub}')));
  console.log('content:', JSON.stringify(await evaluate('document.getElementById("content")?.innerHTML.slice(0, 200)')));
  console.log('nav:', JSON.stringify(await evaluate('Array.from(document.querySelectorAll(".nav-item.active")).map(e=>e.textContent.trim())')));

  const file = await screenshot(send, 'ui-new-rewards');
  console.log('shot', file);
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
