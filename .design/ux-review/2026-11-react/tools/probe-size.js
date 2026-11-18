const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await sleep(400);
  const m = await evalJs(send, `(() => { const s = document.querySelector('.app-shell'); const r = s.getBoundingClientRect(); const c = document.querySelector('.content'); return { innerW: innerWidth, innerH: innerHeight, shell: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, margins: { left: Math.round(r.x), right: Math.round(innerWidth - r.x - r.width), top: Math.round(r.y), bottom: Math.round(innerHeight - r.y - r.height) }, content: { clientH: c.clientHeight, scrollH: c.scrollHeight, clientW: c.clientWidth }, bodyOverflow: getComputedStyle(document.body).overflow, shellMargin: getComputedStyle(s).margin, shellRadius: getComputedStyle(s).borderRadius }; })()`);
  console.log('RESIZED METRICS', JSON.stringify(m, null, 1));
  saveNote('a24-window-1600-metrics', m);
  await screenshot(send, 'a24-window-1600x1000');
  // navigate settings to see bottom cut at 1000
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Настройки')).click()`);
  await sleep(900);
  await screenshot(send, 'a25-window-1600-settings');
  const settingsScroll = await evalJs(send, `({ scrollH: document.querySelector('.content').scrollHeight, clientH: document.querySelector('.content').clientHeight, bottomRowVisible: (() => { const rows = Array.from(document.querySelectorAll('.inline-row')); const last = rows[rows.length - 1]; const r = last.getBoundingClientRect(); return { y: Math.round(r.y), bottom: Math.round(r.bottom), visible: r.bottom <= innerHeight }; })() })`);
  console.log('SETTINGS AT 1600x1000', JSON.stringify(settingsScroll));
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
