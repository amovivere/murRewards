const { connect, evalJs, sleep, screenshot } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await sleep(300);
  const m = await evalJs(send, `(() => { const s = document.querySelector('.app-shell').getBoundingClientRect(); return { innerW: innerWidth, innerH: innerHeight, shellW: Math.round(s.width), shellH: Math.round(s.height), left: Math.round(s.x), top: Math.round(s.y), rightMargin: Math.round(innerWidth - (s.x + s.width)), bottomMargin: Math.round(innerHeight - (s.y + s.height)) }; })()`);
  console.log(JSON.stringify(m));
  await screenshot(send, 'a26-window-min-1600x1000');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Настройки')).click()`);
  await sleep(900);
  await screenshot(send, 'a27-window-min-settings');
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
