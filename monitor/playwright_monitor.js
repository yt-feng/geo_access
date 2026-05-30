#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROFILE_DIR = path.join(process.env.HOME || "/Users/ytfeng", ".geo_access_playwright_profile");
const OUT_ROOT = path.join(ROOT, "monitor_runs");
const PROMPT_FILE = path.join(ROOT, "geo_medtronic_prompt.txt");
const PROMPT_MATRIX_FILE = path.join(OUT_ROOT, "prompt_matrix.txt");
const WAIT_TIMEOUT_MS = Number(process.env.GEO_MONITOR_TIMEOUT_MS || "180000");
const POLL_INTERVAL_MS = Number(process.env.GEO_MONITOR_POLL_MS || "2000");

const PLATFORMS = [
  { id: "doubao", name: "豆包", url: "https://www.doubao.com/chat/", captchaRefreshAttempts: 1 },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com/" },
  {
    id: "yuanbao",
    name: "腾讯元宝",
    url: "https://yuanbao.tencent.com/chat/naQivTmsDa",
    waitTimeoutMs: Number(process.env.GEO_YUANBAO_TIMEOUT_MS || "240000"),
    referenceGraceMs: Number(process.env.GEO_YUANBAO_REFERENCE_GRACE_MS || "30000"),
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
  try { fs.chmodSync(dir, mode); } catch {}
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function compactId(index) {
  return `q${String(index + 1).padStart(2, "0")}`;
}

function readPromptMatrix(filePath = PROMPT_MATRIX_FILE) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function summarizeForConsole(item) {
  return {
    platform: item.platform,
    status: item.status,
    ok: statusOk(item.status),
    textLength: item.textLength,
    referenceSectionCount: item.referenceSectionCount,
    referenceLinkCount: item.referenceLinkCount,
    citationMarkerCount: item.citationMarkerCount,
    referenceItemCount: item.referenceItemCount,
    sourceNodeCount: item.sourceNodeCount,
    captchaRefreshes: item.captchaRefreshes,
    error: item.error,
  };
}

function platformById(id) {
  return PLATFORMS.find((platform) => platform.id === id);
}

function statusOk(status) {
  return status === "ok" || status === "ok_no_references_detected";
}

function activePlatforms() {
  const ids = (process.env.GEO_MONITOR_PLATFORMS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return PLATFORMS;
  const selected = ids.map((id) => platformById(id));
  const missing = ids.filter((id, index) => !selected[index]);
  if (missing.length) throw new Error(`Unknown GEO_MONITOR_PLATFORMS: ${missing.join(", ")}`);
  return selected;
}

async function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error("Playwright is not installed. Run `npm install` in /Users/ytfeng/Code_Pj/geo_access first.");
  }
}

async function launchContext({ headless }) {
  const { chromium } = await loadPlaywright();
  ensureDir(PROFILE_DIR);
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1440, height: 1000 },
    locale: "zh-CN",
    args: [
      "--disable-session-crashed-bubble",
      "--no-default-browser-check",
      "--no-first-run",
    ],
  });
}

