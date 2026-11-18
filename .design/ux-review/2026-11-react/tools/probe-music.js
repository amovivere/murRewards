const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  vis: (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; },
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  btn: (txt) => Array.from(document.querySelectorAll('button')).find((b) => window.__a.text(b) === txt || window.__a.text(b).startsWith(txt)),
  nav: (txt) => Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(txt)),
};`;

async function key(send, k, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}

const getState = async (send) => evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_state')`, true);

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, COMMON);
  await evalJs(send, `window.__a.nav('Музыка').click()`);
  await sleep(1000);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await screenshot(send, '60-music');

  const inv = await evalJs(send, `(() => ({
    title: document.querySelector('.page-title')?.textContent,
    subtitle: document.querySelector('.page-subtitle')?.textContent,
    panels: Array.from(document.querySelectorAll('.ui-panel')).map((p) => ({ title: p.querySelector('.ui-panel__title')?.textContent, rect: window.__a.rect(p), text: window.__a.text(p).slice(0, 250) })),
    player: (() => { const pl = document.querySelector('.player'); return pl ? { rect: window.__a.rect(pl), cover: window.__a.rect(pl.querySelector('.player__cover')), title: pl.querySelector('.player__track')?.textContent, meta: pl.querySelector('.player__meta')?.textContent, controls: Array.from(pl.querySelectorAll('button')).map((b) => ({ title: b.title, text: window.__a.text(b), rect: window.__a.rect(b), cls: b.className, disabled: b.disabled })), progress: { rect: window.__a.rect(pl.querySelector('.player__progress')), track: window.__a.rect(pl.querySelector('.progress-track')), fill: pl.querySelector('.progress-fill')?.style.width, knob: pl.querySelector('.progress-knob')?.style.left, label: window.__a.text(pl.querySelector('.player__progress')) } } : null; })(),
    queue: (() => { const q = document.querySelector('.queue-list'); const rows = Array.from(document.querySelectorAll('.queue-row')); return { count: rows.length, rows: rows.map((r) => ({ rect: window.__a.rect(r), text: window.__a.text(r), buttons: Array.from(r.querySelectorAll('button')).map((b) => ({ title: b.title, text: b.textContent, rect: window.__a.rect(b) })) })), inputPlaceholder: document.querySelector('.queue-input input')?.placeholder, inputRect: document.querySelector('.queue-input input') ? window.__a.rect(document.querySelector('.queue-input input')) : null }; })(),
    obsPanel: document.querySelector('.url-code')?.textContent,
    status: Array.from(document.querySelectorAll('.check-list li')).map((li) => window.__a.text(li)),
    pageButtons: Array.from(document.querySelectorAll('.page-actions button')).map((b) => ({ text: window.__a.text(b), rect: window.__a.rect(b) })),
    scroll: { h: document.querySelector('.content').scrollHeight, client: document.querySelector('.content').clientHeight },
  }))()`);
  saveNote('60-music-inventory', inv);
  console.log('MUSIC INV', JSON.stringify(inv, null, 1).slice(0, 5000));

  const st0 = await getState(send);
  const player0 = st0.music.player;

  // Pause/play toggle via first player button
  await evalJs(send, `document.querySelector('.player__controls button').click()`);
  await sleep(1200);
  const st1 = await getState(send);
  await screenshot(send, '61-music-after-play-click');
  const uiAfter = await evalJs(send, `({ toast: document.querySelector('.ui-toast')?.textContent || null, playLabel: document.querySelector('.player__controls button')?.getAttribute('aria-label') })`);
  // toggle back
  await evalJs(send, `document.querySelector('.player__controls button').click()`);
  await sleep(800);
  const st2 = await getState(send);
  console.log('PAUSE0=' + JSON.stringify(player0), 'AFTER1=' + JSON.stringify(st1.music.player), 'AFTER2=' + JSON.stringify(st2.music.player));
  saveNote('61-music-pause', { player0, after1: st1.music.player, after2: st2.music.player, uiAfter });

  // duplicate controls: both first buttons same handler effect?
  const ctrl = await evalJs(send, `Array.from(document.querySelectorAll('.player__controls button')).map((b) => ({ title: b.title, cls: b.className, rect: window.__a.rect(b), aria: b.getAttribute('aria-label') }))`);
  console.log('CONTROLS', JSON.stringify(ctrl));

  // Queue up arrow on first item (should be no-op / maybe moves above nothing)
  const beforeUp = await getState(send);
  await evalJs(send, `document.querySelector('.queue-row .icon-ghost').click()`);
  await sleep(1000);
  const afterUp = await getState(send);
  const queueToast = await evalJs(send, `document.querySelector('.ui-toast')?.textContent || null`);
  console.log('QUEUE UP items before=' + beforeUp.music.items.length + ' after=' + afterUp.music.items.length, 'toast=' + queueToast);
  saveNote('62-music-queue-up', { before: beforeUp.music.items, after: afterUp.music.items, toast: queueToast });

  // invalid link via input + Enter
  await evalJs(send, `document.querySelector('.queue-input input').focus()`);
  await send('Input.insertText', { text: 'not a youtube link' });
  await sleep(200);
  await key(send, 'Enter', 'Enter', 13);
  await sleep(1800);
  const errToast = await evalJs(send, `(() => { const t = document.querySelector('.ui-toast'); return t ? { text: t.textContent, rect: window.__a.rect(t) } : null; })()`);
  const stErr = await getState(send);
  await screenshot(send, '63-music-invalid-link');
  console.log('INVALID LINK toast=', JSON.stringify(errToast), 'queue=', stErr.music.items.length, 'inputValue=', await evalJs(send, `document.querySelector('.queue-input input').value`));
  saveNote('63-music-invalid-link', { errToast, queue: stErr.music.items.length });
  // clear input
  await evalJs(send, `const i = document.querySelector('.queue-input input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));`);
  await sleep(300);

  // Empty queue input + Enter (no toast expected)
  await evalJs(send, `document.querySelector('.queue-input input').focus()`);
  await key(send, 'Enter', 'Enter', 13);
  await sleep(600);
  const emptyToast = await evalJs(send, `document.querySelector('.ui-toast')?.textContent || null`);
  console.log('EMPTY ENTER toast:', emptyToast);

  // OBS modal
  await evalJs(send, `window.__a.btn('Настроить').click()`);
  await sleep(500);
  await screenshot(send, '64-music-obs-modal');
  const obs = await evalJs(send, `(() => {
    const m = document.querySelector('.ui-modal');
    if (!m) return null;
    return {
      title: m.querySelector('.ui-modal__title')?.textContent,
      subtitle: m.querySelector('.ui-modal__subtitle')?.textContent,
      rect: window.__a.rect(m),
      inputs: Array.from(m.querySelectorAll('input,select')).map((i) => ({ tag: i.tagName, type: i.type, value: i.value, rect: window.__a.rect(i) })),
      buttons: Array.from(m.querySelectorAll('button')).map((b) => ({ text: window.__a.text(b), cls: b.className, rect: window.__a.rect(b) })),
      bodyText: window.__a.text(m.querySelector('.ui-modal__body')),
    };
  })()`);
  saveNote('64-music-obs-modal', obs);
  console.log('OBS MODAL', JSON.stringify(obs, null, 1).slice(0, 2500));
  // copy URL button
  await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal button')).find((b) => b.textContent.includes('Скопировать')).click()`);
  await sleep(600);
  const copied = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal button')).map((b) => b.textContent.trim())`);
  await screenshot(send, '65-music-obs-copied');
  console.log('COPY STATE', JSON.stringify(copied));
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(400);

  // Music settings modal
  await evalJs(send, `window.__a.btn('Настроить музыку').click()`);
  await sleep(500);
  await screenshot(send, '66-music-settings-modal');
  const ms = await evalJs(send, `(() => {
    const m = document.querySelector('.ui-modal');
    if (!m) return null;
    return {
      title: m.querySelector('.ui-modal__title')?.textContent,
      rect: window.__a.rect(m),
      ranges: Array.from(m.querySelectorAll('input[type=range]')).map((i) => ({ value: i.value, min: i.min, max: i.max, rect: window.__a.rect(i) })),
      switches: Array.from(m.querySelectorAll('[role=switch]')).map((s) => ({ checked: s.getAttribute('aria-checked'), cls: s.className, rect: window.__a.rect(s), aria: s.getAttribute('aria-label') })),
      buttons: Array.from(m.querySelectorAll('button')).map((b) => ({ text: window.__a.text(b), rect: window.__a.rect(b), disabled: b.disabled })),
      bodyH: { scrollH: m.querySelector('.ui-modal__body').scrollHeight, clientH: m.querySelector('.ui-modal__body').clientHeight },
    };
  })()`);
  saveNote('66-music-settings-modal', ms);
  console.log('MUSIC SETTINGS', JSON.stringify(ms, null, 1).slice(0, 3000));
  // toggle a switch -> no dirty indicator; close via backdrop and reopen to see reset (don't save)
  await evalJs(send, `document.querySelector('.ui-modal [role=switch]').click()`);
  await sleep(300);
  const switchState = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked'))`);
  await evalJs(send, `document.querySelector('.ui-modal-backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(300);
  const reopened = await evalJs(send, `(() => { const b = window.__a.btn('Настроить музыку'); if (!b) return null; b.click(); return true; })()`);
  await sleep(500);
  const switchAfterReopen = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked'))`);
  console.log('SWITCH changed=' + JSON.stringify(switchState) + ' afterReopen=' + JSON.stringify(switchAfterReopen));
  saveNote('67-music-settings-reset', { switchState, switchAfterReopen, reopened });
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);

  // scroll bottom of music page
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(300);
  await screenshot(send, '68-music-bottom');

  // page head buttons targets
  const head = await evalJs(send, `Array.from(document.querySelectorAll('.page-actions button')).map((b) => ({ text: window.__a.text(b), rect: window.__a.rect(b), aria: b.getAttribute('aria-label') }))`);
  console.log('HEAD BTN', JSON.stringify(head));

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
