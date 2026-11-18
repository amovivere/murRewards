const fs = require('fs');
const path = require('path');
const { evalJs, sleep, screenshot, saveNote } = require('./cdp');

async function connectBrowser(port = 9444, urlPrefix = 'http://127.0.0.1:8780') {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page' && t.url.startsWith(urlPrefix));
  if (!page) throw new Error('no app page target: ' + JSON.stringify(targets.filter((t) => t.type === 'page').map((t) => t.url)));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  };
  await new Promise((r, reject) => { ws.onopen = r; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { ws, send };
}

const COMMON = `window.__a = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  text: (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim(),
  nav: (txt) => Array.from(document.querySelectorAll('.nav-item')).find((x) => x.textContent.includes(txt)),
};`;

(async () => {
  const { send, ws } = await connectBrowser();
  await send('Page.enable');
  await evalJs(send, COMMON);
  await sleep(800);
  const pageInfo = await evalJs(send, `({ innerW: innerWidth, innerH: innerHeight, hasTauri: Boolean(window.__TAURI_INTERNALS__), nav: Array.from(document.querySelectorAll('.nav-item')).map((n) => n.textContent.replace(/\\s+/g,' ').trim()), state: document.querySelector('.page-title')?.textContent })`);
  console.log('BROWSER PAGE', JSON.stringify(pageInfo));
  await screenshot(send, 'browser-00-rewards-mock');

  // Onboarding
  await evalJs(send, `window.__a.nav('Онбординг').click()`);
  await sleep(900);
  await screenshot(send, 'browser-01-onboarding-connected');
  const onboarding = await evalJs(send, `(() => ({
    title: document.querySelector('.page-title')?.textContent,
    subtitle: document.querySelector('.page-subtitle')?.textContent,
    hero: { text: window.__a.text(document.querySelector('.onboarding-hero')), rect: window.__a.rect(document.querySelector('.onboarding-hero')) },
    actions: Array.from(document.querySelectorAll('.onboarding-actions button')).map((b) => ({ text: b.textContent.trim(), disabled: b.disabled, rect: window.__a.rect(b), cls: b.className })),
    steps: Array.from(document.querySelectorAll('.onboarding-step')).map((s) => ({ text: window.__a.text(s), done: s.classList.contains('is-done'), rect: window.__a.rect(s) })),
    bindings: Array.from(document.querySelectorAll('.local-row')).map((r) => ({ text: window.__a.text(r), rect: window.__a.rect(r), button: (() => { const b = r.querySelector('button'); return b ? { text: b.textContent.trim(), rect: window.__a.rect(b) } : null; })() })),
    scroll: { h: document.querySelector('.content').scrollHeight, client: document.querySelector('.content').clientHeight },
  }))()`);
  saveNote('browser-onboarding', onboarding);
  console.log('ONBOARDING', JSON.stringify(onboarding, null, 1).slice(0, 4000));

  // Music mock (empty queue + current)
  await evalJs(send, `window.__a.nav('Музыка').click()`);
  await sleep(700);
  await screenshot(send, 'browser-02-music-mock');
  const musicMock = await evalJs(send, `({ player: window.__a.text(document.querySelector('.player') || document.querySelector('.ui-panel')), queueEmpty: Boolean(document.querySelector('.empty-state')), queueText: document.querySelector('.empty-state') ? window.__a.text(document.querySelector('.empty-state')) : null, panels: Array.from(document.querySelectorAll('.ui-panel')).map((p) => ({ title: p.querySelector('.ui-panel__title')?.textContent, text: window.__a.text(p).slice(0, 160) })) })`);
  console.log('MUSIC MOCK', JSON.stringify(musicMock, null, 1).slice(0, 2500));
  saveNote('browser-music-mock', musicMock);

  // Rewards mock + states panel + menu
  await evalJs(send, `window.__a.nav('Награды').click()`);
  await sleep(700);
  const rewardsMock = await evalJs(send, `({ cards: document.querySelectorAll('.reward-card').length, subtitle: document.querySelector('.page-subtitle')?.textContent, filters: Array.from(document.querySelectorAll('.filter-pill')).map((b) => window.__a.text(b)), panels: Array.from(document.querySelectorAll('.ui-panel')).map((p) => window.__a.text(p).slice(0, 140)), musicCard: Boolean(document.querySelector('.reward-card.is-music')) })`);
  console.log('REWARDS MOCK', JSON.stringify(rewardsMock, null, 1));
  saveNote('browser-rewards-mock', rewardsMock);

  // Cleanup: no app state touched (mock only)
  ws.close();
  console.log('BROWSER DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
