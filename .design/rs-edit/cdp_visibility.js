(async()=>{
 const targets=await (await fetch('http://127.0.0.1:9333/json')).json();
 const page=targets.find(t=>t.type==='page')||targets[0];
 const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0; const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 await new Promise(r=>ws.onopen=r);
 const ev=(expr,awaitPromise=false,timeout=5000)=>new Promise(resolve=>{const i=++id;const t=setTimeout(()=>resolve({timeout:true}),timeout);pending.set(i,m=>{clearTimeout(t);resolve(m)});ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise}}));});
 console.log('visibility',JSON.stringify(await ev("({hidden:document.hidden, state:document.visibilityState, focus:document.hasFocus()})")));
 console.log('timeoutTest',JSON.stringify(await ev("new Promise(r=>setTimeout(()=>r('timer-ok'),1500))",true,4000)).slice(0,300));
 console.log('rewardsNow',JSON.stringify(await ev("({n:window.RS.state.core?.rewards?.length, loading:window.RS.state.core?.rewards_loading})")));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});