const { spawn } = require("node:child_process");
const cli = "F:\\ARTCRAFT\\FigCraft\\figcraft-cli.exe";
const project = "F:\\WorkSpaces\\Mur rewards";
const writeRoot = "F:\\WorkSpaces\\Mur rewards\\.design\\figcraft";
const child = spawn(cli, ["mcp", "--automation-read-root", project, "--automation-write-root", writeRoot], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: project,
});
let buffer = "";
const pending = new Map();
let nextId = 1;
function send(method, params) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
  child.stdin.write(payload);
  return id;
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
child.stdout.on("data", (data) => {
  buffer += data.toString("utf8");
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try { message = JSON.parse(line); } catch { console.log("RAW", line.slice(0, 300)); continue; }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method) {
      console.log("NOTIF", message.method);
    }
  }
});
child.stderr.on("data", (data) => console.log("STDERR", data.toString("utf8").slice(0, 300)));
const waitFor = (id, timeout = 30000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout " + id)), timeout);
  pending.set(id, (message) => { clearTimeout(timer); resolve(message); });
});
(async () => {
  const initId = send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "figcraft-probe", version: "1.0.0" },
  });
  const init = await waitFor(initId, 60000);
  console.log("INIT", JSON.stringify(init.result?.serverInfo || init.error || init).slice(0, 500));
  if (init.error) process.exit(1);
  notify("notifications/initialized", {});
  const listId = send("tools/list", {});
  const list = await waitFor(listId, 60000);
  const tools = list.result?.tools || [];
  console.log("TOOLS", tools.length);
  for (const tool of tools) console.log("-", tool.name, "|", (tool.description || "").split("\n")[0].slice(0, 140));
  child.kill();
  process.exit(0);
})().catch((error) => { console.error("FAIL", error.message); child.kill(); process.exit(1); });
