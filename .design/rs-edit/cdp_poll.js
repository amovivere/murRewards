(async()=>{
 const targets=await (await fetch('http://127.0.0.1:9333/json')).json();
 const page=targets.find(t=>t.type==='page')||targets[0];
 const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0; const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 await new Promise(r=>ws.onopen=r);
 const ev=(expr)=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true}}));});
 console.log('poll',JSON.stringify(await ev("({count:window.__poll, view:window.__pollView, err:window.__pollErr, core:window.RS.state.core&&{n:window.RS.state.core.rewards.length, loading:window.RS.state.core.rewards_loading}})")));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});