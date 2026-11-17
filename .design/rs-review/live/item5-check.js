const { connect, sleep, screenshot } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Runtime.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(3500);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result.value;
  };
  console.log('errors?', await evaluate(`typeof window.RS`));
  await evaluate(`window.RS.render('settings')`);
  await sleep(900);
  await screenshot(send, 't5-settings');
  console.log('settings bits:', JSON.stringify(await evaluate(`({
    soundTest: document.querySelectorAll('.sound-test').length,
    danger: !!document.querySelector('.danger-zone'),
    health: !!document.querySelector('#settings-health'),
    audioTestOld: !!document.querySelector('#audio-test'),
  })`)));
  await evaluate(`window.RS.render('onboarding')`);
  await sleep(900);
  await screenshot(send, 't5-onboarding');
  console.log('onboarding:', JSON.stringify(await evaluate(`({soundTests: document.querySelectorAll('.sound-test').length, oldTest: !!document.querySelector('#onb-test')})`)));
  await evaluate(`window.RS.render('music')`);
  await sleep(900);
  await screenshot(send, 't6-music-empty');
  await evaluate(`document.querySelector('#music-menu').click()`);
  await sleep(250);
  await evaluate(`Array.from(document.querySelectorAll('.popmenu-item')).find(el => el.textContent.includes('Настройки музыки'))?.click()`);
  await sleep(500);
  await screenshot(send, 't5-music-settings');
  console.log('music modal:', JSON.stringify(await evaluate(`({save: !!document.querySelector('#ms-save'), obs: !!document.querySelector('#ms-obs'), indicator: document.querySelector('#ms-save-state')?.textContent})`)));
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
  ws.close();
})().catch((error) => { console.error(error); process.exit(1); });
