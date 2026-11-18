const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');

  const metrics = async (tag) => {
    const m = await evalJs(send, `(() => {
      const shell = document.querySelector('.app-shell');
      const r = shell.getBoundingClientRect();
      return {
        tag: ${JSON.stringify(tag)},
        innerW: innerWidth, innerH: innerHeight,
        shell: { left: Math.round(r.x), top: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        margins: { left: Math.round(r.x), right: Math.round(innerWidth - (r.x + r.width)), top: Math.round(r.y), bottom: Math.round(innerHeight - (r.y + r.height)) },
        contentClientH: document.querySelector('.content').clientHeight,
        sidebarH: Math.round(document.querySelector('.sidebar').getBoundingClientRect().height),
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    })()`);
    console.log('METRICS', JSON.stringify(m));
    return m;
  };

  const m0 = await metrics('before');
  await screenshot(send, 'a20-window-before');

  // maximize via window control button (title "Развернуть")
  await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).find((b) => b.title.includes('Развернуть')).click()`);
  await sleep(1500);
  const m1 = await metrics('maximized');
  await screenshot(send, 'a21-window-maximized');
  saveNote('a20-window-maximized', { before: m0, maximized: m1 });

  // title of maximize button after maximize?
  const btnTitle = await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).map((b) => b.title)`);
  console.log('WIN BTN TITLES maximized:', JSON.stringify(btnTitle));

  // unmaximize
  await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).find((b) => b.title.includes('Развернуть')).click()`);
  await sleep(1500);
  const m2 = await metrics('restored');
  await screenshot(send, 'a22-window-restored');
  console.log('RESTORED', JSON.stringify(m2));

  // double-click on topbar empty area
  const pt = await evalJs(send, `(() => { const r = document.querySelector('.topbar').getBoundingClientRect(); return { x: Math.round(r.x + r.width * 0.55), y: Math.round(r.y + r.height / 2) }; })()`);
  console.log('DBLCLICK point', JSON.stringify(pt));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 2 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 2 });
  await sleep(1500);
  const m3 = await metrics('after-doubleclick');
  await screenshot(send, 'a23-window-after-dblclick');
  console.log('AFTER DBLCLICK', JSON.stringify(m3));
  saveNote('a23-window-dblclick', { point: pt, after: m3 });

  // if maximized, restore
  if (m3.innerW > m2.innerW + 50) {
    await evalJs(send, `Array.from(document.querySelectorAll('.window-controls button')).find((b) => b.title.includes('Развернуть')).click()`);
    await sleep(1500);
    console.log('restored again', JSON.stringify(await metrics('restored-again')));
  }

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
