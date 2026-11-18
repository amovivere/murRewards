const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(name, url, actions) {
  const port = 9480;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rs-proto-int-"));
  const edge = spawn(
    EDGE,
    ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1220,840", url],
    { stdio: "ignore" }
  );
  let page = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      page = targets.find((target) => target.type === "page");
      if (page) break;
    } catch {}
    await sleep(200);
  }
  if (!page) throw new Error("target not found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let id = 0;
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message.result);
      pending.delete(message.id);
    } else if (message.method === "Runtime.exceptionThrown") {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
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
  await sleep(1800);
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result.exceptionDetails ? { error: result.exceptionDetails.text } : result.result.value;
  };
  const report = { name };
  for (const action of actions) {
    report[action.label] = await evaluate(action.expression);
    await sleep(action.wait || 350);
  }
  report.errors = errors.slice(0, 5);
  console.log(JSON.stringify(report));
  ws.close();
  edge.kill();
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {}
}

(async () => {
  const common = (skipSelector, menuSelector) => [
    { label: "initialRows", expression: "document.querySelectorAll('.queue-row').length" },
    {
      label: "skip",
      expression: `(async () => { document.querySelector(${JSON.stringify(skipSelector)}).click(); await new Promise(r => setTimeout(r, 400)); return { rows: document.querySelectorAll('.queue-row').length, toast: !!document.querySelector('.toast:not([hidden]), .toast-panel') }; })()`,
      wait: 200,
    },
    {
      label: "menu",
      expression: `(async () => { const trigger = document.querySelector(${JSON.stringify(menuSelector)}); trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); trigger.click(); await new Promise(r => setTimeout(r, 350)); const open = !!document.querySelector('.menu:not([hidden]), .radix-menu'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return open; })()`,
      wait: 200,
    },
    {
      label: "dialog",
      expression: `(async () => { const button = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Очистить'); button?.click(); await new Promise(r => setTimeout(r, 300)); const open = !!document.querySelector('dialog[open], .dialog-content'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return open; })()`,
      wait: 200,
    },
  ];
  await run("vanilla", "http://127.0.0.1:8777/vanilla/index.html?snapshot=1", common("#skip", "#more-btn"));
  await run("react", "http://127.0.0.1:8777/react/build/index.html?snapshot=1", common('[aria-label="Пропустить"]', '[aria-label="Действия"]'));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
