(async()=>{
 const targets=await (await fetch('http://127.0.0.1:9333/json')).json();
 const page=targets.find(t=>t.type==='page')||targets[0];
 const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0; const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 await new Promise(r=>ws.onopen=r);
 const ev=(expr,awaitPromise=false,timeout=5000)=>new Promise(resolve=>{const i=++id;const t=setTimeout(()=>resolve({timeout:true}),timeout);pending.set(i,m=>{clearTimeout(t);resolve(m)});ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise}}));});
 console.log('jsHasPoll',JSON.stringify(await ev("fetch('app.js').then(r=>r.text()).then(t=>({len:t.length, poll:t.includes('setInterval(poll'), dyn:t.includes('renderCoreRewards')}))",true,5000)).slice(0,400));
 console.log('timers',JSON.stringify(await ev("(async()=>{let n=0; const id=setInterval(()=>n++,100); await new Promise(r=>setTimeout(r,500)); clearInterval(id); return n;})()",true,3000)).slice(0,300));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});