async function login() {
  const context = await launchContext({ headless: false });
  for (const platform of PLATFORMS) {
    const page = await context.newPage();
    await page.goto(platform.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  console.log(`Dedicated Playwright Chromium opened with profile: ${PROFILE_DIR}`);
  console.log("Please log in to Doubao, DeepSeek, and Yuanbao in that Chromium window once.");
  console.log("After login succeeds, close the Chromium window or press Ctrl+C here.");
  await new Promise(() => {});
}

async function unlock(platformId = "doubao") {
  const platform = platformById(platformId);
  if (!platform) throw new Error(`Unknown platform: ${platformId}`);

  const context = await launchContext({ headless: false });
  const page = await context.newPage();
  await page.goto(platform.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log(`Opened ${platform.name} in the dedicated Playwright profile: ${PROFILE_DIR}`);
  console.log("If a captcha or login screen appears, clear it here once. Then close the Chromium window or press Ctrl+C.");
  await new Promise(() => {});
}

async function submitPrompt(page, prompt) {
  return page.evaluate(async ({ prompt }) => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };

    const textareas = Array.from(document.querySelectorAll("textarea")).filter(visible);
    const editables = Array.from(document.querySelectorAll("[contenteditable='true'], .ql-editor, div[role='textbox']")).filter(visible);
    const input =
      textareas.find((el) => /发消息|发送消息|DeepSeek|消息/.test(el.placeholder || "")) ||
      editables.find((el) => /ql-editor|textbox/.test(`${el.className || ""} ${el.getAttribute("role") || ""}`)) ||
      textareas[textareas.length - 1] ||
      editables[editables.length - 1];

    if (!input) {
      return {
        ok: false,
        reason: "input_not_found",
        title: document.title,
        url: location.href,
        sample: document.body.innerText.slice(0, 1500),
      };
    }

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
    const before = document.body.innerText;
    const key = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent("keydown", key));
    input.dispatchEvent(new KeyboardEvent("keypress", key));
    input.dispatchEvent(new KeyboardEvent("keyup", key));
    await sleep(900);

    let clicked = false;
    const inputRect = input.getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll("button,[role='button']"))
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = [el.innerText, el.getAttribute("aria-label"), el.title, el.className].join(" ");
        const distance = Math.abs(rect.top - inputRect.top) + Math.abs(rect.left - inputRect.right);
        return { el, label, distance };
      })
      .filter((item) => /发送|send|submit|arrow|icon|sizing-container|semi-button|t-button/i.test(item.label))
      .sort((a, b) => a.distance - b.distance);

    for (const item of candidates) {
      if (/disabled|停止|stop/i.test(item.label)) continue;
      try {
        item.el.click();
        clicked = true;
        break;
      } catch {}
    }

    return {
      ok: true,
      clicked,
      title: document.title,
      url: location.href,
      inputTag: input.tagName,
      inputClass: String(input.className).slice(0, 140),
      beforeLength: before.length,
      afterLength: document.body.innerText.length,
    };
  }, { prompt });
}

