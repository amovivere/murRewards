const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  const m = async () => evalJs(send, `(() => ({ innerW: innerWidth, innerH: innerHeight, active: document.activeElement?.tagName || null, time: Date.now() }))()`);
  console.log('before minimize', JSON.stringify(await m()));

  // click minimize
  await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).find((b) => b.title === 'Свернуть').click()`);
  await sleep(1600);
  console.log('after minimize (page still responsive?)', JSON.stringify(await m()));
  saveNote('d0-minimize', { ok: true });
  // NOTE: restore happens from PowerShell between phases; script continues below via second script

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
