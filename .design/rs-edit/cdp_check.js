(async()=>{
  const targets=await (await fetch('http://127.0.0.1:9333/json')).json();
  console.log('targets',targets.map(t=>t.url));
  const page=targets.find(t=>t.type==='page')||targets[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
  await new Promise(r=>ws.onopen=r);
  const evaljs=(expr,awaitPromise=false)=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,returnByValue:true,awaitPromise}}));});
  console.log('footer', JSON.stringify(await evaljs("document.getElementById('footer-text').textContent")));
  console.log('rs', JSON.stringify(await evaljs("({core: !!(window.RS&&window.RS.state.core), tab: window.RS&&window.RS.state.tab, rewards: window.RS?.state.core?.rewards?.length, loading: window.RS?.state.core?.rewards_loading})")));
  console.log('timer', JSON.stringify(await evaljs("typeof setInterval")));
  console.log('invokeResult', JSON.stringify(await evaljs("window.__TAURI__.core.invoke('get_state')", true)).slice(0,600));
  ws.close();
})().catch(e=>{console.error(e);process.exit(1)});