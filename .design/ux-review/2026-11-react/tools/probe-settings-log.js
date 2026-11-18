const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  nav: (txt) => Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(txt)),
};`;

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, COMMON);

  // ---------------- SETTINGS ----------------
  await evalJs(send, `window.__a.nav('Настройки').click()`);
  await sleep(1000);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await screenshot(send, '90-settings-top');

  const set = await evalJs(send, `(() => ({
    scroll: { h: document.querySelector('.content').scrollHeight, client: document.querySelector('.content').clientHeight },
    head: { title: document.querySelector('.page-title')?.textContent, sub: document.querySelector('.page-subtitle')?.textContent, right: document.querySelector('.page-head .muted-line')?.textContent },
    panels: Array.from(document.querySelectorAll('.ui-panel')).map((p) => ({ title: p.querySelector('.ui-panel__title')?.textContent, rect: window.__a.rect(p) })),
    health: Array.from(document.querySelectorAll('.health-row')).map((r) => ({ text: window.__a.text(r), rect: window.__a.rect(r), dot: (() => { const d = r.querySelector('.dot'); return d ? { cls: d.className, bg: getComputedStyle(d).backgroundColor } : null; })(), open: (() => { const a = r.querySelector('a'); return a ? { text: a.textContent, href: a.getAttribute('href'), tabIndex: a.tabIndex, cursor: getComputedStyle(a).cursor, rect: window.__a.rect(a) } : null; })() })),
    healthPill: (() => { const p = document.querySelector('.ui-panel .ui-pill'); return p ? { text: p.textContent, cls: p.className } : null; })(),
    accent: { swatches: Array.from(document.querySelectorAll('.accent-swatch')).map((s) => ({ title: s.title, active: s.classList.contains('is-active'), rect: window.__a.rect(s) })), code: document.querySelector('.url-code')?.textContent, sampleButton: (() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('Пример кнопки')); return b ? { rect: window.__a.rect(b), disabled: b.disabled } : null; })() },
    toggles: Array.from(document.querySelectorAll('.ui-toggle-row')).map((t) => ({ label: t.querySelector('.ui-toggle-row__label')?.textContent, hint: t.querySelector('.ui-toggle-row__hint')?.textContent, checked: t.querySelector('[role=switch]')?.getAttribute('aria-checked'), switchAria: t.querySelector('[role=switch]')?.getAttribute('aria-label'), rect: window.__a.rect(t) })),
    slider: (() => { const s = document.querySelector('.ui-range'); return s ? { value: s.value, min: s.min, max: s.max, aria: s.getAttribute('aria-label'), rect: window.__a.rect(s), labelText: window.__a.text(s.closest('.ui-slider-row')), labelTag: s.closest('label')?.tagName || null } : null; })(),
    audioDevice: window.__a.text(document.querySelector('.ok-line')),
    pageButtons: Array.from(document.querySelectorAll('.page .ui-button')).map((b) => ({ text: window.__a.text(b), cls: b.className, disabled: b.disabled, rect: window.__a.rect(b) })),
    footerRow: (() => { const rows = Array.from(document.querySelectorAll('.inline-row')); const last = rows[rows.length - 1]; return last ? { text: window.__a.text(last), rect: window.__a.rect(last), buttons: Array.from(last.querySelectorAll('button')).map((b) => ({ text: b.textContent.trim(), cls: b.className, rect: window.__a.rect(b) })) } : null; })(),
  }))()`);
  saveNote('90-settings', set);
  console.log('SETTINGS', JSON.stringify(set, null, 1).slice(0, 8000));

  // scroll to bottom
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(400);
  await screenshot(send, '91-settings-bottom');
  const bottom = await evalJs(send, `({ scrollTop: document.querySelector('.content').scrollTop, footerRow: (() => { const rows = Array.from(document.querySelectorAll('.inline-row')); const last = rows[rows.length - 1]; return last ? { text: window.__a.text(last), rect: window.__a.rect(last) } : null; })() })`);
  console.log('SETTINGS BOTTOM', JSON.stringify(bottom));

  // health row "Открыть" click test
  const beforeHref = await evalJs(send, `document.querySelector('.health-row a')?.getAttribute('href')`);
  const clickRes = await evalJs(send, `(() => { const a = document.querySelector('.health-row a'); if (!a) return null; a.click(); return { tab: document.querySelector('.nav-item.is-active')?.textContent, active: document.activeElement?.tagName }; })()`);
  await sleep(500);
  console.log('HEALTH OPEN click', JSON.stringify({ beforeHref, clickRes, tabAfter: await evalJs(send, `document.querySelector('.nav-item.is-active')?.textContent`) }));

  // "Скопировать диагностику" dead? (it was dead, don't click) - confirm no handler already.
  // Twitch refresh feedback test
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  const logsBefore = await evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_logs', { limit: 5 })`, true);
  await evalJs(send, `Array.from(document.querySelectorAll('.ui-button')).find((b) => b.textContent.includes('Обновить данные')).click()`);
  await sleep(2500);
  const logsAfter = await evalJs(send, `window.__TAURI_INTERNALS__.invoke('get_logs', { limit: 5 })`, true);
  const anyToast = await evalJs(send, `document.querySelector('.ui-toast')?.textContent || null`);
  const loaders = await evalJs(send, `Array.from(document.querySelectorAll('.ui-button')).filter((b) => /Загруз|Обновл|Подож/.test(b.textContent)).map((b) => b.textContent.trim())`);
  console.log('REFRESH feedback: toast=' + anyToast, 'loaderButtons=' + JSON.stringify(loaders), 'logsBefore=' + (logsBefore || []).slice(0, 2).map((l) => l.message), 'logsAfter=' + (logsAfter || []).slice(0, 2).map((l) => l.message));
  saveNote('92-settings-refresh', { logsBefore, logsAfter, anyToast, loaders });

  // Autoupdate toggle reset test
  const autoBefore = await evalJs(send, `Array.from(document.querySelectorAll('.ui-toggle-row')).find((t) => t.textContent.includes('Автообновление'))?.querySelector('[role=switch]').getAttribute('aria-checked')`);
  await evalJs(send, `Array.from(document.querySelectorAll('.ui-toggle-row')).find((t) => t.textContent.includes('Автообновление')).querySelector('[role=switch]').click()`);
  await sleep(400);
  const autoAfter = await evalJs(send, `Array.from(document.querySelectorAll('.ui-toggle-row')).find((t) => t.textContent.includes('Автообновление'))?.querySelector('[role=switch]').getAttribute('aria-checked')`);
  await evalJs(send, `window.__a.nav('Журнал').click()`);
  await sleep(500);
  await evalJs(send, `window.__a.nav('Настройки').click()`);
  await sleep(800);
  const autoReopen = await evalJs(send, `Array.from(document.querySelectorAll('.ui-toggle-row')).find((t) => t.textContent.includes('Автообновление'))?.querySelector('[role=switch]').getAttribute('aria-checked')`);
  console.log('AUTOUPDATE before=' + autoBefore, 'after=' + autoAfter, 'afterTabSwitch=' + autoReopen);
  saveNote('93-settings-autoupdate', { autoBefore, autoAfter, autoReopen });
  await screenshot(send, '92-settings-after-toggles');

  // ---------------- LOG ----------------
  await evalJs(send, `window.__a.nav('Журнал').click()`);
  await sleep(1200);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await screenshot(send, '94-log-top');

  const log = await evalJs(send, `(() => ({
    scroll: { h: document.querySelector('.content').scrollHeight, client: document.querySelector('.content').clientHeight },
    count: document.querySelectorAll('.log-row').length,
    rows: Array.from(document.querySelectorAll('.log-row')).slice(0, 5).map((r) => ({ text: window.__a.text(r), rect: window.__a.rect(r), cells: Array.from(r.children).map((c) => ({ tag: c.tagName, text: c.textContent.slice(0, 40), cls: c.className, rect: window.__a.rect(c), font: getComputedStyle(c).fontSize, color: getComputedStyle(c).color })) })),
    levels: (() => { const m = {}; document.querySelectorAll('.log-level').forEach((l) => { const k = l.textContent; m[k] = (m[k] || 0) + 1; }); return m; })(),
    levelColors: (() => { const out = {}; ['info', 'warn', 'error'].forEach((k) => { const el = document.querySelector('.log-level--' + k); if (el) out[k] = getComputedStyle(el).color; }); return out; })(),
    filters: Array.from(document.querySelectorAll('.filter-row .filter-pill')).map((b) => ({ text: window.__a.text(b), active: b.classList.contains('is-active'), rect: window.__a.rect(b) })),
    search: (() => { const i = document.querySelector('.search-field input'); return { rect: window.__a.rect(i), value: i.value, placeholder: i.placeholder }; })(),
    mutedLine: window.__a.text(document.querySelector('.toolbar-row .muted-line')),
    tableRect: window.__a.rect(document.querySelector('.log-table')),
    buttons: Array.from(document.querySelectorAll('.page-actions button')).map((b) => ({ text: b.textContent.trim(), cls: b.className, rect: window.__a.rect(b) })),
    timeWidth: Array.from(new Set(Array.from(document.querySelectorAll('.log-time')).map((t) => window.__a.rect(t).w))).slice(0, 5),
    textWidth: window.__a.rect(document.querySelector('.log-text')),
  }))()`);
  saveNote('94-log', log);
  console.log('LOG', JSON.stringify(log, null, 1).slice(0, 6000));

  // Search filter
  await evalJs(send, `document.querySelector('.search-field input').focus()`);
  await send('Input.insertText', { text: 'Оверлей' });
  await sleep(500);
  const searchRes = await evalJs(send, `({ rows: document.querySelectorAll('.log-row').length, first: window.__a.text(document.querySelector('.log-row')), countLabel: window.__a.text(document.querySelector('.toolbar-row .muted-line')) })`);
  await screenshot(send, '95-log-search');
  console.log('LOG SEARCH', JSON.stringify(searchRes));

  // no results search
  await evalJs(send, `const i = document.querySelector('.search-field input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'zzzz-no-such'); i.dispatchEvent(new Event('input', { bubbles: true }));`);
  await sleep(500);
  const noRes = await evalJs(send, `({ rows: document.querySelectorAll('.log-row').length, text: window.__a.text(document.querySelector('.log-table')), countLabel: window.__a.text(document.querySelector('.toolbar-row .muted-line')) })`);
  await screenshot(send, '96-log-empty-state');
  console.log('LOG EMPTY', JSON.stringify(noRes));

  // reset search
  await evalJs(send, `const i = document.querySelector('.search-field input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true }));`);
  await sleep(400);

  // Filter levels
  const filterResults = [];
  for (let i = 0; i < 4; i++) {
    await evalJs(send, `document.querySelectorAll('.filter-row .filter-pill')[${i}].click()`);
    await sleep(500);
    filterResults.push(await evalJs(send, `({ label: window.__a.text(document.querySelectorAll('.filter-row .filter-pill')[${i}]), rows: document.querySelectorAll('.log-row').length, firstLevel: document.querySelector('.log-level')?.textContent })`));
  }
  console.log('LOG FILTERS', JSON.stringify(filterResults));
  saveNote('97-log-filters', filterResults);
  await evalJs(send, `document.querySelectorAll('.filter-row .filter-pill')[0].click()`);
  await sleep(300);

  // scroll performance / sticky check + auto-refresh scroll jump
  await evalJs(send, `document.querySelector('.content').scrollTop = 1500`);
  await sleep(300);
  const scrollBefore = await evalJs(send, `({ top: document.querySelector('.content').scrollTop, toolbarY: Math.round(document.querySelector('.toolbar-row').getBoundingClientRect().y) })`);
  await screenshot(send, '98-log-scrolled');
  await sleep(3200);
  const scrollAfter = await evalJs(send, `({ top: document.querySelector('.content').scrollTop, rows: document.querySelectorAll('.log-row').length, firstRowText: window.__a.text(document.querySelector('.log-row')).slice(0, 80) })`);
  console.log('LOG SCROLL', JSON.stringify({ scrollBefore, scrollAfter }));
  saveNote('99-log-scroll', { scrollBefore, scrollAfter });
  await screenshot(send, '99-log-scroll-after-refresh');

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
