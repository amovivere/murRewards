const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
};`;

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, COMMON);

  // make sure no modal
  await evalJs(send, `document.querySelector('.ui-modal-backdrop')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(300);

  // click OBS panel "Настроить" precisely
  const openedObs = await evalJs(send, `(() => { const p = Array.from(document.querySelectorAll('.ui-panel')).find((x) => x.querySelector('.ui-panel__title')?.textContent.includes('OBS')); if (!p) return false; const b = p.querySelector('.ui-panel__head .ui-button'); if (!b) return false; b.click(); return true; })()`);
  await sleep(500);
  await screenshot(send, '64-music-obs-modal');
  const obs = await evalJs(send, `(() => {
    const m = document.querySelector('.ui-modal');
    if (!m) return { open: false };
    return {
      open: true,
      title: m.querySelector('.ui-modal__title')?.textContent,
      subtitle: m.querySelector('.ui-modal__subtitle')?.textContent,
      rect: window.__a.rect(m),
      inputs: Array.from(m.querySelectorAll('input,select,textarea')).map((i) => ({ tag: i.tagName, type: i.type, value: i.value, rect: window.__a.rect(i) })),
      buttons: Array.from(m.querySelectorAll('button')).map((b) => ({ text: window.__a.text(b), cls: b.className, rect: window.__a.rect(b) })),
      body: window.__a.text(m.querySelector('.ui-modal__body')),
      copyButton: Array.from(m.querySelectorAll('button')).some((b) => b.textContent.includes('Скопировать URL')),
    };
  })()`);
  saveNote('64-music-obs-modal', obs);
  console.log('OBS MODAL', JSON.stringify(obs, null, 1).slice(0, 3000));

  await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal button')).find((b) => b.textContent.includes('Скопировать')).click()`);
  await sleep(500);
  const copiedLabel = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal button')).map((b) => b.textContent.trim())`);
  await screenshot(send, '65-music-obs-copied');
  console.log('COPIED LABEL', JSON.stringify(copiedLabel));

  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(300);

  // Open music settings precisely
  await evalJs(send, `Array.from(document.querySelectorAll('.page-actions button')).find((b) => b.textContent.includes('Настроить музыку')).click()`);
  await sleep(500);
  const before = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked'))`);
  await evalJs(send, `document.querySelectorAll('.ui-modal [role=switch]')[0].click()`);
  await sleep(300);
  const afterToggle = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked'))`);
  await evalJs(send, `document.querySelector('.ui-modal-backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(300);
  const closed = await evalJs(send, `Boolean(document.querySelector('.ui-modal'))`);
  await evalJs(send, `Array.from(document.querySelectorAll('.page-actions button')).find((b) => b.textContent.includes('Настроить музыку')).click()`);
  await sleep(500);
  const afterReopen = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal [role=switch]')).map((s) => s.getAttribute('aria-checked'))`);
  console.log('SETTINGS SWITCH before=' + JSON.stringify(before), 'afterToggle=' + JSON.stringify(afterToggle), 'closed=' + closed, 'afterReopen=' + JSON.stringify(afterReopen));
  saveNote('67-music-settings-reset', { before, afterToggle, closed, afterReopen });
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(300);

  // log check for invalid link
  const logs = await evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_logs', { limit: 40 })`, true);
  const relevant = (logs || []).filter((l) => /ссыл|youtube|not a youtube|музык/i.test(l.message)).slice(0, 15).map((l) => ({ time: l.time, level: l.level, message: l.message }));
  console.log('LOGS relevant:', JSON.stringify(relevant, null, 1).slice(0, 3000));
  saveNote('69-music-invalid-link-logs', relevant);

  // bottom screenshot
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(300);
  await screenshot(send, '68-music-bottom');

  // Head buttons & dots
  const head = await evalJs(send, `Array.from(document.querySelectorAll('.page-actions button')).map((b) => ({ text: window.__a.text(b), cls: b.className, rect: window.__a.rect(b), title: b.title, aria: b.getAttribute('aria-label') }))`);
  console.log('HEAD', JSON.stringify(head));

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
