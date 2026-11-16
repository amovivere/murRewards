const fs=require('fs'), zlib=require('zlib'), path=require('path');
for (const dir of process.argv.slice(2)) {
  const assets = path.join(dir,'out','tauri-codegen-assets');
  if (!fs.existsSync(assets)) { console.log(dir,'NO ASSETS'); continue; }
  let found=false;
  for (const f of fs.readdirSync(assets)) {
    const b=fs.readFileSync(path.join(assets,f));
    let out; try { out=zlib.brotliDecompressSync(b).toString('utf8'); } catch { continue; }
    if (out.includes('renderCoreRewards')) { console.log(dir,'NEW JS',f,out.length); found=true; }
    if (out.includes('core_status')) console.log(dir,'OLD core_status',f,out.length);
  }
  console.log(dir,'foundNew',found);
}