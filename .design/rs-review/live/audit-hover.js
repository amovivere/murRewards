const { connect, evalJs, sleep, screenshot, OUT } = require('./cdp');
const fs = require('fs');
const path = require('path');

const PROPS = [
  'background-color',
  'background-image',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'outline-style',
  'outline-color',
  'outline-width',
  'box-shadow',
  'filter',
  'opacity',
  'transform',
  'text-decoration-line',
  'width',
  'height',
  'top',
  'left',
  'margin-left',
  'cursor',
];

const snapExpr = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const cs = getComputedStyle(el);
  const out = {};
  for (const p of ${JSON.stringify(PROPS)}) out[p] = cs.getPropertyValue(p);
  out.__svg = Array.from(el.querySelectorAll('svg')).map((s) => {
    const c = getComputedStyle(s);
    return c.stroke + '|' + c.fill + '|' + c.opacity;
  });
  return out;
})()`;

function diff(a, b) {
  if (!a || !b) return ['<missing>'];
  const d = [];
  for (const k of Object.keys(a)) {
    if (k === '__svg') continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push(`${k}: ${a[k]} -> ${b[k]}`);
  }
  if (JSON.stringify(a.__svg) !== JSON.stringify(b.__svg)) d.push(`svg: ${JSON.stringify(a.__svg)} -> ${JSON.stringify(b.__svg)}`);
  return d;
}

const describe = (m) => `${m.tag.toLowerCase()}${m.id ? '#' + m.id : ''}${m.cls ? '.' + m.cls.trim().split(/\s+/).join('.') : ''}${m.title ? ' title="' + m.title + '"' : ''}`;

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('CSS.enable');

  const screens = process.argv.slice(2);
  const list = screens.length ? screens : ['rewards', 'music', 'onboarding', 'settings', 'log'];
  const report = [];

  for (const name of list) {
    // render (ignore app exceptions: rewards render currently throws later in the function)
    await evalJs(
      send,
      `(() => { try { window.RS.render(${JSON.stringify(name)}); } catch (e) { window.__lastRenderError = String(e); } return true; })()`
    );
    await sleep(name === 'log' ? 900 : 400);
    if (name === 'settings' || name === 'log') {
      // these are generated fully
    }
    const rootId = (await send('DOM.getDocument', { depth: 0 })).root.nodeId;
    const meta = await evalJs(
      send,
      `(() => {
        let els = Array.from(document.querySelectorAll('#content *, .topbar *, .titlebar *, .sidebar *'))
          .filter((el) => {
            if (getComputedStyle(el).cursor !== 'pointer') return false;
            const parent = el.parentElement;
            if (parent && getComputedStyle(parent).cursor === 'pointer') return false;
            return true;
          });
        els = Array.from(new Set(els));
        els.forEach((el, i) => el.setAttribute('data-hover-test', String(i)));
        return els.map((el, i) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            i,
            tag: el.tagName,
            id: el.id || '',
            cls: (el.className && typeof el.className === 'string') ? el.className : '',
            title: el.getAttribute('title') || '',
            text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
            rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            inlineStyle: (el.getAttribute('style') || '').slice(0, 90),
            display: cs.display,
          };
        });
      })()`
    );
    console.log(`\n=== ${name}: ${meta.length} pointer elements ===`);
    for (const m of meta) {
      const sel = `[data-hover-test="${m.i}"]`;
      const before = await evalJs(send, snapExpr(sel));
      const { nodeId } = await send('DOM.querySelector', {
        nodeId: rootId,
        selector: sel,
      });
      if (!nodeId) {
        console.log(`  ! node not found ${describe(m)}`);
        continue;
      }
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
      await sleep(220);
      const after = await evalJs(send, snapExpr(sel));
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await sleep(20);
      const d = diff(before, after);
      const line = { screen: name, desc: describe(m), text: m.text, rect: m.rect, inlineStyle: m.inlineStyle, changes: d };
      report.push(line);
      if (d.length === 0) {
        console.log(`  NO HOVER  ${describe(m)} | "${m.text}" @${m.rect.join(',')}`);
      } else {
        console.log(`  ok  ${describe(m)} | "${m.text}" :: ${d.join('; ')}`);
      }
    }
  }
  const out = path.join(OUT, 'hover-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\nreport:', out);
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
