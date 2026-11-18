const path = require("node:path");
const cdp = require("F:/WorkSpaces/Mur rewards/.design/rs-review/live/cdp.js");
(async () => {
  const { send } = await cdp.connect();
  await cdp.evalJs(send, `document.querySelector('[data-tab="overlay"]').click(); true`);
  await cdp.sleep(1800);
  const info = await cdp.evalJs(send, `(() => {
    const f = document.querySelector('.overlay-settings-frame');
    return { tab: document.querySelector('.nav-item.active')?.dataset.tab, frame: !!f, src: f?.src, rect: f?.getBoundingClientRect().toJSON() };
  })()`);
  console.log(JSON.stringify(info));
  const file = await cdp.screenshot(send, "F:/WorkSpaces/Mur rewards/.design/overlay-port/app-overlay-tab.png");
  console.log(file);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
