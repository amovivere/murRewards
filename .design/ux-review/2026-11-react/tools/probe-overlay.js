const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  setNative: (el, value) => { const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); },
};`;

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');

  const dialogs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Page.javascriptDialogOpening') {
      dialogs.push(m.params);
      const isPrompt = m.params.type === 'prompt';
      send('Page.handleJavaScriptDialog', { accept: true, promptText: isPrompt ? 'Аудит-пресет' : undefined }).catch(() => {});
    }
  });

  // ensure fresh overlay page state
  await send('Page.reload', { ignoreCache: false });
  await sleep(3000);
  await evalJs(send, COMMON);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Оверлей')).click()`);
  await sleep(1200);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await screenshot(send, '70-overlay-top');

  const inv = await evalJs(send, `(() => ({
    scroll: { h: document.querySelector('.content').scrollHeight, client: document.querySelector('.content').clientHeight },
    panels: Array.from(document.querySelectorAll('.ui-panel')).map((p) => ({ title: p.querySelector('.ui-panel__title')?.textContent, rect: window.__a.rect(p) })),
    selects: Array.from(document.querySelectorAll('.ui-select')).map((s) => ({ value: s.value, options: Array.from(s.options).map((o) => o.textContent), rect: window.__a.rect(s), aria: s.getAttribute('aria-label'), id: s.id })),
    colorInputs: Array.from(document.querySelectorAll('.ui-color-field input[type=color]')).map((i) => ({ value: i.value, rect: window.__a.rect(i) })),
    hexInputs: Array.from(document.querySelectorAll('.ui-color-field__hex')).map((i) => ({ value: i.value, rect: window.__a.rect(i) })),
    ranges: Array.from(document.querySelectorAll('.ui-range')).map((i) => ({ value: i.value, min: i.min, max: i.max, rect: window.__a.rect(i), aria: i.getAttribute('aria-label') })),
    switches: Array.from(document.querySelectorAll('[role=switch]')).map((s) => ({ checked: s.getAttribute('aria-checked'), rect: window.__a.rect(s), aria: s.getAttribute('aria-label') })),
    presetBar: (() => { const b = document.querySelector('.preset-bar'); if (!b) return null; return { rect: window.__a.rect(b), text: window.__a.text(b), select: (() => { const s = b.querySelector('select'); return s ? { value: s.value, rect: window.__a.rect(s), options: Array.from(s.options).map((o) => ({ value: o.value, text: o.textContent })), opacity: getComputedStyle(s).opacity, position: getComputedStyle(s).position } : null; })(), status: window.__a.text(b.querySelector('.preset-bar__status')) }; })(),
    preview: (() => { const p = document.querySelector('.overlay-preview'); const f = p.querySelector('iframe'); const wrap = p.querySelector('.overlay-preview__frame-wrap'); return { panel: window.__a.rect(p), iframe: window.__a.rect(f), wrap: window.__a.rect(wrap), title: f.title, src: f.src, modes: Array.from(p.querySelectorAll('.overlay-preview__modes button')).map((b) => ({ text: b.textContent.trim(), cls: b.className, rect: window.__a.rect(b) })), sizeLabel: window.__a.text(p.querySelector('.overlay-preview__size')) }; })(),
    apply: (() => { const b = document.querySelector('.page-actions .ui-button--primary'); return { text: b?.textContent.trim(), disabled: b?.disabled, rect: b ? window.__a.rect(b) : null }; })(),
    pageActions: Array.from(document.querySelectorAll('.page-actions button')).map((b) => ({ text: window.__a.text(b), rect: window.__a.rect(b), cls: b.className })),
    channelField: (() => { const i = document.querySelector('.overlay-controls .ui-input'); return i ? { value: i.value, placeholder: i.placeholder, rect: window.__a.rect(i) } : null; })(),
    tagInputs: Array.from(document.querySelectorAll('.ui-toggle-row + .ui-input, .control-grid .ui-input.is-mono')).map((i) => ({ value: i.value, rect: window.__a.rect(i), placeholder: i.placeholder })),
  }))()`);
  saveNote('70-overlay-inventory', inv);
  console.log('OVERLAY INV', JSON.stringify(inv, null, 1).slice(0, 6500));

  // URL bar toggle
  await evalJs(send, `Array.from(document.querySelectorAll('.page-actions button')).find((b) => b.textContent.includes('URL для OBS')).click()`);
  await sleep(400);
  await screenshot(send, '71-overlay-url-bar');
  const urlBar = await evalJs(send, `(() => { const b = document.querySelector('.overlay-url-bar'); return b ? { rect: window.__a.rect(b), text: window.__a.text(b), buttons: Array.from(b.querySelectorAll('button')).map((x) => ({ text: x.textContent.trim(), rect: window.__a.rect(x) })) } : null; })()`);
  console.log('URL BAR', JSON.stringify(urlBar));
  saveNote('71-overlay-url-bar', urlBar);
  await evalJs(send, `Array.from(document.querySelectorAll('.overlay-url-bar button')).find((b) => b.textContent.includes('Скопировать')).click()`);
  await sleep(500);
  const urlToast = await evalJs(send, `document.querySelector('.ui-toast')?.textContent || null`);
  console.log('URL copy toast:', urlToast);

  // dirty state: change channel
  await evalJs(send, `document.querySelector('.overlay-controls .ui-input').focus()`);
  await evalJs(send, `window.__a.setNative(document.querySelector('.overlay-controls .ui-input'), 'audit-test-channel')`);
  await sleep(600);
  const dirty = await evalJs(send, `({ status: window.__a.text(document.querySelector('.preset-bar__status')), applyDisabled: document.querySelector('.page-actions .ui-button--primary').disabled, channelValue: document.querySelector('.overlay-controls .ui-input').value })`);
  await screenshot(send, '72-overlay-dirty');
  console.log('DIRTY', JSON.stringify(dirty));
  saveNote('72-overlay-dirty', dirty);

  // TagInput comma typing test (ignore bots field, 2nd mono input)
  const tagIndex = await evalJs(send, `Array.from(document.querySelectorAll('.ui-input.is-mono')).findIndex((i) => i.closest('.ui-field')?.textContent.includes('Игнор-боты'))`);
  console.log('tagIndex', tagIndex);
  if (tagIndex >= 0) {
    await evalJs(send, `document.querySelectorAll('.ui-input.is-mono')[${tagIndex}].focus()`);
    await send('Input.insertText', { text: 'a' });
    await sleep(250);
    const v1 = await evalJs(send, `document.querySelectorAll('.ui-input.is-mono')[${tagIndex}].value`);
    await send('Input.insertText', { text: ',' });
    await sleep(250);
    const v2 = await evalJs(send, `document.querySelectorAll('.ui-input.is-mono')[${tagIndex}].value`);
    await send('Input.insertText', { text: 'b' });
    await sleep(250);
    const v3 = await evalJs(send, `document.querySelectorAll('.ui-input.is-mono')[${tagIndex}].value`);
    console.log('TAG typing: after a=' + JSON.stringify(v1) + ' after comma=' + JSON.stringify(v2) + ' after b=' + JSON.stringify(v3));
    saveNote('73-overlay-tag-typing', { v1, v2, v3 });
    await screenshot(send, '73-overlay-tag-typing');
  }

  // hex input typing test
  const hexBefore = await evalJs(send, `document.querySelector('.ui-color-field__hex').value`);
  await evalJs(send, `const el = document.querySelector('.ui-color-field__hex'); el.focus(); el.select();`);
  const hexSteps = [hexBefore];
  for (const ch of ['#', '1', '2', '3', '4', '5', '6']) {
    await send('Input.insertText', { text: ch });
    await sleep(150);
    hexSteps.push(await evalJs(send, `document.querySelector('.ui-color-field__hex').value`));
  }
  console.log('HEX typing steps:', JSON.stringify(hexSteps));
  saveNote('74-overlay-hex-typing', { hexBefore, hexSteps });
  await screenshot(send, '74-overlay-hex-typing');

  // Reset channel to original? reload page resets from backend (we didn't save). But hex typing changed text color in-memory only.
  // Preset operations
  const presetCount0 = await evalJs(send, `document.querySelector('.preset-bar select')?.options.length`);
  await evalJs(send, `Array.from(document.querySelectorAll('.preset-bar__actions button')).find((b) => b.textContent.includes('Пресет')).click()`);
  await sleep(600);
  const afterAdd = await evalJs(send, `({ options: Array.from(document.querySelector('.preset-bar select').options).map((o) => o.textContent), activeName: window.__a.text(document.querySelector('.preset-bar__select span')), status: window.__a.text(document.querySelector('.preset-bar__status')) })`);
  await screenshot(send, '75-overlay-preset-added');
  console.log('PRESET add', JSON.stringify(afterAdd));
  saveNote('75-overlay-preset-add', { presetCount0, afterAdd });

  // rename (native prompt)
  await evalJs(send, `Array.from(document.querySelectorAll('.preset-bar__actions button')).find((b) => b.textContent.includes('Переименовать')).click()`);
  await sleep(900);
  const afterRename = await evalJs(send, `({ options: Array.from(document.querySelector('.preset-bar select').options).map((o) => o.textContent), activeName: window.__a.text(document.querySelector('.preset-bar__select span')) })`);
  console.log('PRESET rename', JSON.stringify(afterRename), 'dialogs=' + JSON.stringify(dialogs.map((d) => d.type + ':' + d.message).slice(0, 3)));
  saveNote('76-overlay-preset-rename', { afterRename, dialogs });

  // duplicate
  await evalJs(send, `Array.from(document.querySelectorAll('.preset-bar__actions button')).find((b) => b.textContent.includes('Дублировать')).click()`);
  await sleep(600);
  const afterDup = await evalJs(send, `({ options: Array.from(document.querySelector('.preset-bar select').options).map((o) => o.textContent), status: window.__a.text(document.querySelector('.preset-bar__status')) })`);
  console.log('PRESET dup', JSON.stringify(afterDup));

  // delete active (confirm)
  await evalJs(send, `Array.from(document.querySelectorAll('.preset-bar__actions button')).find((b) => b.textContent.includes('Удалить')).click()`);
  await sleep(1000);
  const afterDel = await evalJs(send, `({ options: Array.from(document.querySelector('.preset-bar select').options).map((o) => o.textContent), activeName: window.__a.text(document.querySelector('.preset-bar__select span')), toast: document.querySelector('.ui-toast')?.textContent || null })`);
  console.log('PRESET delete', JSON.stringify(afterDel), 'dialogs=' + JSON.stringify(dialogs.slice(-2).map((d) => d.type + ':' + d.message)));
  saveNote('77-overlay-preset-delete', { afterDel, dialogs });
  await screenshot(send, '77-overlay-preset-delete');

  // delete until single preset then try delete
  for (let i = 0; i < 3; i++) {
    const n = await evalJs(send, `document.querySelector('.preset-bar select')?.options.length`);
    if (n <= 1) break;
    await evalJs(send, `Array.from(document.querySelectorAll('.preset-bar__actions button')).find((b) => b.textContent.includes('Удалить')).click()`);
    await sleep(900);
  }
  await evalJs(send, `Array.from(document.querySelectorAll('.preset-bar__actions button')).find((b) => b.textContent.includes('Удалить')).click()`);
  await sleep(600);
  const single = await evalJs(send, `({ options: document.querySelector('.preset-bar select')?.options.length, toast: document.querySelector('.ui-toast')?.textContent || null })`);
  console.log('PRESET single delete', JSON.stringify(single));

  // Reload to reset overlay state (discard in-memory changes)
  await send('Page.reload', { ignoreCache: false });
  await sleep(3200);
  await evalJs(send, COMMON);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Оверлей')).click()`);
  await sleep(1200);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await sleep(300);
  await screenshot(send, '78-overlay-restored');

  // preview modes
  await evalJs(send, `Array.from(document.querySelectorAll('.overlay-preview__modes button')).find((b) => b.textContent.includes('Активный')).click()`);
  await sleep(700);
  await screenshot(send, '79-overlay-preview-live');
  const modes = await evalJs(send, `Array.from(document.querySelectorAll('.overlay-preview__modes button')).map((b) => ({ text: b.textContent.trim(), cls: b.className }))`);
  await evalJs(send, `Array.from(document.querySelectorAll('.overlay-preview__modes button')).find((b) => b.textContent.trim() === '+3').click()`);
  await sleep(500);
  await screenshot(send, '80-overlay-preview-plus3');
  console.log('MODES', JSON.stringify(modes));
  saveNote('79-overlay-modes', { modes });

  // scroll positions
  const contentInfo = await evalJs(send, `({ scrollH: document.querySelector('.content').scrollHeight, clientH: document.querySelector('.content').clientHeight })`);
  await evalJs(send, `document.querySelector('.content').scrollTop = 900`);
  await sleep(400);
  await screenshot(send, '81-overlay-scroll-900');
  const sticky = await evalJs(send, `(() => { const p = document.querySelector('.overlay-preview'); const r = p.getBoundingClientRect(); return { top: Math.round(r.y), rect: window.__a.rect(p), sticky: getComputedStyle(p).position }; })()`);
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(400);
  await screenshot(send, '82-overlay-scroll-bottom');
  const stickyBottom = await evalJs(send, `(() => { const p = document.querySelector('.overlay-preview'); const r = p.getBoundingClientRect(); return { top: Math.round(r.y), rect: window.__a.rect(p), scrollTop: document.querySelector('.content').scrollTop }; })()`);
  console.log('SCROLL', JSON.stringify({ contentInfo, sticky, stickyBottom }));
  saveNote('81-overlay-scroll', { contentInfo, sticky, stickyBottom });

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
