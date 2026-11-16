const { connect, evalJs, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');

  // первый запуск без Twitch: шапка должна быть в офлайн-состоянии.
  // Глушим опрос get_state, иначе он вернёт connected=true и перерисует шапку.
  await evalJs(
    send,
    `(() => {
      window.__origInvoke = window.__TAURI__.core.invoke;
      window.__TAURI__.core.invoke = () => Promise.resolve(null);
      window.RS.state.connected = false;
      try { window.RS.render('onboarding'); } catch (e) {}
      return true;
    })()`
  );
  await sleep(250);
  const file = await screenshot(send, 'v2-onboarding-offline');
  console.log('shot', file);
  const status = await evalJs(send, `document.querySelector('#twitch-status')?.textContent`);
  console.log('twitch-status:', status);

  // восстановить онлайн-вид
  await evalJs(
    send,
    `(() => {
      if (window.__origInvoke) window.__TAURI__.core.invoke = window.__origInvoke;
      window.RS.state.connected = true;
      window.RS.render('rewards');
      return true;
    })()`
  );
  await sleep(300);
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
