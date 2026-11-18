const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  vis: (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; },
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  btn: (txt) => Array.from(document.querySelectorAll('button')).find((b) => window.__a.text(b) === txt || window.__a.text(b).startsWith(txt)),
  clickBtn: (txt) => { const b = window.__a.btn(txt); if (!b) return false; b.click(); return true; },
  type: (txt) => { const el = document.activeElement; if (!el) return false; el.focus(); return true; },
  firstCard: () => document.querySelector('.reward-card'),
  cards: () => Array.from(document.querySelectorAll('.reward-card')),
};`;

async function key(send, k, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, COMMON);
  await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes('Награды')).click()`);
  await sleep(900);

  // scroll top
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await sleep(300);

  const cards = await evalJs(send, `(() => {
    const list = window.__a.cards();
    return {
      count: list.length,
      rects: list.map((c) => window.__a.rect(c)),
      sizes: [...new Set(list.map((c) => window.__a.rect(c).w + 'x' + window.__a.rect(c).h))],
      names: list.map((c) => c.querySelector('h3')?.textContent?.trim()),
      totals: { scrollH: document.querySelector('.content').scrollHeight, clientH: document.querySelector('.content').clientHeight },
      grid: (() => { const g = document.querySelector('.reward-grid'); const cs = getComputedStyle(g); return { cols: cs.gridTemplateColumns, gap: cs.gap, rect: window.__a.rect(g) }; })(),
      filters: Array.from(document.querySelectorAll('.reward-filters .filter-pill')).map((b) => ({ text: window.__a.text(b), active: b.classList.contains('is-active'), rect: window.__a.rect(b) })),
      toolbarButtons: Array.from(document.querySelectorAll('.toolbar-row button, .view-switch button')).map((b) => ({ text: window.__a.text(b), rect: window.__a.rect(b) })),
      searchPlaceholder: document.querySelector('.search-field input')?.placeholder,
      cardInteractives: Array.from(list[0].querySelectorAll('button')).map((b) => ({ text: b.textContent.trim().slice(0, 20), title: b.title, rect: window.__a.rect(b), cls: b.className })),
    };
  })()`);
  saveNote('40-rewards-cards', cards);
  console.log('CARDS', JSON.stringify(cards, null, 1).slice(0, 4000));

  // scroll to bottom for demo panel screenshot
  await evalJs(send, `document.querySelector('.content').scrollTop = document.querySelector('.content').scrollHeight`);
  await sleep(400);
  await screenshot(send, '41-rewards-bottom');
  const bottom = await evalJs(send, `(() => {
    const panels = Array.from(document.querySelectorAll('.ui-panel'));
    const last = panels[panels.length - 1];
    return { panels: panels.map((p) => window.__a.text(p).slice(0, 80)), lastPanelRect: last ? window.__a.rect(last) : null, lastPanelText: last ? window.__a.text(last) : null, scrollTop: document.querySelector('.content').scrollTop };
  })()`);
  saveNote('42-rewards-bottom', bottom);
  console.log('BOTTOM', JSON.stringify(bottom, null, 1));

  // scroll back top
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);

  // Search test
  const beforeSearch = await evalJs(send, `window.__a.cards().length`);
  await evalJs(send, `document.querySelector('.search-field input').focus()`);
  await send('Input.insertText', { text: 'ставка' });
  await sleep(600);
  const search = await evalJs(send, `({ inputValue: document.querySelector('.search-field input').value, cards: window.__a.cards().length, filtered: document.querySelectorAll('.reward-card').length })`);
  await screenshot(send, '43-rewards-search-typed');
  console.log('SEARCH before=' + beforeSearch, JSON.stringify(search));
  saveNote('43-rewards-search', { beforeSearch, search });

  // clear search input
  await evalJs(send, `document.querySelector('.search-field input').value = ''`);

  // Filters: iterate, collect visible count & pill counts
  const filterResults = [];
  await evalJs(send, `document.querySelectorAll('.reward-filters .filter-pill')[0].click()`);
  await sleep(300);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  const pillCount = await evalJs(send, `document.querySelectorAll('.reward-filters .filter-pill').length`);
  for (let i = 0; i < pillCount; i++) {
    await evalJs(send, `document.querySelectorAll('.reward-filters .filter-pill')[${i}].click()`);
    await sleep(350);
    const info = await evalJs(send, `({ label: window.__a.text(document.querySelectorAll('.reward-filters .filter-pill')[${i}]), countText: document.querySelectorAll('.reward-filters .filter-pill')[${i}].querySelector('span')?.textContent, visible: window.__a.cards().length, empty: Boolean(document.querySelector('.reward-empty')), emptyText: document.querySelector('.reward-empty') ? window.__a.text(document.querySelector('.reward-empty')) : null })`);
    filterResults.push(info);
    if (info.empty) await screenshot(send, '44-rewards-filter-empty-' + i);
  }
  saveNote('45-rewards-filters', filterResults);
  console.log('FILTERS', JSON.stringify(filterResults));
  await evalJs(send, `document.querySelectorAll('.reward-filters .filter-pill')[0].click()`);
  await sleep(300);

  // Card menu
  const firstCardRect = await evalJs(send, `window.__a.rect(window.__a.cards()[0])`);
  await evalJs(send, `window.__a.cards()[0].querySelector('.icon-ghost').click()`);
  await sleep(350);
  await screenshot(send, '46-rewards-card-menu');
  const menu = await evalJs(send, `(() => {
    const m = document.querySelector('.reward-menu');
    const c = window.__a.cards()[0];
    const cardRect = window.__a.rect(c);
    const menuRect = m ? window.__a.rect(m) : null;
    return { open: Boolean(m), cardRect, menuRect, overflow: menuRect ? { belowCard: menuRect.y + menuRect.h > cardRect.y + cardRect.h, rightOutside: menuRect.x + menuRect.w > cardRect.x + cardRect.w } : null, items: m ? Array.from(m.querySelectorAll('button')).map((b) => ({ text: b.textContent.trim(), cls: b.className, rect: window.__a.rect(b) })) : [] };
  })()`);
  await evalJs(send, `document.querySelector('.page-title').click()`);
  await sleep(250);
  const menuAfterOutside = await evalJs(send, `Boolean(document.querySelector('.reward-menu'))`);
  await key(send, 'Escape', 'Escape', 27);
  await sleep(200);
  const menuAfterEsc = await evalJs(send, `Boolean(document.querySelector('.reward-menu'))`);
  await evalJs(send, `window.__a.cards()[0].querySelector('.icon-ghost').click()`);
  await sleep(200);
  saveNote('46-rewards-menu', { firstCardRect, menu, menuAfterOutside, menuAfterEsc });
  console.log('MENU', JSON.stringify(menu), 'outsideClose=' + menuAfterOutside, 'escClose=' + menuAfterEsc);

  // Play sound (first card with sound)
  await evalJs(send, `document.querySelector('.reward-menu')?.remove()`);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await sleep(200);
  const playInfo = await evalJs(send, `(() => { const c = window.__a.cards().find((x) => x.querySelector('.play-button')); if (!c) return null; const b = c.querySelector('.play-button'); return { rect: window.__a.rect(b), title: b.title, aria: b.getAttribute('aria-label'), name: c.querySelector('h3')?.textContent }; })()`);
  await evalJs(send, `window.__a.cards().find((x) => x.querySelector('.play-button')).querySelector('.play-button').click()`);
  await sleep(700);
  const toast = await evalJs(send, `(() => { const t = document.querySelector('.ui-toast'); if (!t) return null; const cs = getComputedStyle(t); return { text: t.textContent, rect: window.__a.rect(t), z: cs.zIndex, ariaLive: t.getAttribute('aria-live'), role: t.getAttribute('role'), bg: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize }; })()`);
  await screenshot(send, '47-rewards-toast');
  saveNote('47-rewards-play-toast', { playInfo, toast });
  console.log('PLAY/TOAST', JSON.stringify({ playInfo, toast }));

  // Create modal
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await evalJs(send, `window.__a.btn('Создать награду').click()`);
  await sleep(500);
  await screenshot(send, '48-create-modal');
  const modal = await evalJs(send, `(() => {
    const m = document.querySelector('.ui-modal');
    const backdrop = document.querySelector('.ui-modal-backdrop');
    const active = document.activeElement;
    const buttons = Array.from(m.querySelectorAll('button')).map((b) => ({ text: b.textContent.trim(), disabled: b.disabled, rect: window.__a.rect(b) }));
    const inputs = Array.from(m.querySelectorAll('input,textarea,select')).map((i) => ({ tag: i.tagName, type: i.type, placeholder: i.placeholder, value: i.value, rect: window.__a.rect(i), font: getComputedStyle(i).fontSize }));
    return {
      rect: window.__a.rect(m),
      backdrop: { bg: getComputedStyle(backdrop).backgroundColor, blur: getComputedStyle(backdrop).backdropFilter },
      activeElement: { tag: active.tagName, cls: active.className, placeholder: active.placeholder },
      buttons, inputs,
      colorSwatches: Array.from(m.querySelectorAll('.palette-swatch, .color-swatch, .modal-color-preview')).map((s) => ({ cls: s.className, bg: getComputedStyle(s).backgroundColor, rect: window.__a.rect(s) })),
      dialogRole: { role: m.getAttribute('role'), ariaModal: m.getAttribute('aria-modal'), ariaLabel: m.getAttribute('aria-label') },
      title: m.querySelector('.ui-modal__title')?.textContent,
      subtitle: m.querySelector('.ui-modal__subtitle')?.textContent,
      scrollbar: { bodyScrollH: m.querySelector('.ui-modal__body').scrollHeight, bodyClientH: m.querySelector('.ui-modal__body').clientHeight },
    };
  })()`);
  saveNote('48-create-modal', modal);
  console.log('MODAL', JSON.stringify(modal, null, 1).slice(0, 4000));

  // Validation: name empty -> create disabled
  const disabledEmpty = await evalJs(send, `Array.from(document.querySelectorAll('.ui-modal button')).find((b) => b.textContent.includes('Создать награду')).disabled`);
  // type name
  await send('Input.insertText', { text: 'Тест аудита' });
  await sleep(300);
  const afterType = await evalJs(send, `({ name: document.querySelectorAll('.ui-modal input')[0].value, disabled: Array.from(document.querySelectorAll('.ui-modal button')).find((b) => b.textContent.includes('Создать награду')).disabled })`);
  // chain: cost field, letters stripped
  await evalJs(send, `document.querySelectorAll('.ui-modal input')[1].focus()`);
  await send('Input.insertText', { text: 'abc123' });
  await sleep(200);
  const costVal = await evalJs(send, `document.querySelectorAll('.ui-modal input')[1].value`);
  // Tab order inside modal
  const tabOrder = [];
  for (let i = 0; i < 12; i++) {
    await key(send, 'Tab', 'Tab', 9);
    await sleep(90);
    const a = await evalJs(send, `(() => { const el = document.activeElement; const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), text: (el.textContent || '').trim().slice(0, 20), placeholder: el.placeholder || '', inModal: Boolean(el.closest('.ui-modal')), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, outline: getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth + ' ' + getComputedStyle(el).outlineColor }; })()`);
    tabOrder.push(a);
    if (!a.inModal) break;
  }
  saveNote('49-create-modal-tabs', { disabledEmpty, afterType, costVal, tabOrder });
  console.log('TABORDER', JSON.stringify(tabOrder.map((t) => t.tag + ':' + t.placeholder + (t.inModal ? '' : ' OUTSIDE') + ' outline=' + t.outline)));
  await screenshot(send, '49-create-modal-tabfocus');

  // Escape test on modal
  await key(send, 'Escape', 'Escape', 27);
  await sleep(300);
  const modalAfterEsc = await evalJs(send, `Boolean(document.querySelector('.ui-modal'))`);
  console.log('modal still open after Esc:', modalAfterEsc);

  // outside click close
  await evalJs(send, `document.querySelector('.ui-modal-backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await sleep(300);
  const modalAfterOutside = await evalJs(send, `Boolean(document.querySelector('.ui-modal'))`);
  console.log('modal still open after backdrop mousedown:', modalAfterOutside);
  if (modalAfterOutside) { await evalJs(send, `document.querySelector('.ui-modal__close')?.click()`); await sleep(300); }

  // Edit modal via menu
  await evalJs(send, `window.__a.cards()[0].querySelector('.icon-ghost').click()`);
  await sleep(300);
  await evalJs(send, `Array.from(document.querySelectorAll('.reward-menu button')).find((b) => b.textContent.includes('Редактировать')).click()`);
  await sleep(400);
  await screenshot(send, '50-edit-modal');
  const editModal = await evalJs(send, `(() => { const m = document.querySelector('.ui-modal'); if (!m) return null; return { title: m.querySelector('.ui-modal__title')?.textContent, inputs: Array.from(m.querySelectorAll('input')).map((i) => i.value), buttons: Array.from(m.querySelectorAll('button')).map((b) => b.textContent.trim()), rect: window.__a.rect(m) }; })()`);
  console.log('EDIT', JSON.stringify(editModal));
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(300);

  // Delete modal via menu
  await evalJs(send, `window.__a.cards()[0].querySelector('.icon-ghost').click()`);
  await sleep(300);
  await evalJs(send, `Array.from(document.querySelectorAll('.reward-menu button')).find((b) => b.textContent.includes('Удалить награду')).click()`);
  await sleep(400);
  await screenshot(send, '51-delete-modal');
  const delModal = await evalJs(send, `(() => { const m = document.querySelector('.ui-modal'); if (!m) return null; return { title: m.querySelector('.ui-modal__title')?.textContent, subtitle: m.querySelector('.ui-modal__subtitle')?.textContent, body: m.querySelector('.ui-modal__body')?.innerText, buttons: Array.from(m.querySelectorAll('button')).map((b) => ({ text: b.textContent.trim(), cls: b.className, rect: window.__a.rect(b) })), rect: window.__a.rect(m) }; })()`);
  saveNote('51-delete-modal', delModal);
  console.log('DELETE', JSON.stringify(delModal));
  await evalJs(send, `window.__a.btn('Отмена').click()`);
  await sleep(300);
  const closed = await evalJs(send, `Boolean(document.querySelector('.ui-modal'))`);
  console.log('delete modal closed by cancel:', !closed);

  // Card volume control attrs
  const volumeInfo = await evalJs(send, `(() => { const row = document.querySelector('.reward-card .volume-row'); const track = row?.querySelector('.volume-track'); return { rowRect: row ? window.__a.rect(row) : null, cursor: row ? getComputedStyle(row).cursor : null, track: track ? window.__a.rect(track) : null, tabIndex: row?.tabIndex, title: row?.getAttribute('title'), aria: row?.getAttribute('aria-valuenow') }; })()`);
  console.log('CARD VOLUME', JSON.stringify(volumeInfo));

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
