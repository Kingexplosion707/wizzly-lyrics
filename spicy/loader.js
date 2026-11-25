// Spicy Lyrics for Wizzly - loader.
//
// Wizzly draws its island, karaoke window and dock in WebView2. This keeps Wizzly running with
// WebView2's local debugging port on (127.0.0.1 only) and puts spicy-wizzly.js into each of its
// windows, again whenever a window is created or reloaded. Wizzly itself is not changed on disk,
// so every Wizzly version, including updates, gets the Spicy features.
//
// Runs at sign-in (start-loader.vbs, set up by install.ps1). Set SPICY_WIZZLY_RELAUNCH=0 to never
// restart Wizzly (then start Wizzly yourself through "Wizzly (Spicy)").
"use strict";

const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const WebSocket = require("ws");

const PORT = Number(process.env.SPICY_WIZZLY_PORT) || 9234;
const LOCK_PORT = PORT + 1;
const MOD_FILE = path.join(__dirname, "spicy-wizzly.js");
const RELAUNCH = process.env.SPICY_WIZZLY_RELAUNCH !== "0";
// Wizzly's own WebView2 flags (from its binary), kept so it runs the way it was built to; the
// environment variable replaces them, it doesn't add to them.
const WIZZLY_FLAGS =
  "--renderer-process-limit=1 --process-per-site --disable-extensions --disable-sync --disable-background-networking " +
  "--disable-component-update --disable-default-apps --disable-domain-reliability --disable-client-side-phishing-detection " +
  "--metrics-recording-only --no-first-run --disable-features=Translate,BackForwardCache,MediaRouter,OptimizationHints,CalculateNativeWinOcclusion " +
  "--js-flags=--max-old-space-size=80";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url, ms = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: ms }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (_) { resolve(null); } });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

function ps(command) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: 15000 }, (err, out) =>
      resolve(err ? "" : String(out || "").trim()));
  });
}

const cdpAlive = async () => !!(await getJson(`http://127.0.0.1:${PORT}/json/version`));

async function runningWizzly() {
  return ps("(Get-Process -Name wizzly -ErrorAction SilentlyContinue | Select-Object -First 1).Path");
}

async function installedWizzly() {
  const fromRegistry = await ps(
    "$k = Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction SilentlyContinue | " +
    "Get-ItemProperty -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'Wizzly*' } | Select-Object -First 1; if ($k) { $k.InstallLocation }");
  const candidates = [
    fromRegistry && path.join(fromRegistry.replace(/"/g, ""), "wizzly.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Wizzly", "wizzly.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Wizzly", "wizzly.exe"),
  ].filter(Boolean);
  return candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }) || "";
}

function launch(exe) {
  log("starting Wizzly with Spicy:", exe);
  const env = Object.assign({}, process.env, { WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${WIZZLY_FLAGS} --remote-debugging-port=${PORT}` });
  spawn(exe, [], { detached: true, stdio: "ignore", env, cwd: path.dirname(exe), windowsHide: false }).unref();
}

let relaunchedAt = 0;

/** Wizzly running with the debugging port: restart it once if it was started without. */
async function ensure() {
  if (await cdpAlive()) return true;
  const running = await runningWizzly();
  if (!running) return false;                         // closed: wait until it's started again
  if (!RELAUNCH || Date.now() - relaunchedAt < 60000) return false;
  relaunchedAt = Date.now();
  log("Wizzly runs without Spicy - restarting it");
  await ps("Stop-Process -Name wizzly,wizzly-native -Force -ErrorAction SilentlyContinue");
  await sleep(1500);
  launch(running);
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (await cdpAlive()) return true;
  }
  log("Wizzly didn't open its debugging port (WebView2 ignored it?)");
  return false;
}

// ---- injection ------------------------------------------------------------------------------
const sessions = new Map();           // target id -> WebSocket (kept open so reloads get the mod)
let modSource = "";

function readMod() {
  try { modSource = fs.readFileSync(MOD_FILE, "utf8"); } catch (e) { log("can't read", MOD_FILE, e.message); }
}

function attach(target) {
  if (sessions.has(target.id) || !target.webSocketDebuggerUrl) return;
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  sessions.set(target.id, ws);
  let id = 0;
  const send = (method, params) => ws.send(JSON.stringify({ id: ++id, method, params }));
  ws.on("open", () => {
    send("Page.enable", {});
    send("Page.addScriptToEvaluateOnNewDocument", { source: modSource });
    send("Runtime.evaluate", { expression: modSource, awaitPromise: false });
    log("Spicy added to", target.url.replace(/^https?:\/\/[^/]+/, "") || target.title);
  });
  ws.on("message", () => {});
  ws.on("close", () => sessions.delete(target.id));
  ws.on("error", () => { try { ws.close(); } catch (_) {} });
}

async function scan() {
  const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
  if (!Array.isArray(list)) return;
  for (const t of list) {
    if (t.type !== "page") continue;
    if (!/tauri\.localhost|^tauri:|localhost:1420|[?&]view=(notch|karaoke)/i.test(t.url || "")) continue;
    attach(t);
  }
}

// Re-inject everywhere when spicy-wizzly.js changes (updates, edits).
function watchMod() {
  let timer = null;
  try {
    fs.watch(MOD_FILE, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        readMod();
        log("spicy-wizzly.js changed - reloading Wizzly windows");
        for (const ws of sessions.values()) {
          try { ws.send(JSON.stringify({ id: 9000, method: "Page.reload", params: {} })); } catch (_) {}
          try { ws.close(); } catch (_) {}
        }
      }, 400);
    });
  } catch (_) {}
}

// One loader at a time.
function lock() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(LOCK_PORT, "127.0.0.1", () => resolve(true));
  });
}

(async function main() {
  if (!(await lock())) { log("already running"); process.exit(0); }
  readMod();
  watchMod();
  log(`Spicy Lyrics for Wizzly - debugging port ${PORT}`);
  if (!(await runningWizzly()) && process.argv.includes("--start")) {
    const exe = await installedWizzly();
    if (exe) launch(exe);
    else log("Wizzly isn't installed");
  }
  for (;;) {
    try {
      if (await ensure()) await scan();
    } catch (e) {
      log("error:", e.message);
    }
    await sleep(3000);
  }
})();
