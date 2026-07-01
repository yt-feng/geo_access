#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_PROMPT_FILE = "proposal_excellence/佳农水果/jiaonong_shuiguo_natural_discovery_prompts.txt";
const DEFAULT_CONFIG_FILE = "proposal_excellence/佳农水果/jiaonong_shuiguo_geo_config.json";
const DEFAULT_OUT_ROOT = "monitor_runs/github_archive/jiaonong_shuiguo_deepseek_api";

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const MAX_TOKENS = envNumber("DEEPSEEK_MAX_TOKENS", 2400);
const TEMPERATURE = envOptionalNumber("DEEPSEEK_TEMPERATURE");
const THINKING_TYPE = process.env.DEEPSEEK_THINKING || "disabled";
const REQUEST_TIMEOUT_MS = envNumber("GEO_ARCHIVE_TIMEOUT_MS", 180000);
const MAX_RETRIES = envNumber("GEO_ARCHIVE_RETRIES", 2);
const DELAY_MS = envNumber("GEO_ARCHIVE_DELAY_MS", 1000);
const MAX_PROMPTS = envNumber("GEO_ARCHIVE_MAX_PROMPTS", 0);
const START_INDEX = Math.max(1, envNumber("GEO_ARCHIVE_START_INDEX", 1));
const STOP_ON_ERROR = process.env.GEO_ARCHIVE_STOP_ON_ERROR === "1";
const STORE_REASONING = process.env.GEO_ARCHIVE_STORE_REASONING === "1";
const RUN_LABEL = sanitizeLabel(process.env.GEO_ARCHIVE_RUN_LABEL || "jiaonong_shuiguo_natural_discovery_deepseek_api");
const PROMPT_FILE = resolveFromRoot(process.env.GEO_ARCHIVE_PROMPT_FILE || DEFAULT_PROMPT_FILE);
const CONFIG_FILE = resolveFromRoot(process.env.GEO_ARCHIVE_CONFIG_FILE || DEFAULT_CONFIG_FILE);
const OUT_ROOT = resolveFromRoot(process.env.GEO_ARCHIVE_OUT_ROOT || DEFAULT_OUT_ROOT);
const SYSTEM_PROMPT = process.env.GEO_ARCHIVE_SYSTEM_PROMPT || [
  "你是中文通用AI助手。",
  "请直接回答用户问题，优先给出可执行、可判断的建议。",
  "如果你无法核验来源，不要虚构引用、链接或数据出处。",
].join("\n");

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envOptionalNumber(name) {
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(readText(filePath));
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function writeJson(filePath, data) {
  writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeLabel(value) {
  return String(value || "archive")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "archive";
}

function compactId(index) {
  return `q${String(index + 1).padStart(2, "0")}`;
}

function sha12(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPromptMatrix(filePath) {
  return readText(filePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function requestBody(prompt) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    stream: false,
    max_tokens: MAX_TOKENS,
    thinking: { type: THINKING_TYPE },
  };
  if (TEMPERATURE != null) body.temperature = TEMPERATURE;
  return body;
}

function endpointUrl() {
  return new URL("/chat/completions", BASE_URL).toString();
}

async function callDeepSeek(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("DeepSeek API request timeout")), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let responseText = "";
  try {
    const response = await fetch(endpointUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody(prompt)),
      signal: controller.signal,
    });
    responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = { raw_text: responseText };
    }
    if (!response.ok) {
      const message = typeof payload?.error?.message === "string"
        ? payload.error.message
        : responseText.slice(0, 1000);
      const error = new Error(`DeepSeek API HTTP ${response.status}: ${message}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    const message = payload?.choices?.[0]?.message || {};
    return {
      payload,
      answer: String(message.content || "").trim(),
      model: payload?.model || MODEL,
      usage: payload?.usage || null,
      finishReason: payload?.choices?.[0]?.finish_reason || null,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function retryable(error) {
  if (!error.status) return true;
  if ([408, 409, 425, 429].includes(error.status)) return true;
  return error.status >= 500;
}

async function callWithRetry(prompt) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      return await callDeepSeek(prompt);
    } catch (error) {
      lastError = error;
      console.error(`deepseek_retry attempt=${attempt} error=${String(error.message || error).slice(0, 280)}`);
      if (attempt > MAX_RETRIES || !retryable(error)) break;
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

function sanitizeApiPayload(payload) {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  if (STORE_REASONING) return cloned;
  for (const choice of cloned.choices || []) {
    const message = choice?.message;
    if (message && typeof message.reasoning_content === "string") {
      const length = message.reasoning_content.length;
      message.reasoning_content = `[omitted ${length} chars; set GEO_ARCHIVE_STORE_REASONING=1 to archive reasoning_content]`;
      message.reasoning_content_omitted = true;
    }
  }
  return cloned;
}

function keyLooksLikeSources(key) {
  return /^(annotations?|citations?|sources?|references?|reference_items?|search_results?|web_search_results?|grounding|grounding_metadata)$/i.test(key);
}

function findSourceFields(value, currentPath = [], found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSourceFields(item, currentPath.concat(String(index)), found));
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = currentPath.concat(key);
    if (keyLooksLikeSources(key)) {
      found.push({ path: nextPath.join("."), value: child });
    }
    findSourceFields(child, nextPath, found);
  }
  return found;
}

function firstString(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeSourceItem(item, sourcePath) {
  if (typeof item === "string") {
    const text = item.trim();
    if (!text) return null;
    const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
    return {
      sourcePath,
      title: "",
      url: urlMatch ? urlMatch[0] : "",
      snippet: urlMatch ? text.replace(urlMatch[0], "").trim() : text,
      raw: item,
    };
  }
  if (!item || typeof item !== "object") return null;
  const url = firstString(item, ["url", "link", "href", "uri", "source_url", "sourceUrl", "canonical_url"]);
  const title = firstString(item, ["title", "name", "source", "site_name", "siteName"]);
  const snippet = firstString(item, ["snippet", "text", "content", "summary", "description"]);
  const id = firstString(item, ["id", "index", "ref_id"]);
  if (!url && !title && !snippet && !id) return null;
  return { sourcePath, id, title, url, snippet, raw: item };
}

function flattenSourceValues(value, sourcePath, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const normalized = normalizeSourceItem(item, `${sourcePath}.${index}`);
      if (normalized) output.push(normalized);
      else flattenSourceValues(item, `${sourcePath}.${index}`, output);
    });
    return output;
  }
  const normalized = normalizeSourceItem(value, sourcePath);
  if (normalized) output.push(normalized);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flattenSourceValues(child, `${sourcePath}.${key}`, output);
  }
  return output;
}

function extractSources(payload) {
  const rawSourceFields = findSourceFields(payload);
  const seen = new Set();
  const sources = [];
  for (const field of rawSourceFields) {
    for (const source of flattenSourceValues(field.value, field.path)) {
      const dedupeKey = `${source.url || ""}|${source.title || ""}|${source.snippet || ""}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      sources.push(source);
    }
  }
  return {
    sourceCount: sources.length,
    linkCount: sources.filter((source) => source.url).length,
    sources,
    rawSourceFieldCount: rawSourceFields.length,
    rawSourceFields,
    note: sources.length
      ? "DeepSeek API response contained source-like fields; they were archived as returned."
      : "No source/citation fields were present in this DeepSeek API response.",
  };
}