async function inspectPageState(page, platform, prompt, baselineLength = 0) {
  return page.evaluate(({ platformId, promptLength, baselineLength }) => {
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const attr = (el, name) => el.getAttribute(name) || "";
    const bodyText = document.body?.innerText || "";
    const bodyHtml = document.documentElement?.innerHTML || "";
    const controls = Array.from(document.querySelectorAll("button,[role='button'],a,div[tabindex]"))
      .filter(visible)
      .map((el) => {
        const className = typeof el.className === "string" ? el.className : attr(el, "class");
        return [el.innerText, attr(el, "aria-label"), el.title, className].join(" ").trim();
      })
      .filter(Boolean);

    const captchaSelectors = [
      "#captcha_container",
      "iframe[src*='verifycenter']",
      "iframe[src*='captcha']",
      "[id*='captcha']",
      "[class*='captcha']",
    ];
    const hasCaptchaNode = captchaSelectors.some((selector) =>
      Array.from(document.querySelectorAll(selector)).some((el) => el.tagName === "IFRAME" || visible(el))
    );
    const hasCaptchaText = /安全验证|请完成验证|验证码|拖动.*滑块/i.test(bodyText) ||
      /captcha_container|verifycenter\/captcha|rmc\.bytedance\.com\/verifycenter/i.test(bodyHtml);
    const hasInput = !!document.querySelector("textarea,[contenteditable='true'],.ql-editor,div[role='textbox']");
    const loginRequired = /请登录|登录后|手机号登录|扫码登录|微信登录|账号登录/.test(bodyText) && !hasInput;
    const loadingText = /正在搜索资料|正在生成|正在回答|正在思考|思考中|搜索中|联网搜索中|整理资料中|回答中|生成中/i.test(bodyText);
    const hasStopControl = controls.some((label) => /停止|中止|stop|cancel|停止生成/i.test(label));
    const hasSendControl = controls.some((label) => /发送|send|submit/i.test(label));
    const citationMarkerCount = document.querySelectorAll(".hyc-common-markdown__ref-list__trigger,[data-idx-list]").length;
    const hasCitationToolbar = !!document.querySelector("[data-toolbar-type='citation']");
    const referenceTextSignal = /资料引用清单|引用清单|资料来源|参考资料|参考来源|信息来源|引用来源|来源[:：]/.test(bodyText) ||
      citationMarkerCount > 0 ||
      hasCitationToolbar;
    const answerLineCount = (bodyText.match(/(?:^|\n)\s*(?:[1-4][）).、]|[①②③④])/gm) || []).length;
    const medtronicCount = (bodyText.match(/美敦力|Medtronic/gi) || []).length;

    const anchors = Array.from(document.querySelectorAll("a[href]"))
      .filter(visible)
      .map((el) => ({
        href: el.href,
        text: (el.innerText || "").replace(/\s+/g, " ").trim(),
        title: el.title || "",
        aria: attr(el, "aria-label"),
      }))
      .filter((item) => /^https?:\/\//i.test(item.href));
    const referenceLinks = anchors.filter((item) => {
      let host = "";
      try { host = new URL(item.href).hostname; } catch {}
      const appHost = /(^|\.)yuanbao\.tencent\.com$|(^|\.)doubao\.com$|(^|\.)deepseek\.com$/.test(host);
      const joined = `${item.href} ${item.text} ${item.title} ${item.aria}`;
      const sourceLike = /source|reference|citation|ref|redirect|url=|doc|search|来源|引用|美敦力|Medtronic|Abbott|Boston|Johnson/i.test(joined);
      return !appHost || sourceLike;
    });

    const textGrowthSignal = bodyText.length > Math.max(promptLength + 700, baselineLength + 500);
    const strongTextGrowthSignal = bodyText.length > Math.max(promptLength + 1200, baselineLength + 900);
    const numberedAnswerSignal = answerLineCount >= 4;
    const answerSignal = (textGrowthSignal && medtronicCount >= 2) || numberedAnswerSignal || strongTextGrowthSignal;

    return {
      platformId,
      title: document.title,
      url: location.href,
      textLength: bodyText.length,
      hasCaptcha: hasCaptchaNode || hasCaptchaText,
      loginRequired,
      loadingText,
      hasStopControl,
      hasSendControl,
      referenceTextSignal,
      externalReferenceCount: referenceLinks.length,
      citationMarkerCount,
      answerLineCount,
      medtronicCount,
      answerSignal,
      textTail: bodyText.slice(-1000),
    };
  }, { platformId: platform.id, promptLength: prompt.length, baselineLength });
}

async function waitForAnswer(page, platform, prompt, baselineLength = 0) {
  const timeoutMs = platform.waitTimeoutMs || WAIT_TIMEOUT_MS;
  const started = Date.now();
  const stableTicksNeeded = platform.id === "yuanbao" ? 4 : 3;
  let stableTicks = 0;
  let lastSignature = "";
  let lastState = null;
  let answerReadyAt = 0;

  while (Date.now() - started < timeoutMs) {
    await sleep(POLL_INTERVAL_MS);
    const state = await inspectPageState(page, platform, prompt, baselineLength);
    lastState = state;
    const elapsedMs = Date.now() - started;

    if (state.hasCaptcha) {
      return { status: "captcha_required", elapsedMs, stableTicks, state };
    }
    if (state.loginRequired) {
      return { status: "login_required", elapsedMs, stableTicks, state };
    }

    const isLoading = state.loadingText || state.hasStopControl;
    const signature = [
      state.textLength,
      state.answerLineCount,
      state.medtronicCount,
      state.externalReferenceCount,
      state.referenceTextSignal ? 1 : 0,
      isLoading ? 1 : 0,
    ].join(":");

    if (!isLoading && signature === lastSignature) stableTicks += 1;
    else stableTicks = 0;
    lastSignature = signature;

    if (!isLoading && state.answerSignal && !answerReadyAt) answerReadyAt = Date.now();

    const referenceReady = state.referenceTextSignal || state.externalReferenceCount > 0 || state.citationMarkerCount > 0;
    const referenceGraceSatisfied = platform.id !== "yuanbao" ||
      referenceReady ||
      (answerReadyAt && Date.now() - answerReadyAt >= (platform.referenceGraceMs || 0));

    if (!isLoading && state.answerSignal && stableTicks >= stableTicksNeeded && referenceGraceSatisfied) {
      return {
        status: platform.id === "yuanbao" && !referenceReady ? "ok_no_references_detected" : "ok",
        elapsedMs,
        stableTicks,
        state,
      };
    }
  }

  return { status: "timeout", elapsedMs: Date.now() - started, stableTicks, state: lastState };
}

