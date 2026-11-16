const { connect, evalJs, sleep, screenshot, OUT } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');

  const view = await evalJs(
    send,
    `({w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent, url: location.href})`
  );
  console.log('viewport', JSON.stringify(view));

  const screens = process.argv.slice(2);
  const list = screens.length ? screens : ['rewards', 'music', 'onboarding', 'settings', 'log'];
  const tag = process.env.TAG ? process.env.TAG + '-' : '';
  for (const name of list) {
    await evalJs(send, `window.RS && window.RS.render(${JSON.stringify(name)}); true`);
    await sleep(name === 'log' ? 900 : 450);
    const file = await screenshot(send, `${tag}${name}`);
    console.log('shot', file);
  }
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
