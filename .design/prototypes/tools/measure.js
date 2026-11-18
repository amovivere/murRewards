const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9472;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rs-proto-measure-"));
const edge = spawn(
  EDGE,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1220,840", "about:blank"],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let page = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      page = targets.find((target) => target.type === "page");
      if (page) break;
    } catch {}
    await sleep(200);
  }
  if (!page) throw new Error("CDP target not found");

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
  await send("Page.enable");
  await send("Performance.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  const targets = {
    vanilla: "http://127.0.0.1:8777/vanilla/index.html?snapshot=1",
    react: "http://127.0.0.1:8777/react/build/index.html?snapshot=1",
  };

  const results = {};
  for (const [name, url] of Object.entries(targets)) {
    results[name] = { runs: [] };
    for (let run = 0; run < 3; run += 1) {
      events.length = 0;
      await send("Page.navigate", { url });
      for (let attempt = 0; attempt < 50; attempt += 1) {
        await sleep(120);
        const state = await evaluate("document.readyState");
        if (state === "complete") break;
      }
      await sleep(900);
      const pageMetrics = await evaluate(`(() => {
        const nav = performance.getEntriesByType("navigation")[0] || {};
        const paint = performance.getEntriesByType("paint");
        const fcp = paint.find((entry) => entry.name === "first-contentful-paint");
        const resources = performance.getEntriesByType("resource");
        const transfer = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
        return {
          domNodes: document.querySelectorAll("*").length,
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEvent: Math.round(nav.loadEventEnd || 0),
          fcp: Math.round(fcp ? fcp.startTime : 0),
          transferKB: Math.round(transfer / 1024),
          title: document.title,
        };
      })()`);
      const perf = await send("Performance.getMetrics");
      const metrics = Object.fromEntries(perf.metrics.map((entry) => [entry.name, entry.value]));
      pageMetrics.jsHeapKB = Math.round((metrics.JSHeapUsedSize || 0) / 1024);
      pageMetrics.nodes = metrics.Nodes;
      pageMetrics.layoutCount = metrics.LayoutCount;

      const interaction =
        name === "vanilla"
          ? `(async () => {
              const button = document.querySelector("#skip");
              const start = performance.now();
              button.click();
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              return Math.round((performance.now() - start) * 10) / 10;
            })()`
          : `(async () => {
              const button = document.querySelector('[aria-label="Пропустить"]');
              const start = performance.now();
              button.click();
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              return Math.round((performance.now() - start) * 10) / 10;
            })()`;
      pageMetrics.skipLatencyMs = await evaluate(interaction);
      results[name].runs.push(pageMetrics);
      await sleep(300);
    }
  }

  const median = (values) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const summary = {};
  for (const [name, data] of Object.entries(results)) {
    summary[name] = {};
    for (const key of Object.keys(data.runs[0])) {
      if (typeof data.runs[0][key] === "number") summary[name][key] = median(data.runs.map((run) => run[key]));
    }
  }

  console.log(JSON.stringify({ summary, raw: results }, null, 2));
  ws.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sleep(200);
    edge.kill();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {}
  });