async function extractReferences(page, platform) {
  return page.evaluate(({ platformId, platformName }) => {
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
    const className = (el) => (typeof el.className === "string" ? el.className : el.getAttribute("class") || "");
    const bodyText = document.body?.innerText || "";
    const lines = bodyText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const sectionIndexes = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /资料引用清单|引用清单|资料来源|参考资料|参考来源|信息来源|引用来源|来源[:：]|^源$/.test(line));
    const sections = sectionIndexes.slice(0, 12).map(({ index }) => ({
      startLine: Math.max(0, index - 3),
      text: lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 24)).join("\n"),
    }));

    const citationMarkers = Array.from(document.querySelectorAll(".hyc-common-markdown__ref-list__trigger,[data-idx-list]"))
      .map((el) => {
        const idxList = clean(el.getAttribute("data-idx-list"));
        const container =
          el.closest(".ybc-p") ||
          el.closest(".ybc-li-component_content") ||
          el.closest("li") ||
          el.closest(".agent-chat__bubble__content") ||
          el.parentElement;
        return {
          idxList,
          indexes: idxList.split(",").map((value) => value.trim()).filter(Boolean),
          text: clean(container?.innerText || container?.textContent || ""),
          className: className(el),
        };
      })
      .filter((item) => item.idxList || item.text)
      .slice(0, 80);

    const referenceItems = Array.from(document.querySelectorAll(".agent-dialogue-references__item"))
      .map((el, index) => {
        const rawLines = (el.innerText || el.textContent || "")
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean);
        const source = clean(el.querySelector(".hyc-common-markdown__ref_card-foot__source_txt")?.innerText) || rawLines[0] || "";
        const title = rawLines.find((line) => line !== source && line.length > 4) || "";
        const snippet = rawLines.filter((line) => line !== source && line !== title).join(" ");
        return {
          index: index + 1,
          source,
          title,
          snippet: clean(snippet).slice(0, 800),
          text: clean(rawLines.join(" ")).slice(0, 1200),
        };
      })
      .filter((item) => item.source || item.title || item.snippet)
      .slice(0, 80);

    const sourceNodes = Array.from(document.querySelectorAll("[class*='source'],[class*='citation'],[class*='reference'],[data-toolbar-type='citation'],[data-idx-list]"))
      .filter((el) => visible(el) || el.getAttribute("data-idx-list"))
      .map((el) => ({
        text: clean(el.innerText || el.textContent || ""),
        className: className(el),
        dataIdxList: clean(el.getAttribute("data-idx-list")),
        dataToolbarType: clean(el.getAttribute("data-toolbar-type")),
      }))
      .filter((item) => item.text || item.dataIdxList || item.dataToolbarType)
      .slice(0, 120);

    const ownHostPattern = /(^|\.)yuanbao\.tencent\.com$|(^|\.)doubao\.com$|(^|\.)deepseek\.com$/;
    const links = Array.from(document.querySelectorAll("a[href]"))
      .filter(visible)
      .map((el) => {
        let host = "";
        try { host = new URL(el.href).hostname; } catch {}
        const item = {
          text: clean(el.innerText),
          href: el.href,
          host,
          title: clean(el.title),
          ariaLabel: clean(el.getAttribute("aria-label")),
        };
        const joined = `${item.href} ${item.text} ${item.title} ${item.ariaLabel}`;
        const sourceLike = /source|reference|citation|ref|redirect|url=|doc|search|来源|引用|美敦力|Medtronic|Abbott|Boston|Johnson/i.test(joined);
        return {
          ...item,
          probablyReference: /^https?:\/\//i.test(item.href) && (!ownHostPattern.test(host) || sourceLike),
        };
      })
      .filter((item) => /^https?:\/\//i.test(item.href) && (item.probablyReference || item.text))
      .slice(0, 160);

    return {
      platform: platformId,
      name: platformName,
      title: document.title,
      url: location.href,
      createdAt: new Date().toISOString(),
      sections,
      citationMarkers,
      referenceItems,
      sourceNodes,
      links,
      probableReferenceLinks: links.filter((item) => item.probablyReference),
    };
  }, { platformId: platform.id, platformName: platform.name });
}

