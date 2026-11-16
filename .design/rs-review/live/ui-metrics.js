const { connect } = require('./cdp');

(async () => {
  const { send, ws } = await connect();
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) return { error: r.exceptionDetails.text };
    return r.result.value;
  };
  const info = await evaluate(`(() => {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    const cs = (sel, props) => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, c.getPropertyValue(p)])); };
    return {
      content: rect('#content'),
      toolbar: rect('#rewards-toolbar'),
      grid: rect('#reward-grid, #rewards-list'),
      seg: rect('#view-mode'),
      segItems: Array.from(document.querySelectorAll('#view-mode .seg-item')).map(el => [el.textContent.trim(), Math.round(el.getBoundingClientRect().width), getComputedStyle(el).padding, getComputedStyle(el).borderRadius]),
      select: rect('#reward-sort'),
      search: rect('.toolbar .search'),
      gridStyle: cs('#rewards-list', ['display', 'grid-template-columns', 'gap', 'width']),
      cards: Array.from(document.querySelectorAll('.reward-card')).slice(0,3).map(el => Math.round(el.getBoundingClientRect().width)),
      playingHidden: document.querySelector('#playing-indicator')?.hidden,
      playingDisplay: getComputedStyle(document.querySelector('#playing-indicator')).display,
    };
  })()`);
  console.log(JSON.stringify(info, null, 2));
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
