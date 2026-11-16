const { connect, evalJs, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');

  const tag = process.env.TAG || 'base';
  const sizes = (process.env.SIZES || '980x680,1220x840').split(',');
  for (const size of sizes) {
    const [w, h] = size.split('x').map(Number);
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const name of (process.env.SCREENS || 'rewards,music,onboarding,settings,log').split(',')) {
      await evalJs(
        send,
        `(() => { try { window.RS.render(${JSON.stringify(name)}); } catch (e) { console.warn(e); } return true; })()`
      );
      await sleep(name === 'log' ? 800 : 350);
      const file = await screenshot(send, `${tag}-${size}-${name}`);
      console.log('shot', file);
    }
  }
  await send('Emulation.clearDeviceMetricsOverride');
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
