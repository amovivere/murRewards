const { connect, sleep, screenshot } = require('./cdp');
const path = require('path');

const OUT = path.resolve(__dirname, '..', '..', '..', 'reward-sounds-tauri', 'screens');

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(4200);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  const shot = async (name) => {
    await screenshot(send, path.join(OUT, name));
    console.log('shot', name);
  };

  await evaluate(`window.RS.render('rewards')`);
  await sleep(800);
  if (!(await evaluate(`!!document.querySelector('#rewards-list.grid')`))) {
    await evaluate(`document.querySelector('#view-mode [data-view="grid"]')?.click()`);
    await sleep(900);
  }
  await shot('tauri-rewards-real.png');
  console.log('sidebar:', JSON.stringify(await evaluate(`(() => { const h = document.querySelector('#sidebar').offsetHeight; const s = document.querySelector('.sidebar-system').getBoundingClientRect(); return { height: h, systemTop: Math.round(s.top), bottom: Math.round(s.bottom), gapToBottom: Math.round(h - s.bottom) }; })()`)));
  console.log('cards:', JSON.stringify(await evaluate(`Array.from(document.querySelectorAll('.reward-card')).map((card) => card.offsetHeight)`)));

  await evaluate(`document.querySelector('#view-mode [data-view="list"]')?.click()`);
  await sleep(900);
  await shot('tauri-rewards-list.png');

  await evaluate(`window.RS.render('settings')`);
  await sleep(900);
  await shot('tauri-settings-real.png');
  console.log('accent:', JSON.stringify(await evaluate(`({ css: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), view: window.RS.state.view?.accent, presets: document.querySelectorAll('#accent-palette .color-preset').length })`)));
  await evaluate(`document.querySelectorAll('#accent-palette .color-preset')[2]?.click()`);
  await sleep(800);
  await shot('tauri-accent-blue.png');
  console.log('accent blue:', JSON.stringify(await evaluate(`({ css: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), view: window.RS.state.view?.accent })`)));
  await evaluate(`document.querySelector('#accent-reset')?.click()`);
  await sleep(900);
  await shot('tauri-settings-real.png');

  await evaluate(`window.RS.render('music')`);
  await sleep(800);
  await shot('tauri-music-real.png');
  console.log('player:', JSON.stringify(await evaluate(`({ current: !!window.RS.state.view?.music?.current, transport: !!document.querySelector('#play-toggle'), cta: !!document.querySelector('#player-empty-add') })`)));
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
