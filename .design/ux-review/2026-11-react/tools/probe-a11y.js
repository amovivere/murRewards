const { connect, evalJs, sleep, screenshot, saveNote } = require('./cdp');

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  nav: (txt) => Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(txt)),
  parseColor: (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map((v) => parseFloat(v)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; },
  lum: (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); },
  blend: (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 }),
  effectiveBg: (el) => {
    let layers = [];
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const c = window.__a.parseColor(cs.backgroundColor);
      if (c && c.a > 0) {
        if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) return null;
        layers.push(c);
        if (c.a >= 1) break;
      }
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) return null;
      node = node.parentElement;
    }
    let base = { r: 5, g: 5, b: 6, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = window.__a.blend(layers[i], base);
    return base;
  },
  ratio: (fg, bg) => { const L1 = window.__a.lum(fg), L2 = window.__a.lum(bg); const a = Math.max(L1, L2), b = Math.min(L1, L2); return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100; },
  desc: (el) => { const cs = getComputedStyle(el); return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 90), id: el.id, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50), role: el.getAttribute('role'), aria: el.getAttribute('aria-label'), title: el.getAttribute('title'), placeholder: el.placeholder || '', rect: window.__a.rect(el), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, shadow: cs.boxShadow, tabIndex: el.tabIndex }; },
};`;

async function key(send, k, code, vk, mods = 0) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
}

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Accessibility.enable');
  await evalJs(send, COMMON);

  // ---------- Flash of mock data on load ----------
  await send('Page.reload', { ignoreCache: false });
  await sleep(280);
  await evalJs(send, COMMON + ';0');
  const flash1 = await evalJs(send, `(() => { const t = document.body.innerText; return { time: '280ms', hasMockSubtitle: t.includes('goshanmurz'), rewardCards: document.querySelectorAll('.reward-card').length, subtitle: document.querySelector('.page-subtitle')?.textContent, bootText: t.slice(0, 200) }; })()`);
  await screenshot(send, 'a0-load-280ms');
  await sleep(500);
  const flash2 = await evalJs(send, `(() => { const t = document.body.innerText; return { time: '780ms', hasMockSubtitle: t.includes('goshanmurz'), rewardCards: document.querySelectorAll('.reward-card').length, subtitle: document.querySelector('.page-subtitle')?.textContent }; })()`);
  await screenshot(send, 'a1-load-780ms');
  await sleep(2200);
  const flash3 = await evalJs(send, `(() => { const t = document.body.innerText; return { time: '3000ms', hasMockSubtitle: t.includes('goshanmurz'), rewardCards: document.querySelectorAll('.reward-card').length, subtitle: document.querySelector('.page-subtitle')?.textContent }; })()`);
  console.log('LOAD FLASH', JSON.stringify({ flash1, flash2, flash3 }, null, 1));
  saveNote('a0-load-flash', { flash1, flash2, flash3 });

  // ---------- AX tree unnamed controls ----------
  const ax = await send('Accessibility.getFullAXTree');
  const axNodes = (ax.nodes || []).map((n) => ({ role: n.role?.value, name: n.name?.value || '', ignored: n.ignored, description: n.description?.value || '', value: n.value?.value }));
  const interactiveRoles = ['button', 'switch', 'slider', 'textbox', 'combobox', 'checkbox', 'link', 'tab', 'menuitem', 'spinbutton'];
  const axInteractive = axNodes.filter((n) => interactiveRoles.includes(n.role));
  const unnamed = axInteractive.filter((n) => !n.name.trim());
  const roleCounts = {};
  for (const n of axInteractive) roleCounts[n.role] = (roleCounts[n.role] || 0) + 1;
  saveNote('a2-ax-tree', { roleCounts, interactive: axInteractive.slice(0, 300), unnamedCount: unnamed.length, unnamed: unnamed.slice(0, 80) });
  console.log('AX roles', JSON.stringify(roleCounts), 'unnamed=', unnamed.length);
  console.log('AX UNNAMED sample', JSON.stringify(unnamed.slice(0, 30)));

  // ---------- Tab order from start (rewards page) ----------
  await evalJs(send, `document.body.focus(); document.activeElement.blur();`);
  await sleep(200);
  const tabStops = [];
  for (let i = 0; i < 26; i++) {
    await key(send, 'Tab', 'Tab', 9);
    await sleep(70);
    tabStops.push(await evalJs(send, `(() => { const el = document.activeElement; if (!el || el === document.body) return { tag: 'BODY', end: true }; return window.__a.desc(el); })()`));
  }
  saveNote('a3-tab-order-rewards', tabStops);
  console.log('TAB ORDER', JSON.stringify(tabStops.map((t) => (t.tag || '?') + ':' + (t.text || t.placeholder || '').slice(0, 20) + ' | outline=' + (t.outline || '') + ' | shadow=' + (t.shadow || '').slice(0, 40))));

  // screenshot focus ring on a filter pill: tab until .filter-pill
  let reached = false;
  for (let i = 0; i < 30; i++) {
    const cls = await evalJs(send, `document.activeElement?.className || ''`);
    if (String(cls).includes('filter-pill')) { reached = true; break; }
    await key(send, 'Tab', 'Tab', 9);
    await sleep(50);
  }
  console.log('reached filter pill:', reached);
  if (reached) {
    await screenshot(send, 'a4-focus-filter-pill');
    const fs = await evalJs(send, `window.__a.desc(document.activeElement)`);
    console.log('FOCUS RING filter pill', JSON.stringify(fs));
  }

  // focus state on nav item
  await evalJs(send, `document.querySelector('.nav-item').focus()`);
  await key(send, 'Tab', 'Tab', 9);
  await key(send, 'Tab', 'Tab', 9, 8); // shift+tab back
  await sleep(150);
  const navFocus = await evalJs(send, `window.__a.desc(document.activeElement)`);
  console.log('NAV FOCUS', JSON.stringify(navFocus));
  await screenshot(send, 'a5-focus-nav');

  // search field focus (mouse)
  await evalJs(send, `document.querySelector('.search-field input').focus()`);
  await sleep(200);
  const searchFocus = await evalJs(send, `(() => { const i = document.querySelector('.search-field input'); const c = i.closest('.search-field'); const ci = getComputedStyle(i), cc = getComputedStyle(c); return { inputOutline: ci.outlineStyle + ' ' + ci.outlineWidth + ' ' + ci.outlineColor, wrapBorder: cc.borderColor, wrapShadow: cc.boxShadow, wrapBg: cc.backgroundColor }; })()`);
  console.log('SEARCH FOCUS', JSON.stringify(searchFocus));
  await screenshot(send, 'a6-focus-search');

  // ---------- Contrast scan for 5 pages ----------
  const pages = ['rewards', 'music', 'overlay', 'settings', 'log'];
  const contrastByPage = {};
  for (const p of pages) {
    const label = { rewards: 'Награды', music: 'Музыка', overlay: 'Оверлей', settings: 'Настройки', log: 'Журнал' }[p];
    await evalJs(send, `window.__a.nav(${JSON.stringify(label)}).click()`);
    await sleep(900);
    const res = await evalJs(send, `(() => {
      const out = { checked: 0, skippedGradient: 0, violations: [] };
      const walker = document.createTreeWalker(document.querySelector('.content') || document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      let node;
      while ((node = walker.nextNode())) {
        const text = (node.textContent || '').trim();
        if (!text || text.length < 2) continue;
        const el = node.parentElement;
        if (!el || seen.has(el)) continue;
        seen.add(el);
        if (!window.__a.rect(el) || window.__a.rect(el).w === 0) continue;
        if (el.closest('.sidebar')) continue;
        const cs = getComputedStyle(el);
        if (Number(cs.opacity) < 0.5) continue;
        const fg = window.__a.parseColor(cs.color);
        if (!fg) continue;
        const bg = window.__a.effectiveBg(el);
        if (!bg) { out.skippedGradient++; continue; }
        const fgBlend = window.__a.blend(fg, bg);
        const ratio = window.__a.ratio(fgBlend, bg);
        out.checked++;
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 600;
        const large = size >= 24 || (size >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
          out.violations.push({ ratio, need, text: text.slice(0, 60), cls: (el.className || '').toString().slice(0, 80), tag: el.tagName, fontSize: cs.fontSize, weight: cs.fontWeight, color: cs.color, bg: 'rgba(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')' });
        }
      }
      out.violations.sort((a, b) => a.ratio - b.ratio);
      out.violations = out.violations.slice(0, 40);
      return out;
    })()`);
    contrastByPage[p] = res;
    console.log('CONTRAST', p, 'checked=' + res.checked, 'skippedGradient=' + res.skippedGradient, 'violations=' + res.violations.length, JSON.stringify(res.violations.slice(0, 8)));
  }
  saveNote('a7-contrast', contrastByPage);

  // ---------- Target sizes ----------
  const targetSizes = {};
  for (const p of pages) {
    const label = { rewards: 'Награды', music: 'Музыка', overlay: 'Оверлей', settings: 'Настройки', log: 'Журнал' }[p];
    await evalJs(send, `window.__a.nav(${JSON.stringify(label)}).click()`);
    await sleep(800);
    const res = await evalJs(send, `(() => {
      const out = [];
      document.querySelectorAll('button, a, input, select, [role=switch], [tabindex]').forEach((el) => {
        const r = window.__a.rect(el);
        if (!r.w || !r.h) return;
        if (r.w < 32 || r.h < 32) out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), text: window.__a.text(el).slice(0, 30), aria: el.getAttribute('aria-label'), title: el.getAttribute('title'), w: r.w, h: r.h });
      });
      const seen = new Set();
      return out.filter((o) => { const k = o.tag + o.cls + o.text + o.w + o.h; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 60);
    })()`);
    targetSizes[p] = res;
    console.log('TARGETS', p, JSON.stringify(res.slice(0, 12)));
  }
  saveNote('a8-target-sizes', targetSizes);

  // ---------- Icon-only buttons without names (all pages) ----------
  const iconOnly = {};
  for (const p of pages) {
    const label = { rewards: 'Награды', music: 'Музыка', overlay: 'Оверлей', settings: 'Настройки', log: 'Журнал' }[p];
    await evalJs(send, `window.__a.nav(${JSON.stringify(label)}).click()`);
    await sleep(700);
    iconOnly[p] = await evalJs(send, `Array.from(document.querySelectorAll('button')).filter((b) => !window.__a.text(b) && !b.getAttribute('aria-label') && !b.title).map((b) => ({ cls: (b.className || '').toString().slice(0, 80), rect: window.__a.rect(b) }))`);
  }
  saveNote('a9-icon-only-buttons', iconOnly);
  console.log('ICON-ONLY', Object.fromEntries(Object.entries(iconOnly).map(([k, v]) => [k, v.length])));

  // ---------- Semantics: nav active, health aria ----------
  await evalJs(send, `window.__a.nav('Награды').click()`);
  await sleep(500);
  const sem = await evalJs(send, `({
    activeNav: (() => { const n = document.querySelector('.nav-item.is-active'); return n ? { text: n.textContent.trim(), ariaCurrent: n.getAttribute('aria-current'), ariaSelected: n.getAttribute('aria-selected'), role: n.getAttribute('role') } : null; })(),
    navRole: document.querySelector('.sidebar nav')?.getAttribute('role') || null,
    healthChip: (() => { const h = document.querySelector('.health-chip'); return { ariaExpanded: h.getAttribute('aria-expanded'), ariaHaspopup: h.getAttribute('aria-haspopup'), controls: h.getAttribute('aria-controls') }; })(),
    modalBackdropRole: document.querySelector('.ui-modal-backdrop')?.getAttribute('role') || null,
    htmlLang: document.documentElement.lang,
    buttonsInSidebar: document.querySelectorAll('.sidebar button').length,
    headings: { h1: document.querySelectorAll('h1').length, h2: document.querySelectorAll('h2').length },
  })`);
  console.log('SEMANTICS', JSON.stringify(sem));
  saveNote('a10-semantics', sem);

  // ---------- Modal focus trap ----------
  await evalJs(send, `window.__a.btn && 0; Array.from(document.querySelectorAll('.page-actions button')).find((b) => b.textContent.includes('Создать награду')).click()`);
  await sleep(500);
  const focusStart = await evalJs(send, `window.__a.desc(document.activeElement)`);
  // tab through all focusables in modal, record sequence and detect escape
  const modalTab = [];
  for (let i = 0; i < 24; i++) {
    await key(send, 'Tab', 'Tab', 9);
    await sleep(60);
    const d = await evalJs(send, `(() => { const el = document.activeElement; if (!el || el === document.body) return { tag: 'BODY' }; const inside = Boolean(el.closest('.ui-modal')); return Object.assign(window.__a.desc(el), { inside }); })()`);
    modalTab.push(d);
    if (d.tag === 'BODY') break;
    if (!d.inside && i > 2) break;
  }
  console.log('MODAL TAB', JSON.stringify(modalTab.map((t) => (t.inside ? 'IN' : 'OUT') + ':' + (t.tag || '?') + ':' + (t.text || t.placeholder || '').slice(0, 18))));
  saveNote('a11-modal-tab', { focusStart, modalTab });
  // close and check focus restoration
  await evalJs(send, `document.querySelector('.ui-modal__close').click()`);
  await sleep(400);
  const afterClose = await evalJs(send, `({ active: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null, body: document.activeElement === document.body })`);
  console.log('AFTER MODAL CLOSE focus:', JSON.stringify(afterClose));
  saveNote('a12-modal-focus-return', afterClose);

  // ---------- Tooltips count ----------
  const titles = await evalJs(send, `({ withTitle: document.querySelectorAll('[title]').length, titleTexts: Array.from(document.querySelectorAll('[title]')).map((e) => e.getAttribute('title')).slice(0, 20) })`);
  console.log('TITLES', JSON.stringify(titles));
  saveNote('a13-titles', titles);

  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
