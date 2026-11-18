const { connect, evalJs, sleep, screenshot, saveNote, inventory, pageInfo } = require('./cdp');

const JS_COMMON = `
  window.__audit = {
    visible: (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; },
    react: (el) => { const k = Object.keys(el).find((key) => key.startsWith('__reactProps')); return k ? (el[k] || {}) : null; },
    hasHandler: (el) => { const p = window.__audit.react(el); return Boolean(p && (typeof p.onClick === 'function' || typeof p.onChange === 'function' || typeof p.onKeyDown === 'function' || typeof p.onMouseDown === 'function')); },
    rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
    label: (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').replace(/\\s+/g, ' ').trim()).slice(0, 80),
    parseColor: (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    },
    lum: (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    },
    bgOf: (el) => {
      let node = el;
      while (node) {
        const cs = getComputedStyle(node);
        const c = window.__audit.parseColor(cs.backgroundColor);
        if (c && c.a > 0.5) return c;
        if (cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) return null;
        node = node.parentElement;
      }
      return null;
    },
    ratio: (fg, bg) => {
      const L1 = window.__audit.lum(fg), L2 = window.__audit.lum(bg);
      const a = Math.max(L1, L2), b = Math.min(L1, L2);
      return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
    },
  };
`;

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await evalJs(send, JS_COMMON);

  const shell = await evalJs(send, `(() => {
    const q = (s) => document.querySelector(s);
    const info = {};
    const grab = (name, sel) => { const el = q(sel); if (!el) { info[name] = null; return; } const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); info[name] = { rect: window.__audit.rect(el), text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80), cursor: cs.cursor, tabIndex: el.tabIndex, role: el.getAttribute('role'), title: el.getAttribute('title'), handlers: window.__audit.hasHandler(el) }; };
    grab('healthChip', '.health-chip');
    grab('volumeControl', '.volume-control');
    grab('volumeTrack', '.volume-track--top');
    grab('volumeValue', '.volume-control__value');
    grab('windowControls', '.window-controls');
    document.querySelectorAll('.window-controls button').forEach((b, i) => { info['winBtn' + i] = { rect: window.__audit.rect(b), title: b.getAttribute('title'), text: b.textContent, handlers: window.__audit.hasHandler(b) }; });
    grab('topbar', '.topbar');
    grab('footer', '.footer');
    grab('brand', '.sidebar__brand');
    info.topbarStyle = (() => { const cs = getComputedStyle(q('.topbar')); return { dragRegion: q('.topbar').hasAttribute('data-tauri-drag-region'), appRegion: cs.getPropertyValue('-webkit-app-region') }; })();
    info.scale = { dpr: devicePixelRatio, innerW: innerWidth, innerH: innerHeight, bodyW: document.body.clientWidth, bodyH: document.body.clientHeight, shellW: q('.app-shell').getBoundingClientRect().width, shellH: q('.app-shell').getBoundingClientRect().height, shellLeft: q('.app-shell').getBoundingClientRect().x };
    info.pageInfo = { scrollbars: { content: (() => { const c = q('.content'); return { clientW: c.clientWidth, offsetW: c.offsetWidth, scrollH: c.scrollHeight, clientH: c.clientHeight }; })() } };
    return info;
  })()`);
  saveNote('30-shell', shell);
  console.log('SHELL', JSON.stringify(shell, null, 1));

  // Health popover open
  await evalJs(send, `document.querySelector('.health-chip').click()`);
  await sleep(400);
  await screenshot(send, '20-health-popover');
  const pop = await evalJs(send, `(() => {
    const el = document.querySelector('.health-popover');
    if (!el) return null;
    return {
      rect: window.__audit.rect(el),
      text: el.innerText.replace(/\\n+/g, ' | ').slice(0, 500),
      rows: Array.from(el.querySelectorAll('.health-popover__rows button')).map((b) => ({ text: b.innerText.replace(/\\n+/g, ' · ').slice(0, 120), rect: window.__audit.rect(b), handlers: window.__audit.hasHandler(b) })),
      footer: (() => { const f = el.querySelector('.health-popover__footer'); return f ? { text: f.textContent.trim(), rect: window.__audit.rect(f) } : null; })(),
      style: (() => { const cs = getComputedStyle(el); return { zIndex: cs.zIndex, position: cs.position, overflow: cs.overflow }; })(),
      loginText: el.innerText.includes('goshanmurz') ? 'goshanmurz (hardcoded)' : (el.innerText.match(/@goshanmur\\w*/) || [null])[0],
    };
  })()`);
  saveNote('31-health-popover', pop);
  console.log('POPOVER', JSON.stringify(pop, null, 1));

  // Click outside (content area) -> does popover close?
  await evalJs(send, `document.querySelector('.page-title').click()`);
  await sleep(350);
  const stillOpen = await evalJs(send, `Boolean(document.querySelector('.health-popover'))`);
  console.log('POPOVER still open after outside click:', stillOpen);
  await screenshot(send, '21-health-after-outside-click');
  // Escape key
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(250);
  const stillOpenEsc = await evalJs(send, `Boolean(document.querySelector('.health-popover'))`);
  console.log('POPOVER still open after Escape:', stillOpenEsc);
  if (stillOpenEsc) { await evalJs(send, `document.querySelector('.health-chip').click()`); await sleep(200); }

  // Dead controls scan across pages
  const pages = ['rewards', 'music', 'overlay', 'settings', 'log'];
  const deadByPage = {};
  for (const p of pages) {
    const label = { rewards: 'Награды', music: 'Музыка', overlay: 'Оверлей', settings: 'Настройки', log: 'Журнал' }[p];
    await evalJs(send, `Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(${JSON.stringify(label)})).click()`);
    await sleep(800);
    const dead = await evalJs(send, `(() => {
      const out = { buttons: [], anchors: [], pseudo: [] };
      document.querySelectorAll('button').forEach((b) => {
        if (!window.__audit.visible(b)) return;
        if (!window.__audit.hasHandler(b)) out.buttons.push({ text: window.__audit.label(b), cls: b.className.slice(0, 120), title: b.getAttribute('title') || '', rect: window.__audit.rect(b) });
      });
      document.querySelectorAll('a').forEach((a) => {
        if (!window.__audit.visible(a)) return;
        if (!a.getAttribute('href') && !window.__audit.hasHandler(a)) out.anchors.push({ text: window.__audit.label(a), cls: a.className.slice(0, 120), rect: window.__audit.rect(a) });
      });
      // divs that look like controls
      ['.volume-control', '.volume-track--top', '.volume-track', '.player__progress', '.progress-track', '.reward-card .volume-row', '.preset-bar__select'].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (!window.__audit.visible(el)) return;
          if (el.closest('button') || el.closest('input') || el.closest('label') || el.closest('a')) return;
          if (el.querySelector('input,select,button,a')) return;
          out.pseudo.push({ sel, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60), rect: window.__audit.rect(el), cursor: getComputedStyle(el).cursor });
        });
      });
      return out;
    })()`);
    deadByPage[p] = dead;
    console.log('DEAD', p, 'buttons=' + dead.buttons.length, 'anchors=' + dead.anchors.length, 'pseudo=' + dead.pseudo.length);
  }
  saveNote('32-dead-controls', deadByPage);
  console.log(JSON.stringify(deadByPage.rewards, null, 1).slice(0, 4500));
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
