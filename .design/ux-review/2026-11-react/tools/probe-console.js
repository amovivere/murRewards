const { connect, evalJs, sleep, saveNote } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  const events = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      events.push({ type: 'console', level: m.params.type, text: (m.params.args || []).map((a) => a.value || a.description || a.type).join(' ').slice(0, 300) });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      events.push({ type: 'exception', text: (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300) });
    }
    if (m.method === 'Log.entryAdded') {
      events.push({ type: 'log', level: m.params.entry.level, text: m.params.entry.text.slice(0, 300), url: m.params.entry.url || '' });
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await sleep(1000);
  const tabs = ['Награды', 'Музыка', 'Оверлей', 'Настройки', 'Журнал'];
  for (const t of tabs) {
    await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(${JSON.stringify(t)})).click()`);
    await sleep(1200);
  }
  await sleep(1000);
  const filtered = events.filter((e) => !/favicon|DevTools/.test(e.text));
  console.log('CONSOLE EVENTS', JSON.stringify(filtered.slice(0, 40), null, 1));
  saveNote('g0-console', filtered);
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
