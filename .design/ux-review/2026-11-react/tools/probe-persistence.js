const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');
(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');

  // --- card menu clipped delete: click by coordinates ---
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Награды')).click()`);
  await sleep(900);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await evalJs(send, `document.querySelector('.reward-card .icon-ghost').click()`);
  await sleep(400);
  const target = await evalJs(send, `(() => { const items = Array.from(document.querySelectorAll('.reward-menu button')); const b = items[items.length - 1]; const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; })()`);
  console.log('delete target point', JSON.stringify(target));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await sleep(500);
  const afterClick = await evalJs(send, `({ modal: Boolean(document.querySelector('.ui-modal')), menu: Boolean(document.querySelector('.reward-menu')), elementAtPoint: (() => { const el = document.elementFromPoint(${target.x}, ${target.y}); return el ? el.tagName + '.' + el.className.toString().slice(0, 50) : null; })() })`);
  console.log('click clipped delete result', JSON.stringify(afterClick));
  saveNote('f1-clipped-delete-click', { target, afterClick });
  await screenshot(send, 'f1-clipped-delete');
  // close menu
  await evalJs(send, `document.querySelector('.page-title').click()`);
  await sleep(300);

  // --- rewards filter state after tab switch ---
  await evalJs(send, `document.querySelectorAll('.filter-pill')[1].click()`);
  await sleep(400);
  const beforeSwitch = await evalJs(send, `({ filter: document.querySelector('.filter-pill.is-active')?.textContent, cards: document.querySelectorAll('.reward-card').length, scrollTop: document.querySelector('.content').scrollTop })`);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Музыка')).click()`);
  await sleep(700);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Награды')).click()`);
  await sleep(900);
  const afterSwitch = await evalJs(send, `({ filter: document.querySelector('.filter-pill.is-active')?.textContent, cards: document.querySelectorAll('.reward-card').length, scrollTop: document.querySelector('.content').scrollTop })`);
  console.log('REWARDS STATE before=' + JSON.stringify(beforeSwitch), 'after=' + JSON.stringify(afterSwitch));
  saveNote('f2-rewards-state', { beforeSwitch, afterSwitch });

  // --- overlay unsaved changes lost on tab switch ---
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Оверлей')).click()`);
  await sleep(1100);
  const origChannel = await evalJs(send, `document.querySelector('.overlay-controls .ui-input').value`);
  await evalJs(send, `(() => { const el = document.querySelector('.overlay-controls .ui-input'); const p = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); p.set.call(el, 'unsaved-test'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(500);
  const dirtyState = await evalJs(send, `({ channel: document.querySelector('.overlay-controls .ui-input').value, status: document.querySelector('.preset-bar__status').textContent.trim() })`);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Музыка')).click()`);
  await sleep(700);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Оверлей')).click()`);
  await sleep(1200);
  const afterReturn = await evalJs(send, `({ channel: document.querySelector('.overlay-controls .ui-input').value, status: document.querySelector('.preset-bar__status').textContent.trim() })`);
  console.log('OVERLAY UNSAVED orig=' + origChannel, 'dirty=' + JSON.stringify(dirtyState), 'afterTabSwitch=' + JSON.stringify(afterReturn));
  saveNote('f3-overlay-unsaved', { origChannel, dirtyState, afterReturn });

  // --- music link input lost on tab switch ---
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Музыка')).click()`);
  await sleep(900);
  await evalJs(send, `document.querySelector('.queue-input input').focus()`);
  await send('Input.insertText', { text: 'https://youtu.be/test' });
  await sleep(300);
  const inputBefore = await evalJs(send, `document.querySelector('.queue-input input').value`);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Оверлей')).click()`);
  await sleep(600);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Музыка')).click()`);
  await sleep(900);
  const inputAfter = await evalJs(send, `document.querySelector('.queue-input input').value`);
  console.log('MUSIC INPUT before=' + JSON.stringify(inputBefore), 'after=' + JSON.stringify(inputAfter));
  saveNote('f4-music-input-state', { inputBefore, inputAfter });

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