function writeReferencesText(outDir, platform, references) {
  const lines = [
    `${platform.name} 资料引用清单`,
    `页面: ${references.url}`,
    `采集时间: ${references.createdAt}`,
    "",
    "页面引用/来源片段:",
  ];

  if (references.sections.length) {
    references.sections.forEach((section, index) => {
      lines.push(`\n[片段 ${index + 1}]`);
      lines.push(section.text);
    });
  } else {
    lines.push("未在页面可见文本中识别到资料引用清单标题。");
  }

  lines.push("", "引用来源条目:");
  if (references.referenceItems?.length) {
    references.referenceItems.forEach((item) => {
      lines.push(`${item.index}. ${item.source || "未知来源"}`);
      if (item.title) lines.push(`   标题: ${item.title}`);
      if (item.snippet) lines.push(`   摘要: ${item.snippet}`);
    });
  } else {
    lines.push("未识别到结构化引用来源条目。");
  }

  lines.push("", "段落引用标记:");
  if (references.citationMarkers?.length) {
    references.citationMarkers.forEach((marker, index) => {
      lines.push(`${index + 1}. idx=${marker.idxList || "(none)"}`);
      if (marker.text) lines.push(`   ${marker.text}`);
    });
  } else {
    lines.push("未识别到段落引用标记。");
  }

  lines.push("", "来源节点:");
  if (references.sourceNodes?.length) {
    references.sourceNodes.slice(0, 30).forEach((node, index) => {
      const label = node.text || node.dataIdxList || node.dataToolbarType || node.className || "未命名来源节点";
      lines.push(`${index + 1}. ${label.slice(0, 500)}`);
      if (node.dataIdxList) lines.push(`   data-idx-list=${node.dataIdxList}`);
      if (node.className) lines.push(`   class=${node.className}`);
    });
  } else {
    lines.push("未识别到来源节点。");
  }

  lines.push("", "链接:");
  const links = references.probableReferenceLinks.length ? references.probableReferenceLinks : references.links;
  if (links.length) {
    links.forEach((link, index) => {
      const label = link.text || link.title || link.ariaLabel || link.host || "未命名链接";
      lines.push(`${index + 1}. ${label}`);
      lines.push(`   ${link.href}`);
    });
  } else {
    lines.push("未识别到可见引用链接。");
  }

  fs.writeFileSync(path.join(outDir, `${platform.id}_references.txt`), lines.join("\n"), { mode: 0o600 });
}

async function openReferencePanel(page, platform) {
  if (platform.id !== "yuanbao") return { attempted: false };

  return page.evaluate(() => {
    const click = (el) => {
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "center" });
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    };

    const sourceTool =
      document.querySelector("[data-toolbar-type='citation']") ||
      document.querySelector(".ToolbarSearchGuid_searchGuidTool__M81L2") ||
      document.querySelector(".ToolbarSearchGuid_source__XMsID")?.closest("[data-toolbar-type],div");
    const refTrigger = document.querySelector(".hyc-common-markdown__ref-list__trigger,[data-idx-list]");
    return {
      attempted: true,
      clickedSourceTool: click(sourceTool),
      clickedRefTrigger: click(refTrigger),
    };
  }).then(async (result) => {
    await page.waitForTimeout(1800);
    return result;
  }).catch((error) => ({ attempted: true, error: error.message }));
}

