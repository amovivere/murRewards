const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  nav: (txt) => Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(txt)),
  setNative: (el, value) => { const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); },
};`;

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, COMMON);
  const state = async () => evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_state')`, true);

  // ---------- music settings poll reset ----------
  await evalJs(send, `window.__a.nav('Музыка').click()`);
  await sleep(1000);
  await evalJs(send, `Array.from(document.querySelectorAll('.page-actions button')).find((b) => b.textContent.includes('Настроить музыку')).click()`);
  await sleep(400);
  const before = await evalJs(send, `({ switches: Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked')), ranges: Array.from(document.querySelectorAll('.ui-modal input[type=range]')).map((i) => i.value) })`);
  await evalJs(send, `document.querySelectorAll('.ui-modal [role=switch]')[0].click()`);
  await sleep(80);
  const immediate = await evalJs(send, `({ switches: Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked')) })`);
  await sleep(1400);
  const afterPoll = await evalJs(send, `({ switches: Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked')) })`);
  // slider via native setter
  await evalJs(send, `window.__a.setNative(document.querySelectorAll('.ui-modal input[type=range]')[0], '25')`);
  await sleep(80);
  const sliderImmediate = await evalJs(send, `document.querySelectorAll('.ui-modal input[type=range]')[0].value`);
  await sleep(1400);
  const sliderAfterPoll = await evalJs(send, `document.querySelectorAll('.ui-modal input[type=range]')[0].value`);
  console.log('POLL RESET switches before=' + JSON.stringify(before.switches), 'immediate=' + JSON.stringify(immediate.switches), 'afterPoll=' + JSON.stringify(afterPoll.switches));
  console.log('POLL RESET slider immediate=' + sliderImmediate, 'afterPoll=' + sliderAfterPoll);
  saveNote('c0-music-settings-poll', { before, immediate, afterPoll, sliderImmediate, sliderAfterPoll });
  await screenshot(send, 'c0-music-settings-modal');
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(300);

  // ---------- OBS modal poll reset ----------
  await evalJs(send, `Array.from(document.querySelectorAll('.ui-panel')).find((p) => p.querySelector('.ui-panel__title')?.textContent.includes('OBS')).querySelector('.ui-panel__head .ui-button').click()`);
  await sleep(400);
  const obsBefore = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal input')).map((i) => i.value)`);
  await evalJs(send, `window.__a.setNative(Array.from(document.querySelectorAll('.ui-modal input')).find((i) => i.type === 'number'), '25')`);
  await sleep(80);
  const obsImmediate = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal input')).find((i) => i.type === 'number').value`);
  await sleep(1400);
  const obsAfterPoll = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal input')).find((i) => i.type === 'number').value`);
  console.log('OBS POLL font before=' + JSON.stringify(obsBefore), 'immediate=' + obsImmediate, 'afterPoll=' + obsAfterPoll);
  saveNote('c1-obs-poll', { obsBefore, obsImmediate, obsAfterPoll });
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(300);

  // ---------- duplicate play/pause buttons ----------
  const st0 = await state();
  await evalJs(send, `Array.from(document.querySelectorAll('.player__controls button'))[1].click()`);
  await sleep(1100);
  const st1 = await state();
  await evalJs(send, `Array.from(document.querySelectorAll('.player__controls button'))[0].click()`);
  await sleep(900);
  const st2 = await state();
  console.log('PLAY/PAUSE buttons: paused0=' + st0.music.player.paused, 'after2ndBtn=' + st1.music.player.paused, 'after1stBtn=' + st2.music.player.paused);
  saveNote('c2-play-pause', { paused0: st0.music.player.paused, afterSecond: st1.music.player.paused, afterFirst: st2.music.player.paused });

  // ---------- overlay apply initial + preview size ----------
  await evalJs(send, `window.__a.nav('Оверлей').click()`);
  await sleep(1200);
  const ov = await evalJs(send, `(() => { const apply = document.querySelector('.page-actions .ui-button--primary'); const f = document.querySelector('.overlay-preview iframe'); const label = document.querySelector('.overlay-preview__size'); return { apply: { text: apply?.textContent.trim(), disabled: apply?.disabled, rect: apply ? window.__a.rect(apply) : null }, status: window.__a.text(document.querySelector('.preset-bar__status')), iframe: f ? { rect: window.__a.rect(f), src: f.src, title: f.title } : null, sizeLabel: label?.textContent, previewPanel: window.__a.rect(document.querySelector('.overlay-preview')) }; })()`);
  console.log('OVERLAY STATE', JSON.stringify(ov));
  saveNote('c3-overlay-state', ov);
  await screenshot(send, 'c3-overlay-top');

  // ---------- LOG tail ----------
  await evalJs(send, `window.__a.nav('Журнал').click()`);
  await sleep(1200);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  const filters = [];
  for (let i = 0; i < 4; i++) {
    await evalJs(send, `document.querySelectorAll('.filter-row .filter-pill')[${i}].click()`);
    await sleep(450);
    filters.push(await evalJs(send, `(() => ({ label: window.__a.text(document.querySelectorAll('.filter-row .filter-pill')[${i}]), rows: document.querySelectorAll('.log-row').length, levels: [...new Set(Array.from(document.querySelectorAll('.log-level')).map((l) => l.textContent))], countLabel: window.__a.text(document.querySelector('.toolbar-row .muted-line')) }))()`));
  }
  console.log('LOG FILTERS', JSON.stringify(filters));
  saveNote('c4-log-filters', filters);
  // debug presence across filters: check rows with DEBUG
  await evalJs(send, `document.querySelectorAll('.filter-row .filter-pill')[0].click()`);
  await sleep(300);
  const debugInfo = await evalJs(send, `({ debugRows: document.querySelectorAll('.log-level--debug').length, hasDebugFilter: Array.from(document.querySelectorAll('.filter-row .filter-pill')).some((b) => b.textContent.includes('DEBUG')) })`);
  console.log('LOG DEBUG', JSON.stringify(debugInfo));

  // scroll + inject new log entries via preview_sound
  await evalJs(send, `document.querySelector('.content').scrollTop = 1500`);
  await sleep(300);
  const sc0 = await evalJs(send, `({ top: document.querySelector('.content').scrollTop, first: window.__a.text(document.querySelector('.log-row')).slice(0, 60), toolbarY: Math.round(document.querySelector('.toolbar-row').getBoundingClientRect().y) })`);
  await evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_state').then((s) => window.__TAURI_INTERNALS__.invoke('preview_sound', { rewardId: s.rewards[0].id }))`, true);
  await sleep(3200);
  const sc1 = await evalJs(send, `({ top: document.querySelector('.content').scrollTop, rows: document.querySelectorAll('.log-row').length, first: window.__a.text(document.querySelector('.log-row')).slice(0, 80), toolbarY: Math.round(document.querySelector('.toolbar-row').getBoundingClientRect().y) })`);
  await screenshot(send, 'c5-log-after-new-entries');
  console.log('LOG SCROLL', JSON.stringify({ sc0, sc1 }));
  saveNote('c5-log-scroll', { sc0, sc1 });
  // screenshots
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await sleep(300);
  await screenshot(send, 'c6-log-after');
  // copy dead check
  const copyBtn = await evalJs(send, `(() => { const b = Array.from(document.querySelectorAll('.page-actions button')).find((x) => x.textContent.includes('Скопировать')); const k = b && Object.keys(b).find((key) => key.startsWith('__reactProps')); return { found: Boolean(b), hasOnClick: k ? typeof b[k].onClick === 'function' : null }; })()`);
  console.log('LOG COPY', JSON.stringify(copyBtn));

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
