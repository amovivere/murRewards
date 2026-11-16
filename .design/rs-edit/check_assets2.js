const fs=require('fs'),zlib=require('zlib'),path=require('path');
const dir=process.argv[2]; let found=false;
for(const f of fs.readdirSync(dir)){ const b=fs.readFileSync(path.join(dir,f)); let out; try{out=zlib.brotliDecompressSync(b).toString('utf8')}catch{continue}
 if(out.includes('renderCoreRewards')){ console.log('NEW JS',f,out.length); found=true; }
 if(out.includes('core_status')) console.log('OLD',f,out.length);
}
console.log('foundNew',found);