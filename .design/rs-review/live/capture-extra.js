const { connect, evalJs, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  const tag = process.env.TAG || 'base';

  // 1. Music page scrolled to the bottom at min size.
  await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 680, deviceScaleFactor: 1, mobile: false });
  await evalJs(send, `(() => { try { window.RS.render('music'); } catch (e) {} true })()`);
  await sleep(500);
  await evalJs(send, `(() => { const c = document.querySelector('.content'); c.scrollTop = c.scrollHeight; return c.scrollHeight; })()`);
  await sleep(350);
  await screenshot(send, `${tag}-980x680-music-bottom`);
  console.log('shot music bottom');

  // 2. Modals at default size.
  await send('Emulation.setDeviceMetricsOverride', { width: 1220, height: 840, deviceScaleFactor: 1, mobile: false });
  await evalJs(send, `(() => { try { window.RS.render('music'); } catch (e) {} true })()`);
  await sleep(400);
  await evalJs(send, `document.querySelector('#obs-header')?.click(); true`);
  await sleep(400);
  await screenshot(send, `${tag}-modal-obs`);
  console.log('shot obs modal');
  await evalJs(send, `document.querySelector('#obs-close')?.click(); true`);
  await sleep(250);

  await evalJs(send, `(() => { try { window.RS.render('rewards'); } catch (e) {} true })()`);
  await sleep(500);
  await evalJs(send, `document.querySelector('.head-actions .btn-primary')?.click(); true`);
  await sleep(400);
  await screenshot(send, `${tag}-modal-reward`);
  console.log('shot reward modal');
  await evalJs(send, `document.querySelector('#reward-modal-close')?.click(); true`);

  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
