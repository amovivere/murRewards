const { connect, sleep, screenshot } = require('./cdp');
const path = require('path');
const OUT = path.resolve(__dirname, '..', '..', '..', 'reward-sounds-tauri', 'screens');

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(4500);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name) => {
    await screenshot(send, path.join(OUT, name));
    console.log('shot', name);
  };

  await evaluate(`window.RS.render('rewards'); window.RS.state.view.grid_view = true; document.querySelector('#content').dataset.rendered=''; window.RS.render('rewards')`);
  await sleep(900);
  await shot('tauri-rewards-real.png');
  await evaluate(`document.querySelector('#view-mode [data-view="list"]')?.click()`);
  await sleep(900);
  await shot('tauri-rewards-list.png');
  await evaluate(`document.querySelector('#view-mode [data-view="grid"]')?.click()`);
  await sleep(700);

  await evaluate(`window.RS.render('settings')`);
  await sleep(900);
  await evaluate(`document.querySelector('#settings-appearance')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  await shot('tauri-appearance.png');
  await evaluate(`document.querySelectorAll('#accent-palette .color-preset')[2]?.click()`);
  await sleep(900);
  await shot('tauri-accent-blue.png');
  await evaluate(`document.querySelector('#accent-reset')?.click()`);
  await sleep(1200);

  await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 680, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  await evaluate(`document.querySelector('#content').dataset.rendered=''; window.RS.render('rewards')`);
  await sleep(900);
  await screenshot(send, path.join(OUT, 'tauri-980-rewards.png'));
  console.log('shot tauri-980-rewards.png');
  await evaluate(`window.RS.render('settings')`);
  await sleep(800);
  await screenshot(send, path.join(OUT, 'tauri-980-settings.png'));
  console.log('shot tauri-980-settings.png');
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
