const fs=require('fs'),zlib=require('zlib'),path=require('path');
const dir=process.argv[2];
for(const f of fs.readdirSync(dir)){ const b=fs.readFileSync(path.join(dir,f)); let out; try{out=zlib.brotliDecompressSync(b).toString('utf8')}catch{continue}
 if(out.includes('renderCoreRewards')){
  console.log('ASSET',f,'len',out.length);
  for(const needle of ['setInterval(poll','get_state','drain','applyCoreView','core_status','IPC:']){
    console.log(needle, out.includes(needle));
  }
 }
}