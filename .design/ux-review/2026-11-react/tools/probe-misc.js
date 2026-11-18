const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Награды')).click()`);
  await sleep(800);
  await evalJs(send, `document.querySelector('.health-chip').click()`);
  await sleep(400);
  const rows = await evalJs(send, `Array.from(document.querySelectorAll('.health-popover__rows button')).map((b) => b.innerText.replace(/\\n/g, ' · ').slice(0, 90))`);
  console.log('POPOVER ROWS ORDER', JSON.stringify(rows));
  // click Overlay row (3rd) and check tab
  await evalJs(send, `Array.from(document.querySelectorAll('.health-popover__rows button'))[2].click()`);
  await sleep(900);
  const tabAfter = await evalJs(send, `({ active: window.__a ? 0 : 0, nav: document.querySelector('.nav-item.is-active')?.textContent, title: document.querySelector('.page-title')?.textContent, popover: Boolean(document.querySelector('.health-popover')) })`);
  console.log('AFTER OVERLAY ROW', JSON.stringify(tabAfter));
  await screenshot(send, 'f0-health-popover-navigation');
  // open popover again, click footer
  await evalJs(send, `document.querySelector('.health-chip').click()`);
  await sleep(300);
  await evalJs(send, `document.querySelector('.health-popover__footer').click()`);
  await sleep(800);
  const footerNav = await evalJs(send, `({ title: document.querySelector('.page-title')?.textContent, popover: Boolean(document.querySelector('.health-popover')) })`);
  console.log('FOOTER NAV', JSON.stringify(footerNav));
  // footer duplication + version
  const dups = await evalJs(send, `({ sidebarVersion: window.__a ? null : null, versions: Array.from(document.querySelectorAll('.sidebar__version, .footer span')).map((e) => e.textContent), footer: document.querySelector('.footer').innerText.replace(/\\n/g, ' | '), title: document.title })`);
  console.log('VERSIONS', JSON.stringify(dups));
  // focus window button + hover close
  const winBtns = await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).map((b) => ({ title: b.title, text: b.textContent, rect: (() => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(), aria: b.getAttribute('aria-label') }))`);
  console.log('WINDOW BUTTONS', JSON.stringify(winBtns));
  // check page titles & nav order consistency across pages
  const nav = await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).map((n) => ({ text: n.textContent.replace(/\\s+/g, ' ').trim(), active: n.classList.contains('is-active') }))`);
  console.log('NAV', JSON.stringify(nav));
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
