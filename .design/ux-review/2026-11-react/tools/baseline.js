const { connect, evalJs, sleep, screenshot, saveNote, inventory, pageInfo } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  // fresh page load resets React state without touching data
  await send('Page.reload', { ignoreCache: false });
  await sleep(3500);

  const pi = await pageInfo(send);
  console.log('PAGE', JSON.stringify(pi));
  await screenshot(send, '00-initial');

  // Shell layout metrics + nav inventory
  const shell = await evalJs(send, `(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { x: r.x, y: r.y, w: r.width, h: r.height, padding: s.padding, gap: s.gap, overflow: s.overflow, scrollH: el.scrollHeight, clientH: el.clientHeight };
    };
    return {
      shell: pick('.app-shell'), sidebar: pick('.sidebar'), topbar: pick('.topbar'), content: pick('.content'),
      footer: pick('.footer'), main: pick('.main'),
      contentScroll: (() => { const c = document.querySelector('.content'); return c ? { scrollTop: c.scrollTop, scrollH: c.scrollHeight, clientH: c.clientHeight } : null; })(),
      navItems: Array.from(document.querySelectorAll('.nav-item')).map((b) => ({ text: b.textContent.replace(/\\s+/g,' ').trim(), active: b.classList.contains('is-active'), rect: (()=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})() })),
      topbarText: document.querySelector('.topbar')?.textContent.replace(/\\s+/g,' ').trim(),
      footerText: document.querySelector('.footer')?.textContent.replace(/\\s+/g,' ').trim(),
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.tagName + ':' + h.textContent.replace(/\\s+/g,' ').trim()).slice(0, 40),
      state: window.__TAURI_INTERNALS__ ? 'tauri' : 'browser',
    };
  })()`);
  saveNote('01-shell', shell);
  console.log('SHELL', JSON.stringify(shell, null, 1).slice(0, 3000));

  const inv = await inventory(send);
  saveNote('02-inventory-rewards', inv);
  console.log('INVENTORY count', inv.length);

  // Switch through tabs by clicking nav buttons
  const tabs = ['rewards', 'music', 'overlay', 'settings', 'log'];
  for (const t of tabs) {
    const label = { rewards: 'Награды', music: 'Музыка', overlay: 'Оверлей', settings: 'Настройки', log: 'Журнал' }[t];
    const res = await evalJs(send, `(() => {
      const b = Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(${JSON.stringify(label)}));
      if (!b) return { ok: false };
      b.click();
      return { ok: true };
    })()`);
    if (!res.ok) { console.log('NO TAB', t); continue; }
    await sleep(900);
    await screenshot(send, `10-tab-${t}`);
    const info = await evalJs(send, `(() => {
      const c = document.querySelector('.content');
      const page = document.querySelector('.page');
      return {
        tab: ${JSON.stringify(t)},
        pageTitle: document.querySelector('.page-title')?.textContent?.trim() || null,
        pageSub: document.querySelector('.page-subtitle')?.textContent?.trim() || null,
        contentScroll: c ? { scrollH: c.scrollHeight, clientH: c.clientHeight, scrollTop: c.scrollTop } : null,
        pageRect: page ? (() => { const r = page.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() : null,
        text: c ? c.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 3000) : null,
        counts: { buttons: document.querySelectorAll('button').length, inputs: document.querySelectorAll('input').length, panels: document.querySelectorAll('.ui-panel').length },
      };
    })()`);
    saveNote(`10-tab-${t}`, info);
    const invTab = await inventory(send);
    saveNote(`11-inventory-${t}`, invTab);
    console.log('TAB', t, JSON.stringify({ title: info.pageTitle, scroll: info.contentScroll, counts: info.counts }));
  }

  await evalJs(send, `document.querySelectorAll('.nav-item')[0].click()`);
  ws.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
