const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).find((b) => b.title === 'Закрыть').click()`);
  await sleep(1500);
  const alive = await evalJs(send, `({ responsive: true, title: document.title, hasTauri: Boolean(window.__TAURI_INTERNALS__) })`);
  console.log('after close click page alive:', JSON.stringify(alive));
  saveNote('e0-close-click', alive);
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
