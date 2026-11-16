(async()=>{
 const targets=await (await fetch('http://127.0.0.1:9333/json')).json(); const page=targets.find(t=>t.type==='page')||targets[0];
 const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0; const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 await new Promise(r=>ws.onopen=r);
 const ev=(expr,awaitPromise=false)=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise}}));});
 const clickAndReport = async (label, expr) => {
   const r=await ev(expr); await new Promise(r=>setTimeout(r,300));
   const vis=await ev("({visible:[...document.querySelectorAll('.reward-card')].filter(c=>c.style.display!=='none').length, total:document.querySelectorAll('.reward-card').length, subtitle:document.querySelector('.page-head .sub')?.textContent})");
   console.log(label, JSON.stringify(vis.result.result.value));
 };
 await clickAndReport('filter-nosound', "document.querySelectorAll('#reward-pills .pill')[2].click()");
 await clickAndReport('filter-sound', "document.querySelectorAll('#reward-pills .pill')[1].click()");
 await clickAndReport('filter-all', "document.querySelectorAll('#reward-pills .pill')[0].click()");
 console.log('sort', JSON.stringify(await ev("(()=>{const s=document.getElementById('reward-sort'); s.value='Сначала дорогие'; s.dispatchEvent(new Event('change')); return [...document.querySelectorAll('.reward-card')].map(c=>c.dataset.cost).slice(0,5)})()")));
 console.log('playing', JSON.stringify(await ev("window.RS.state.core.playing")));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});