function referencesPayload({ createdAt, prompt, sourceArchive }) {
  const referenceItems = sourceArchive.sources.map((source, index) => ({
    index: index + 1,
    title: source.title || "",
    source: source.url || source.id || source.sourcePath || "",
    snippet: source.snippet || "",
    url: source.url || "",
    raw: source.raw,
  }));
  return {
    createdAt,
    platform: "deepseek",
    interface: "api",
    prompt,
    url: endpointUrl(),
    sections: [],
    referenceItems,
    probableReferenceLinks: referenceItems.filter((item) => item.url),
    citationMarkers: [],
    sourceNodes: [],
    rawSourceFieldCount: sourceArchive.rawSourceFieldCount,
    rawSourceFields: sourceArchive.rawSourceFields,
    note: sourceArchive.note,
  };
}

function referencesText(payload) {
  const lines = [
    "平台: DeepSeek API",
    `接口: ${payload.url}`,
    `采集时间: ${payload.createdAt}`,
    `来源字段数: ${payload.rawSourceFieldCount}`,
    `来源条目数: ${payload.referenceItems.length}`,
    "",
    payload.note,
  ];
  if (payload.referenceItems.length) {
    lines.push("", "## 来源条目");
    payload.referenceItems.forEach((item) => {
      lines.push(`- [${item.index}] ${item.title || "(untitled)"}`);
      if (item.url) lines.push(`  URL: ${item.url}`);
      if (item.snippet) lines.push(`  摘要: ${item.snippet}`);
    });
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(filePath, rows) {
  const headers = [
    "question_id",
    "prompt_index",
    "status",
    "text_length",
    "source_count",
    "model",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "finish_reason",
    "latency_ms",
    "prompt",
    "error",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(","));
  }
  writeText(filePath, `${lines.join("\n")}\n`);
}

function markdownSummary(payload) {
  const lines = [
    "# 佳农水果 DeepSeek API 回答归档",
    "",
    `- 最近运行: ${payload.createdAt}`,
    `- Run ID: ${payload.runId}`,
    `- Prompt 文件: ${payload.promptFile}`,
    `- 模型: ${payload.model}`,
    `- 完成/总数: ${payload.okCount}/${payload.total}`,
    `- 有 source 字段的回答: ${payload.withSourcesCount}`,
    `- 结果目录: ${payload.runDir}`,
    "",
    "## Source 说明",
    "",
    "常规 DeepSeek `/chat/completions` 返回不等同于网页版搜索引用；脚本会归档 API response 中实际出现的 source/citation/search 字段。没有这些字段时，只归档 answer 与基础 usage。",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function runPrompt({ prompt, promptIndex, runDir }) {
  const questionId = compactId(promptIndex);
  const createdAt = new Date().toISOString();
  const questionDir = path.join(runDir, questionId);
  ensureDir(questionDir);
  writeText(path.join(questionDir, "prompt.txt"), `${prompt}\n`);

  try {
    const response = await callWithRetry(prompt);
    const apiPayload = sanitizeApiPayload(response.payload);
    const sourceArchive = extractSources(apiPayload);
    const answer = response.answer;
    const refs = referencesPayload({ createdAt, prompt, sourceArchive });
    const row = {
      questionId,
      prompt_index: promptIndex + 1,
      promptIndex: promptIndex + 1,
      promptHash: sha12(prompt),
      platform: "deepseek",
      interface: "api",
      status: answer ? "ok" : "empty_answer",
      prompt,
      model: response.model,
      finish_reason: response.finishReason,
      finishReason: response.finishReason,
      textLength: answer.length,
      text_length: answer.length,
      sourceCount: sourceArchive.sourceCount,
      source_count: sourceArchive.sourceCount,
      referenceItemCount: refs.referenceItems.length,
      referenceLinkCount: refs.probableReferenceLinks.length,
      usage: response.usage,
      prompt_tokens: response.usage?.prompt_tokens ?? "",
      completion_tokens: response.usage?.completion_tokens ?? "",
      total_tokens: response.usage?.total_tokens ?? "",
      latencyMs: response.latencyMs,
      latency_ms: response.latencyMs,
      createdAt,
      url: endpointUrl(),
      files: {
        prompt: `${questionId}/prompt.txt`,
        answer: `${questionId}/deepseek.txt`,
        response: `${questionId}/deepseek_response.json`,
        sources: `${questionId}/deepseek_sources.json`,
        references: `${questionId}/deepseek_references.json`,
      },
    };

    writeText(path.join(questionDir, "deepseek.txt"), `${answer}\n`);
    writeJson(path.join(questionDir, "deepseek_response.json"), apiPayload);
    writeJson(path.join(questionDir, "deepseek_sources.json"), sourceArchive);
    writeJson(path.join(questionDir, "deepseek_references.json"), refs);
    writeText(path.join(questionDir, "deepseek_references.txt"), referencesText(refs));
    writeJson(path.join(questionDir, "summary.json"), { questionId, prompt, createdAt, summary: [row] });
    console.log(`archive_ok ${questionId} chars=${answer.length} sources=${sourceArchive.sourceCount}`);
    return row;
  } catch (error) {
    const payload = error.payload ? sanitizeApiPayload(error.payload) : null;
    const row = {
      questionId,
      prompt_index: promptIndex + 1,
      promptIndex: promptIndex + 1,
      promptHash: sha12(prompt),
      platform: "deepseek",
      interface: "api",
      status: "error",
      prompt,
      model: MODEL,
      textLength: 0,
      text_length: 0,
      sourceCount: 0,
      source_count: 0,
      referenceItemCount: 0,
      referenceLinkCount: 0,
      usage: null,
      prompt_tokens: "",
      completion_tokens: "",
      total_tokens: "",
      latencyMs: "",
      latency_ms: "",
      createdAt,
      url: endpointUrl(),
      error: String(error.message || error),
      files: {
        prompt: `${questionId}/prompt.txt`,
        error: `${questionId}/deepseek_error.json`,
      },
    };
    writeJson(path.join(questionDir, "deepseek_error.json"), {
      createdAt,
      status: error.status || null,
      error: row.error,
      payload,
    });
    writeJson(path.join(questionDir, "summary.json"), { questionId, prompt, createdAt, summary: [row] });
    console.error(`archive_error ${questionId} ${row.error.slice(0, 260)}`);
    if (STOP_ON_ERROR) throw error;
    return row;
  }
}

async function main() {
  if (!API_KEY) throw new Error("Set DEEPSEEK_API_KEY in the environment or GitHub repository secrets.");
  if (!fs.existsSync(PROMPT_FILE)) throw new Error(`Prompt file not found: ${PROMPT_FILE}`);

  const config = readJson(CONFIG_FILE, {});
  const prompts = readPromptMatrix(PROMPT_FILE);
  const startOffset = START_INDEX - 1;
  const selectedPrompts = prompts
    .map((prompt, index) => ({ prompt, index }))
    .slice(startOffset, MAX_PROMPTS > 0 ? startOffset + MAX_PROMPTS : undefined);
  const runId = `${stamp()}_${RUN_LABEL}`;
  const runDir = path.join(OUT_ROOT, runId);
  ensureDir(runDir);
  writeText(path.join(runDir, "prompt_matrix.txt"), `${selectedPrompts.map((item) => item.prompt).join("\n")}\n`);
  writeJson(path.join(runDir, "run_config.json"), {
    createdAt: new Date().toISOString(),
    runId,
    runLabel: RUN_LABEL,
    brandSlug: config.brandSlug || "jiaonong_shuiguo",
    promptFile: rel(PROMPT_FILE),
    configFile: fs.existsSync(CONFIG_FILE) ? rel(CONFIG_FILE) : "",
    promptCount: prompts.length,
    selectedCount: selectedPrompts.length,
    startIndex: START_INDEX,
    maxPrompts: MAX_PROMPTS,
    model: MODEL,
    baseUrl: BASE_URL,
    endpoint: endpointUrl(),
    maxTokens: MAX_TOKENS,
    thinking: THINKING_TYPE,
    temperature: TEMPERATURE,
    sourceArchiveMode: "archive source-like fields only when the API response includes them",
  });

  const rows = [];
  for (let slot = 0; slot < selectedPrompts.length; slot += 1) {
    const item = selectedPrompts[slot];
    console.log(`archive_prompt ${slot + 1}/${selectedPrompts.length} ${compactId(item.index)}`);
    rows.push(await runPrompt({ prompt: item.prompt, promptIndex: item.index, runDir }));
    if (DELAY_MS > 0 && slot < selectedPrompts.length - 1) await sleep(DELAY_MS);
  }

  const payload = {
    createdAt: new Date().toISOString(),
    runId,
    runLabel: RUN_LABEL,
    brandSlug: config.brandSlug || "jiaonong_shuiguo",
    promptFile: rel(PROMPT_FILE),
    configFile: fs.existsSync(CONFIG_FILE) ? rel(CONFIG_FILE) : "",
    runDir: rel(runDir),
    model: MODEL,
    baseUrl: BASE_URL,
    total: rows.length,
    okCount: rows.filter((row) => row.status === "ok" || row.status === "empty_answer").length,
    errorCount: rows.filter((row) => row.status === "error").length,
    withSourcesCount: rows.filter((row) => Number(row.sourceCount || 0) > 0).length,
    sourceNote: "DeepSeek API source fields are archived only if present in the JSON response; otherwise answer text is still archived.",
    summary: rows,
  };
  writeJson(path.join(runDir, "summary.json"), payload);
  writeCsv(path.join(runDir, "matrix_summary.csv"), rows);
  writeJson(path.join(OUT_ROOT, "latest.json"), {
    updatedAt: payload.createdAt,
    latestRun: payload.runDir,
    summaryPath: `${payload.runDir}/summary.json`,
    matrixSummaryPath: `${payload.runDir}/matrix_summary.csv`,
    total: payload.total,
    okCount: payload.okCount,
    errorCount: payload.errorCount,
    withSourcesCount: payload.withSourcesCount,
    model: payload.model,
  });
  writeText(path.join(OUT_ROOT, "latest_summary.md"), markdownSummary(payload));
  console.log(JSON.stringify({
    runDir: payload.runDir,
    total: payload.total,
    ok: payload.okCount,
    errors: payload.errorCount,
    withSources: payload.withSourcesCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