async function savePage(page, outDir, platform) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(500).catch(() => {});
  const referencePanel = await openReferencePanel(page, platform);
  const txt = await page.evaluate(() => document.body.innerText);
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  const references = await extractReferences(page, platform);
  references.referencePanel = referencePanel;
  await page.screenshot({ path: path.join(outDir, `${platform.id}.png`), fullPage: true });
  fs.writeFileSync(path.join(outDir, `${platform.id}.txt`), txt, { mode: 0o600 });
  fs.writeFileSync(path.join(outDir, `${platform.id}.html`), html, { mode: 0o600 });
  fs.writeFileSync(path.join(outDir, `${platform.id}_references.json`), JSON.stringify(references, null, 2), { mode: 0o600 });
  writeReferencesText(outDir, platform, references);
  return {
    textLength: txt.length,
    htmlLength: html.length,
    url: page.url(),
    referenceSectionCount: references.sections.length,
    referenceLinkCount: references.probableReferenceLinks.length,
    citationMarkerCount: references.citationMarkers.length,
    referenceItemCount: references.referenceItems.length,
    sourceNodeCount: references.sourceNodes.length,
  };
}

async function refreshAfterCaptcha(page, platform) {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(platform.id === "doubao" ? 8000 : 5000);
}

async function runPlatform(context, platform, prompt, outDir) {
  const page = await context.newPage();
  const result = {
    platform: platform.id,
    name: platform.name,
    status: "unknown",
    sendAttempts: 0,
    captchaRefreshes: 0,
  };
  const maxCaptchaRefreshes = platform.captchaRefreshAttempts || 0;

  try {
    await page.goto(platform.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(8000);

    let preState = await inspectPageState(page, platform, prompt);
    while (preState.hasCaptcha && result.captchaRefreshes < maxCaptchaRefreshes) {
      result.captchaRefreshes += 1;
      await refreshAfterCaptcha(page, platform);
      preState = await inspectPageState(page, platform, prompt);
    }

    let waitResult = null;
    if (preState.hasCaptcha) {
      waitResult = { status: "captcha_required", elapsedMs: 0, stableTicks: 0, state: preState };
    } else if (preState.loginRequired) {
      waitResult = { status: "login_required", elapsedMs: 0, stableTicks: 0, state: preState };
    } else {
      while (true) {
        result.sendAttempts += 1;
        const sendResult = await submitPrompt(page, prompt);
        result.sendResult = sendResult;
        if (!sendResult.ok) {
          waitResult = {
            status: sendResult.reason || "send_failed",
            elapsedMs: 0,
            stableTicks: 0,
            state: {
              title: sendResult.title,
              url: sendResult.url,
              textTail: sendResult.sample,
            },
          };
          break;
        }

        const baselineLength = Math.max(sendResult.beforeLength || 0, sendResult.afterLength || 0);
        waitResult = await waitForAnswer(page, platform, prompt, baselineLength);
        if (waitResult.status === "captcha_required" && result.captchaRefreshes < maxCaptchaRefreshes) {
          result.captchaRefreshes += 1;
          await refreshAfterCaptcha(page, platform);
          continue;
        }
        break;
      }
    }

    const saved = await savePage(page, outDir, platform);
    return {
      ...result,
      status: waitResult?.status || "unknown",
      waitResult,
      ...saved,
    };
  } catch (error) {
    let saved = {};
    try {
      saved = await savePage(page, outDir, platform);
    } catch {}
    return {
      ...result,
      status: "error",
      error: error.message,
      ...saved,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function once() {
  const prompt = fs.readFileSync(PROMPT_FILE, "utf8");
  const outDir = path.join(OUT_ROOT, stamp());
  ensureDir(outDir);
  const headless = process.env.GEO_MONITOR_HEADLESS === "0" ? false : true;
  const context = await launchContext({ headless });
  const summary = [];

  try {
    for (const platform of activePlatforms()) {
      summary.push(await runPlatform(context, platform, prompt, outDir));
    }
  } finally {
    await context.close().catch(() => {});
  }

  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ createdAt: new Date().toISOString(), summary }, null, 2), { mode: 0o600 });
  console.log(`run_saved ${outDir}`);
  console.log(JSON.stringify(summary.map(summarizeForConsole), null, 2));
}

function writeMatrixCsv(outDir, rows) {
  const columns = [
    "question_id",
    "platform",
    "status",
    "ok",
    "text_length",
    "reference_items",
    "citation_markers",
    "source_nodes",
    "url",
    "prompt",
    "error",
  ];
  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "matrix_summary.csv"), csv, { mode: 0o600 });
}

