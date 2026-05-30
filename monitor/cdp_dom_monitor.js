#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE_DIR = "/Users/ytfeng/.geo_access_monitor_chrome";
const OUT_ROOT = path.join(ROOT, "monitor_runs");
const PROMPT_FILE = path.join(ROOT, "geo_medtronic_prompt.txt");

const PLATFORMS = [
  { id: "doubao", name: "豆包", url: "https://www.doubao.com/chat/" },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com/" },
  { id: "yuanbao", name: "腾讯元宝", url: "https://yuanbao.tencent.com/chat/naQivTmsDa" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mkdir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
  try { fs.chmodSync(dir, mode); } catch {}
}

async function getJson(url, timeoutMs = 15000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      lastError = new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(250);
  }
  throw lastError || new Error(`timeout ${url}`);
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("websocket timeout")), 10000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(event.error || new Error("websocket error"));
      }, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id) return;
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      else waiter.resolve(msg.result);
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 45000);
    });
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

async function createPage(port) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json());
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return cdp;
}

async function evalJs(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 45000,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.text || "Runtime.evaluate exception");
  }
  return res.result ? res.result.value : undefined;
}

function jsString(value) {
  return JSON.stringify(String(value));
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await sleep(9000);
}

async function sendPromptByDom(cdp, prompt) {
  const script = `
    (async () => {
      const prompt = ${jsString(prompt)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      };
      const textareas = Array.from(document.querySelectorAll("textarea")).filter(visible);
      const editables = Array.from(document.querySelectorAll("[contenteditable='true'], .ql-editor, div[role='textbox']")).filter(visible);
      const input =
        textareas.find((el) => /发消息|发送消息|DeepSeek|消息/.test(el.placeholder || "")) ||
        editables.find((el) => /ql-editor|textbox/.test(String(el.className) + " " + el.getAttribute("role"))) ||
        textareas[textareas.length - 1] ||
        editables[editables.length - 1];
      if (!input) return { ok: false, reason: "input_not_found", title: document.title, url: location.href, text: document.body.innerText.slice(0, 1200) };

      input.scrollIntoView({ block: "center" });
      input.focus();
      if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
        const proto = Object.getPrototypeOf(input);
        const desc = Object.getOwnPropertyDescriptor(proto, "value") || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
        if (desc && desc.set) desc.set.call(input, prompt);
        else input.value = prompt;
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        input.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = prompt;
        input.appendChild(p);
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await sleep(500);

      const key = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
      input.dispatchEvent(new KeyboardEvent("keydown", key));
      input.dispatchEvent(new KeyboardEvent("keypress", key));
      input.dispatchEvent(new KeyboardEvent("keyup", key));
      await sleep(900);

      let clicked = false;
      const ir = input.getBoundingClientRect();
      const buttons = Array.from(document.querySelectorAll("button,[role='button']")).filter(visible)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const label = [el.innerText, el.getAttribute("aria-label"), el.title, el.className].join(" ");
          const distance = Math.abs(r.top - ir.top) + Math.abs(r.left - ir.right);
          return { el, label, distance };
        })
        .filter((item) => /发送|send|submit|arrow|icon|sizing-container|semi-button|t-button/i.test(item.label))
        .sort((a, b) => a.distance - b.distance);
      for (const item of buttons) {
        if (/disabled|停止|stop/i.test(item.label)) continue;
        try {
          item.el.click();
          clicked = true;
          break;
        } catch {}
      }
      return { ok: true, clicked, title: document.title, url: location.href, inputTag: input.tagName, inputClass: String(input.className).slice(0, 120) };
    })()
  `;
  return evalJs(cdp, script);
}

async function capture(cdp, outDir, id) {
  const text = await evalJs(cdp, `document.body ? document.body.innerText : ""`);
  const html = await evalJs(cdp, `document.documentElement ? document.documentElement.outerHTML : ""`);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(path.join(outDir, `${id}.txt`), text || "", { mode: 0o600 });
  fs.writeFileSync(path.join(outDir, `${id}.html`), html || "", { mode: 0o600 });
  fs.writeFileSync(path.join(outDir, `${id}.png`), Buffer.from(shot.data, "base64"), { mode: 0o600 });
  return { textLength: (text || "").length, htmlLength: (html || "").length };
}

function launchChrome(port, headless = false) {
  mkdir(PROFILE_DIR);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    "--window-size=1600,1200",
  ];
  if (headless) args.push("--headless=new", "--disable-gpu");
  args.push("about:blank");
  const child = spawn(CHROME, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}

async function runOnce(port) {
  await getJson(`http://127.0.0.1:${port}/json/version`, 12000);
  const prompt = fs.readFileSync(PROMPT_FILE, "utf8");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(OUT_ROOT, stamp);
  mkdir(outDir);
  const summary = [];
  for (const platform of PLATFORMS) {
    const cdp = await createPage(port);
    try {
      await navigate(cdp, platform.url);
      const beforeTitle = await evalJs(cdp, "document.title");
      const send = await sendPromptByDom(cdp, prompt);
      await sleep(45000);
      const cap = await capture(cdp, outDir, platform.id);
      summary.push({ platform: platform.id, name: platform.name, beforeTitle, send, ...cap });
    } catch (error) {
      summary.push({ platform: platform.id, name: platform.name, error: error.message });
    } finally {
      cdp.close();
    }
  }
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ createdAt: new Date().toISOString(), summary }, null, 2), { mode: 0o600 });
  console.log(`run_saved ${outDir}`);
  console.log(JSON.stringify(summary.map((x) => ({ platform: x.platform, ok: !x.error, textLength: x.textLength, error: x.error })), null, 2));
}

async function main() {
  const cmd = process.argv[2] || "help";
  const portArg = process.argv.find((arg) => arg.startsWith("--port="));
  const port = portArg ? Number(portArg.slice("--port=".length)) : 9222;

  if (cmd === "launch-visible") {
    const pid = launchChrome(port, false);
    console.log(`chrome_started pid=${pid} port=${port} profile=${PROFILE_DIR}`);
    console.log("打开的专用 Chrome 里手动登录三家平台一次；之后运行: node monitor/cdp_dom_monitor.js once --port=" + port);
    return;
  }
  if (cmd === "launch-headless") {
    throw new Error("launch-headless is disabled: Google Chrome.app headless is crashing on this macOS session. Use Playwright/Puppeteer Chromium or attach to an already-running CDP port instead.");
    return;
  }
  if (cmd === "once") {
    await runOnce(port);
    return;
  }
  if (cmd === "loop") {
    const intervalArg = process.argv.find((arg) => arg.startsWith("--interval-minutes="));
    const interval = intervalArg ? Number(intervalArg.slice("--interval-minutes=".length)) : 360;
    while (true) {
      await runOnce(port);
      await sleep(interval * 60 * 1000);
    }
  }
  console.log([
    "Usage:",
    "  node monitor/cdp_dom_monitor.js launch-visible --port=9222",
    "  node monitor/cdp_dom_monitor.js once --port=9222",
    "  node monitor/cdp_dom_monitor.js loop --port=9222 --interval-minutes=360",
    "",
    "Note: launch-headless is intentionally disabled for Google Chrome.app on this machine.",
  ].join("\\n"));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
