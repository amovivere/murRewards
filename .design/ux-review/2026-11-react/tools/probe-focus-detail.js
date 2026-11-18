const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve(__dirname, '..', 'shots');

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  nav: (txt) => Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(txt)),
  desc: (el) => { const cs = getComputedStyle(el); return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 80), text: window.__a.text(el).slice(0, 40), placeholder: el.placeholder || '', outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, shadow: cs.boxShadow, bg: cs.backgroundColor, color: cs.color }; },
};`;

async function key(send, k, code, vk, mods = 0) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
}

async function cropShot(send, name, rect, pad = 26, scale = 2) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.w + pad * 2, height: rect.h + pad * 2, scale } });
  const file = path.join(SHOTS, name.endsWith('.png') ? name : name + '.png');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, COMMON);
  await evalJs(send, `window.__a.nav('Награды').click()`);
  await sleep(900);
  await evalJs(send, `document.querySelector('.content').scrollTop = 0`);
  await evalJs(send, `document.activeElement.blur(); document.body.focus();`);
  await sleep(200);

  // Tab through and capture focus states of interesting controls
  const wanted = [
    { name: 'focus-nav', test: (d) => d.cls.includes('nav-item') },
    { name: 'focus-health', test: (d) => d.cls.includes('health-chip') },
    { name: 'focus-winbtn', test: (d) => d.tag === 'BUTTON' && !d.text && d.cls === '' },
    { name: 'focus-pagedots', test: (d) => d.tag === 'BUTTON' && !d.text && d.cls.includes('ui-button--ghost') },
    { name: 'focus-search', test: (d) => d.tag === 'INPUT' && (d.placeholder || '').includes('Поиск') },
    { name: 'focus-viewswitch', test: (d) => d.tag === 'BUTTON' && (d.text === 'Плитка' || d.text === 'Список') },
    { name: 'focus-filterpill', test: (d) => d.cls.includes('filter-pill') },
    { name: 'focus-carddots', test: (d) => d.cls.includes('icon-ghost') },
    { name: 'focus-play', test: (d) => d.cls.includes('play-button') },
  ];
  const found = [];
  for (let i = 0; i < 80 && found.length < wanted.length; i++) {
    await key(send, 'Tab', 'Tab', 9);
    await sleep(50);
    const d = await evalJs(send, `(() => { const el = document.activeElement; if (!el || el === document.body) return null; return Object.assign(window.__a.desc(el), { rect: window.__a.rect(el) }); })()`);
    if (!d) break;
    for (const w of wanted) {
      if (found.some((f) => f.name === w.name)) continue;
      if (w.test(d)) {
        found.push({ name: w.name, desc: d });
        await cropShot(send, w.name, d.rect);
        console.log('FOCUS', w.name, JSON.stringify(d));
      }
    }
  }
  saveNote('b0-focus-states', found);
  console.log('FOCUS captured', found.map((f) => f.name).join(','));

  // Keyboard activation of filter pill
  await evalJs(send, `document.querySelector('.search-field input').focus()`);
  for (let i = 0; i < 5; i++) { await key(send, 'Tab', 'Tab', 9); await sleep(40); }
  const activeIsFilter = await evalJs(send, `document.activeElement.className`);
  const beforeCount = await evalJs(send, `document.querySelectorAll('.reward-card').length`);
  await key(send, 'Enter', 'Enter', 13);
  await sleep(500);
  const afterCount = await evalJs(send, `({ cards: document.querySelectorAll('.reward-card').length, activeFilter: window.__a.text(document.querySelector('.filter-pill.is-active')), focus: document.activeElement.className })`);
  console.log('KEYBOARD FILTER active=' + activeIsFilter, 'before=' + beforeCount, 'after=' + JSON.stringify(afterCount));
  saveNote('b1-keyboard-filter', { activeIsFilter, beforeCount, afterCount });
  await key(send, 'Home', 'Home', 36);
  await evalJs(send, `document.querySelectorAll('.filter-pill')[0].click()`);
  await sleep(400);

  // Card overflow + menu clipping
  const cardCss = await evalJs(send, `(() => {
    const card = document.querySelector('.reward-card');
    const cs = getComputedStyle(card);
    const grid = getComputedStyle(document.querySelector('.reward-grid'));
    return { cardOverflow: cs.overflow, cardPosition: cs.position, cardZ: cs.zIndex, cardTransform: cs.transform, gridOverflow: grid.overflow, gridZ: grid.zIndex, cardBg: cs.backgroundColor, cardBgImage: cs.backgroundImage.slice(0, 120) };
  })()`);
  console.log('CARD CSS', JSON.stringify(cardCss));
  await evalJs(send, `document.querySelector('.reward-card .icon-ghost').click()`);
  await sleep(400);
  const clipInfo = await evalJs(send, `(() => {
    const menu = document.querySelector('.reward-menu');
    const card = document.querySelector('.reward-card');
    const cr = card.getBoundingClientRect();
    const items = Array.from(menu.querySelectorAll('button')).map((b) => { const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), visibleInCard: r.bottom <= Math.round(cr.bottom), clippedByCard: r.bottom > cr.bottom }; });
    return { cardBottom: Math.round(cr.bottom), menuRect: window.__a.rect(menu), items, cardOverflow: getComputedStyle(card).overflow, menuOverflow: getComputedStyle(menu).overflow, pointerEvents: getComputedStyle(menu.querySelectorAll('button')[3]).pointerEvents };
  })()`);
  console.log('MENU CLIP', JSON.stringify(clipInfo, null, 1));
  saveNote('b2-card-menu-clip', clipInfo);
  await cropShot(send, 'b2-card-menu-clip', await evalJs(send, `window.__a.rect(document.querySelector('.reward-card'))`), 10);

  // keyboard reach clipped delete item
  await evalJs(send, `document.querySelector('.reward-card .icon-ghost').focus()`);
  await key(send, 'Enter', 'Enter', 13);
  await sleep(300);
  const menuTab = [];
  for (let i = 0; i < 6; i++) {
    await key(send, 'Tab', 'Tab', 9);
    await sleep(60);
    menuTab.push(await evalJs(send, `(() => { const el = document.activeElement; return { text: (el.textContent || '').trim().slice(0, 30), cls: (el.className || '').toString().slice(0, 40), rect: el.getBoundingClientRect ? window.__a.rect(el) : null }; })()`));
  }
  console.log('MENU TAB', JSON.stringify(menuTab));
  saveNote('b3-card-menu-tab', menuTab);
  await evalJs(send, `document.querySelector('.page-title').click()`);
  await sleep(300);

  // Hover states
  const cardRect = await evalJs(send, `window.__a.rect(document.querySelector('.reward-card'))`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cardRect.x + 40, y: cardRect.y + 40 });
  await sleep(400);
  const hover = await evalJs(send, `(() => { const c = document.querySelector('.reward-card'); const cs = getComputedStyle(c); return { borderColor: cs.borderColor, transform: cs.transform, bg: cs.backgroundColor, boxShadow: cs.boxShadow.slice(0, 80), cursor: cs.cursor }; })()`);
  console.log('CARD HOVER', JSON.stringify(hover));
  await screenshot(send, 'b4-card-hover');
  saveNote('b4-hover', { hover });

  // Key text styles (typography + colors)
  const styles = await evalJs(send, `(() => {
    const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); return { sel, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, color: cs.color, letterSpacing: cs.letterSpacing, fontFamily: cs.fontFamily.split(',')[0] }; };
    const sels = ['.page-title', '.page-subtitle', '.eyebrow', '.ui-panel__title', '.ui-panel__description', '.reward-card h3', '.reward-meta', '.sound-name', '.sound-format', '.sound-empty', '.volume-row span', '.filter-pill', '.filter-pill span', '.nav-item', '.nav-label', '.brand-name', '.brand-sub', '.sidebar__version', '.footer', '.health-chip', '.volume-control__label', '.volume-control__value', '.log-time', '.log-level', '.log-text'];
    return sels.map(pick).filter(Boolean);
  })()`);
  saveNote('b5-type-styles', styles);
  console.log('TYPE STYLES', JSON.stringify(styles, null, 1));

  // card background pixel sampling for contrast
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
