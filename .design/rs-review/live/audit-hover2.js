const { connect, evalJs, sleep, OUT } = require('./cdp');
const fs = require('fs');
const path = require('path');

const PROPS = [
  'background-color',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-style',
  'outline-color',
  'box-shadow',
  'filter',
  'opacity',
  'transform',
  'width',
  'height',
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
    return c.stroke + '|' + c.fill;
  });
  const knob = el.querySelector('.knob, #progress-knob');
  out.__knob = knob ? (() => { const c = getComputedStyle(knob); return [c.width, c.height, c.top, c.transform].join('|'); })() : '';
  return out;
})()`;

function diff(a, b) {
  if (!a || !b) return ['<missing>'];
  const d = [];
  for (const k of Object.keys(a)) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push(`${k.replace('__', '')}: ${a[k]} -> ${b[k]}`);
  }
  return d;
}

const describe = (m) =>
  `${m.tag.toLowerCase()}${m.id ? '#' + m.id : ''}${m.cls ? '.' + m.cls.trim().split(/\s+/).join('.') : ''}${m.title ? ' title="' + m.title + '"' : ''}`;

async function auditScreen(send, name) {
  const rootId = (await send('DOM.getDocument', { depth: 0 })).root.nodeId;
  const meta = await evalJs(
    send,
    `(() => {
      let els = Array.from(document.querySelectorAll('.modal-scrim *, #content *, .topbar *, .titlebar *, .sidebar *'))
        .filter((el) => {
          if (getComputedStyle(el).cursor !== 'pointer') return false;
          const parent = el.parentElement;
          if (parent && getComputedStyle(parent).cursor === 'pointer') return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      els.forEach((el, i) => el.setAttribute('data-hover-test', String(i)));
      return els.map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          i,
          tag: el.tagName,
          id: el.id || '',
          cls: (el.className && typeof el.className === 'string') ? el.className : '',
          title: el.getAttribute('title') || '',
          text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
          rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        };
      });
    })()`
  );
  console.log(`\n=== ${name}: ${meta.length} pointer elements ===`);
  const rows = [];
  for (const m of meta) {
    const sel = `[data-hover-test="${m.i}"]`;
    const before = await evalJs(send, snapExpr(sel));
    const { nodeId } = await send('DOM.querySelector', { nodeId: rootId, selector: sel });
    if (!nodeId) continue;
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
    await sleep(200);
    const after = await evalJs(send, snapExpr(sel));
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    await sleep(10);
    const d = diff(before, after);
    rows.push({ screen: name, desc: describe(m), text: m.text, rect: m.rect, changes: d });
    if (d.length === 0) console.log(`  NO HOVER  ${describe(m)} | "${m.text}" @${m.rect.join(',')}`);
    else console.log(`  ok  ${describe(m)} | "${m.text}" :: ${d.slice(0, 6).join('; ')}`);
    // clean attribute to avoid stale selectors
    await evalJs(send, `document.querySelector(${JSON.stringify(sel)})?.removeAttribute('data-hover-test'); true`);
  }
  return rows;
}

(async () => {
  const { send, ws } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('CSS.enable');

  const list = process.argv.slice(2).length ? process.argv.slice(2) : ['rewards', 'music', 'onboarding', 'settings', 'log', 'obs-modal', 'reward-modal'];
  let report = [];
  for (const name of list) {
    if (name === 'obs-modal') {
      await evalJs(send, `(() => { try { window.RS.render('music'); } catch (e) {} return true; })()`);
      await sleep(400);
      await evalJs(send, `document.querySelector('#obs-header')?.click(); true`);
      await sleep(400);
      report = report.concat(await auditScreen(send, name));
      await evalJs(send, `document.querySelector('#obs-close')?.click(); true`);
      await sleep(250);
      continue;
    }
    if (name === 'reward-modal') {
      await evalJs(send, `(() => { try { window.RS.render('rewards'); } catch (e) {} return true; })()`);
      await sleep(500);
      await evalJs(send, `document.querySelector('.head-actions .btn-primary')?.click(); true`);
      await sleep(400);
      report = report.concat(await auditScreen(send, name));
      await evalJs(send, `document.querySelector('#reward-modal-close')?.click(); true`);
      await sleep(250);
      continue;
    }
    await evalJs(
      send,
      `(() => { try { window.RS.render(${JSON.stringify(name)}); } catch (e) { console.warn(e); } return true; })()`
    );
    await sleep(name === 'log' ? 900 : 400);
    report = report.concat(await auditScreen(send, name));
  }

  const out = path.join(OUT, 'hover-report-v2.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\nreport:', out);
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
