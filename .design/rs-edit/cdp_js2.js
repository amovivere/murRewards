(async()=>{
 const targets=await (await fetch('http://127.0.0.1:9333/json')).json(); const page=targets.find(t=>t.type==='page')||targets[0];
 const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0; const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
 await new Promise(r=>ws.onopen=r);
 const ev=(expr,awaitPromise=false)=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise}}));});
 console.log('js',JSON.stringify(await ev("fetch('app.js').then(r=>r.text()).then(t=>({len:t.length, poll:t.includes('setInterval(poll'), dbg:t.includes('__poll'), dyn:t.includes('renderCoreRewards'), initEnd:t.includes('setTimeout(poll, 600)') }))",true)).slice(0,500));
 console.log('ready',JSON.stringify(await ev("document.readyState")));
 console.log('footer',JSON.stringify(await ev("document.getElementById('footer-text').textContent")));
 console.log('handlers',JSON.stringify(await ev("({rs: !!window.RS, tabs: document.querySelectorAll('.nav-item').length, cards: document.querySelectorAll('.reward-card').length})")));
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});