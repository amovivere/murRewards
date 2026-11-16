const { connect, sleep } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  const events = [];
  // cdp.js's connect doesn't expose events; patch by intercepting messages.
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
  const logs = events.filter((m) => m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded');
  for (const m of logs) {
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      console.log('EXCEPTION:', d.text, d.exception?.description || '');
    } else {
      const e = m.params.entry;
      console.log('LOG:', e.level, e.source, e.text);
    }
  }
  if (!logs.length) console.log('no exceptions/console logs');
  const state = await evalJsSimple(send, `({tab: window.RS?.state?.tab, connected: window.RS?.state?.connected, rewards: window.RS?.state?.core?.rewards?.length, cards: document.querySelectorAll('.reward-card').length})`);
  console.log('state', JSON.stringify(state));
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function evalJsSimple(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