async function matrix() {
  const promptFile = process.env.GEO_PROMPT_MATRIX_FILE || PROMPT_MATRIX_FILE;
  const prompts = readPromptMatrix(promptFile);
  if (!prompts.length) throw new Error(`No prompts found in ${promptFile}`);

  const outDir = path.join(OUT_ROOT, `${stamp()}_prompt_matrix`);
  ensureDir(outDir);
  const headless = process.env.GEO_MONITOR_HEADLESS === "0" ? false : true;
  const context = await launchContext({ headless });
  const platforms = activePlatforms();
  const summary = [];
  const rows = [];

  try {
    for (let index = 0; index < prompts.length; index += 1) {
      const prompt = prompts[index];
      const questionId = compactId(index);
      const questionDir = path.join(outDir, questionId);
      ensureDir(questionDir);
      fs.writeFileSync(path.join(questionDir, "prompt.txt"), prompt, { mode: 0o600 });
      console.log(`matrix_question ${questionId}/${prompts.length} ${prompt.slice(0, 80)}`);

      const questionSummary = [];
      for (const platform of platforms) {
        const result = await runPlatform(context, platform, prompt, questionDir);
        const item = { questionId, prompt, ...result };
        questionSummary.push(item);
        summary.push(item);
        rows.push({
          question_id: questionId,
          platform: result.platform,
          status: result.status,
          ok: statusOk(result.status),
          text_length: result.textLength,
          reference_items: result.referenceItemCount,
          citation_markers: result.citationMarkerCount,
          source_nodes: result.sourceNodeCount,
          url: result.url,
          prompt,
          error: result.error,
        });
        console.log(JSON.stringify({ questionId, prompt: prompt.slice(0, 60), ...summarizeForConsole(result) }));
      }

      fs.writeFileSync(
        path.join(questionDir, "summary.json"),
        JSON.stringify({ questionId, prompt, createdAt: new Date().toISOString(), summary: questionSummary }, null, 2),
        { mode: 0o600 },
      );
    }
  } finally {
    await context.close().catch(() => {});
  }

  const payload = {
    createdAt: new Date().toISOString(),
    promptFile,
    platformIds: platforms.map((platform) => platform.id),
    promptCount: prompts.length,
    summary,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(payload, null, 2), { mode: 0o600 });
  writeMatrixCsv(outDir, rows);
  console.log(`matrix_saved ${outDir}`);
  console.log(JSON.stringify({
    promptCount: prompts.length,
    platforms: platforms.map((platform) => platform.id),
    ok: summary.filter((item) => statusOk(item.status)).length,
    total: summary.length,
    statuses: summary.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}),
  }, null, 2));
}

async function loop() {
  const intervalMinutes = Number(process.env.GEO_MONITOR_INTERVAL_MINUTES || "360");
  while (true) {
    await once();
    await sleep(intervalMinutes * 60 * 1000);
  }
}

async function main() {
  const cmd = process.argv[2] || "once";
  if (cmd === "login") return login();
  if (cmd === "unlock") return unlock(process.argv[3] || "doubao");
  if (cmd === "once") return once();
  if (cmd === "matrix") return matrix();
  if (cmd === "loop") return loop();
  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
