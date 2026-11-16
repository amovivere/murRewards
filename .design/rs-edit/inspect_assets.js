const fs = require('fs');
const zlib = require('zlib');
const path = process.argv[2];
for (const f of fs.readdirSync(path)) {
  const p = path + '\\' + f;
  const b = fs.readFileSync(p);
  let out;
  try { out = zlib.brotliDecompressSync(b).toString('utf8'); }
  catch (e) { try { out = b.toString('utf8'); } catch { continue; } }
  if (out.includes('renderCoreRewards') || out.includes('IPC:') || out.includes('get_state') || out.includes('core_status')) {
    console.log('MATCH', f, 'len', out.length);
    const i = out.indexOf('renderCoreRewards');
    if (i>=0) console.log(out.slice(Math.max(0,i-120), i+200));
    const j = out.indexOf('IPC:');
    if (j>=0) console.log('IPC:', out.slice(Math.max(0,j-80), j+120));
    const k = out.indexOf('core_status');
    if (k>=0) console.log('core_status at', k);
  }
}