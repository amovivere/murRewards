const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const url = process.argv[2];
if (!url) {
  console.error("usage: node debug-page.js <url>");
  process.exit(1);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9471;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rs-proto-debug-"));
const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1220,840",
    url,
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let page = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      page = targets.find((target) => target.type === "page");
      if (page) break;
    } catch {}
    await sleep(200);
  }
  if (!page) throw new Error("CDP page not found");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message.result);
      pending.delete(message.id);
    } else if (!message.id) {
      events.push(message);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const requestId = ++id;
      pending.set(requestId, resolve);
      ws.send(JSON.stringify({ id: requestId, method, params }));
    });
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  await send("Runtime.enable");
  await sleep(2000);
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result.exceptionDetails ? { error: result.exceptionDetails.text } : result.result.value;
  };
  console.log("ready:", await evaluate("document.readyState"));
  console.log("rows:", await evaluate("document.querySelectorAll('.queue-row').length"));
  console.log("wave:", await evaluate("document.querySelectorAll('.wave i').length"));
  console.log("toast hidden:", await evaluate("document.querySelector('#toast')?.hidden"));
  const consoleEvents = events.filter(
    (event) => event.method === "Runtime.exceptionThrown" || event.method === "Runtime.consoleAPICalled"
  );
  for (const event of consoleEvents.slice(0, 10)) {
    if (event.method === "Runtime.exceptionThrown") {
      console.log("EXCEPTION:", event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text);
    } else {
      console.log("CONSOLE", event.params.type, event.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    }
  }
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await sleep(200);
  edge.kill();
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {}
});
