const { connect, sleep, screenshot } = require('./cdp');
const path = require('path');

const OUT = path.resolve(__dirname, '..', '..', '..', 'reward-sounds-tauri', 'screens');

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(4000);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name) => {
    await screenshot(send, path.join(OUT, name));
    console.log('shot', name);
  };

  await evaluate(`window.RS.render('rewards')`);
  await sleep(700);
  if (!(await evaluate(`!!document.querySelector('#rewards-list.grid')`))) {
    await evaluate(`document.querySelector('#view-mode [data-view="grid"]')?.click()`);
    await sleep(900);
  }
  await shot('tauri-rewards-real.png');

  await evaluate(`document.querySelector('#view-mode [data-view="list"]')?.click()`);
  await sleep(900);
  await shot('tauri-rewards-list.png');
  await evaluate(`document.querySelector('#view-mode [data-view="grid"]')?.click()`);
  await sleep(700);

  await evaluate(`document.querySelector('#reward-create')?.click()`);
  await sleep(500);
  await shot('tauri-reward-modal.png');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  await sleep(250);

  await evaluate(`window.RS.render('log')`);
  await sleep(1200);
  await shot('tauri-log-real.png');

  await evaluate(`window.RS.render('rewards')`);
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
