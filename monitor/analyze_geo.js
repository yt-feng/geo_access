#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUN_DIR = path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix");
const RUN_DIR = path.resolve(process.argv[2] || process.env.GEO_ANALYSIS_RUN_DIR || DEFAULT_RUN_DIR);
const SUMMARY_PATH = path.join(RUN_DIR, "summary.json");
const OUT_PATH = path.join(RUN_DIR, "geo_analysis_summary.json");

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const FORCE = process.env.GEO_ANALYSIS_FORCE === "1";
const MAX_RETRIES = Number(process.env.GEO_ANALYSIS_RETRIES || "2");

const BRAND_TERMS = [
  "美敦力", "Medtronic", "CareLink", "MiniMed", "Simplera", "Micra", "Evolut",
  "Hugo", "Hugo RAS", "LigaSure", "Valleylab", "Tri-Staple", "Reveal LINQ",
  "Cobalt", "Crome", "OptiVol", "SureScan", "Touch Surgery", "BlueSync",
];

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function stripUiText(text, prompt) {
  const normalized = text.replace(/\r/g, "").trim();
  const promptIndex = normalized.lastIndexOf(prompt);
  let body = promptIndex >= 0 ? normalized.slice(promptIndex + prompt.length) : normalized;
  body = body
    .replace(/^\s*(快速模式|深度思考|智能搜索|联网搜索|内容由 AI 生成，请仔细甄别|内容由AI生成，仅供参考)\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return body || normalized;
}

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

function countTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(escaped, "gi")) || []).length;
}

function localSignals(answer, references) {
  const terms = BRAND_TERMS
    .map((term) => ({ term, count: countTerm(answer, term) }))
    .filter((item) => item.count > 0);
  const referenceItems = references?.referenceItems || [];
  return {
    answerLength: answer.length,
    brandTermTotal: terms.reduce((sum, item) => sum + item.count, 0),
    terms,
    referenceItemCount: referenceItems.length,
    officialReferenceCount: referenceItems.filter((item) => /medtronic\.com|美敦力/i.test(`${item.source} ${item.title}`)).length,
    referenceSources: referenceItems.slice(0, 20).map((item) => ({
      source: item.source,
      title: item.title,
      snippet: item.snippet,
    })),
  };
}

function analysisPrompt({ row, answer, references, signals }) {
  return `你是品牌GEO评估分析师。请只输出JSON，不要输出Markdown。

任务：对以下AI回答逐条做“品牌化GEO四项核心指标”分析。品牌是“美敦力 Medtronic”，行业是医疗器械。你要评估用户从看见、认知到信任的路径：找得到、说得对、愿推荐。

四项核心指标定义：
1. 答案可见度：品牌专有词组在回答中是否高频、位置是否靠前、是否覆盖相关产品线。
2. 认知准确度：AI是否准确理解品牌资产、产品线、适用场景、竞品边界，是否有明显事实错误或混淆。
3. 证据纳入度：AI收录的信息源质量、官方/权威来源占比、噪音源多少、关键品牌资产是否有证据支撑。
4. 推荐转化力：AI是否愿意推荐品牌，是否给出合理下一步，评价是好话/坏话/中肯，是否会劝退顾客。

评分规则：
- 每项0-100分，越高越好。
- total_score 为四项平均分，四舍五入。
- source_noise_level 为0-100，越高代表噪音越大。
- detracts_customer 为 true 表示回答明显会劝退客户或削弱选择信心。
- balanced_evaluation 为 true 表示评价中肯，既不过度吹捧也不过度否定。
- 所有数组最多4项。
- 每个字符串尽量不超过35个汉字。
- summary 和 dashboard_takeaway 各不超过80个汉字。
- 必须输出完整合法JSON，不允许有注释、尾逗号、反斜杠断行。

必须输出这个JSON结构：
{
  "question_id": string,
  "platform": string,
  "scores": {
    "answer_visibility": number,
    "cognitive_accuracy": number,
    "evidence_inclusion": number,
    "recommendation_conversion": number,
    "total_score": number
  },
  "brand_terms": {
    "frequency_assessment": string,
    "important_terms_present": string[],
    "important_terms_missing": string[],
    "product_assets_covered": string[]
  },
  "brand_asset_understanding": {
    "level": "high" | "medium" | "low",
    "correct_assets": string[],
    "confusions_or_errors": string[],
    "missing_assets": string[]
  },
  "evidence": {
    "source_quality": "high" | "medium" | "low",
    "source_noise_level": number,
    "official_sources_used": string[],
    "noisy_or_weak_sources": string[],
    "evidence_gaps": string[]
  },
  "sentiment_and_trust": {
    "stance": "positive" | "mixed_positive" | "neutral" | "mixed_negative" | "negative",
    "positive_claims": string[],
    "negative_or_risk_claims": string[],
    "balanced_evaluation": boolean,
    "detracts_customer": boolean,
    "detracting_phrases": string[]
  },
  "recommendation": {
    "recommends_medtronic": boolean,
    "rank_or_priority": string,
    "next_step_quality": "high" | "medium" | "low",
    "conversion_notes": string[]
  },
  "summary": string,
  "dashboard_takeaway": string,
  "improvement_actions": string[]
}

问题ID：${row.questionId}
平台：${row.platform}
用户问题：${row.prompt}

本地统计信号：
${JSON.stringify(signals, null, 2)}

AI回答文本：
${truncate(answer, 9000)}

已抓取引用来源JSON：
${truncate(JSON.stringify({
    referenceItems: (references?.referenceItems || []).slice(0, 12),
    citationMarkers: (references?.citationMarkers || []).slice(0, 12),
  }, null, 2), 5000)}
`;
}

function parseJsonContent(content) {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in API response");
  return JSON.parse(match[0]);
}

function callDeepSeek(messages) {
  const body = JSON.stringify({
    model: MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 2600,
    thinking: { type: "disabled" },
    stream: false,
  });
  const url = new URL("/chat/completions", BASE_URL);

  return new Promise((resolve, reject) => {
    const req = https.request({
      method: "POST",
      hostname: url.hostname,
      path: url.pathname,
      protocol: url.protocol,
      port: url.port || 443,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 120000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`DeepSeek API HTTP ${res.statusCode}: ${text.slice(0, 1000)}`));
          return;
        }
        try {
          const payload = JSON.parse(text);
          const content = payload.choices?.[0]?.message?.content;
          if (!content) throw new Error("Missing choices[0].message.content");
          resolve({ analysis: parseJsonContent(content), usage: payload.usage, model: payload.model });
        } catch (error) {
          reject(new Error(`Failed to parse DeepSeek response: ${error.message}; raw=${text.slice(0, 1000)}`));
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("DeepSeek API request timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function analyzeWithRetry(messages) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      return await callDeepSeek(messages);
    } catch (error) {
      lastError = error;
      console.error(`analysis_retry attempt=${attempt} error=${error.message.slice(0, 260)}`);
      if (attempt > MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw lastError;
}

function aggregate(items) {
  const byPlatform = {};
  for (const item of items) {
    const platform = item.platform;
    byPlatform[platform] ||= {
      count: 0,
      answer_visibility: 0,
      cognitive_accuracy: 0,
      evidence_inclusion: 0,
      recommendation_conversion: 0,
      total_score: 0,
      detracts_count: 0,
      balanced_count: 0,
    };
    const target = byPlatform[platform];
    target.count += 1;
    for (const key of ["answer_visibility", "cognitive_accuracy", "evidence_inclusion", "recommendation_conversion", "total_score"]) {
      target[key] += Number(item.scores?.[key] || 0);
    }
    if (item.sentiment_and_trust?.detracts_customer) target.detracts_count += 1;
    if (item.sentiment_and_trust?.balanced_evaluation) target.balanced_count += 1;
  }
  for (const target of Object.values(byPlatform)) {
    for (const key of ["answer_visibility", "cognitive_accuracy", "evidence_inclusion", "recommendation_conversion", "total_score"]) {
      target[key] = Math.round(target[key] / Math.max(1, target.count));
    }
  }
  return byPlatform;
}

async function main() {
  if (!API_KEY) throw new Error("Set DEEPSEEK_API_KEY in the environment. The key is not read from files.");

  const summary = readJson(SUMMARY_PATH);
  if (!summary?.summary?.length) throw new Error(`No monitor summary found: ${SUMMARY_PATH}`);

  const system = {
    role: "system",
    content: "你是严谨的中文品牌GEO评估分析师。你必须输出可解析JSON，不能输出Markdown。医疗相关内容只做传播与品牌评估，不给诊疗建议。",
  };
  const results = [];

  for (const row of summary.summary) {
    const qDir = path.join(RUN_DIR, row.questionId);
    const outFile = path.join(qDir, `${row.platform}_geo_analysis.json`);
    if (!FORCE && fs.existsSync(outFile)) {
      const existing = readJson(outFile);
      results.push(existing);
      console.log(`skip_existing ${row.questionId} ${row.platform}`);
      continue;
    }

    const txtPath = path.join(qDir, `${row.platform}.txt`);
    const refsPath = path.join(qDir, `${row.platform}_references.json`);
    const answer = stripUiText(readText(txtPath), row.prompt);
    const references = readJson(refsPath, {});
    const signals = localSignals(answer, references);
    const user = { role: "user", content: analysisPrompt({ row, answer, references, signals }) };

    console.log(`analyze ${row.questionId} ${row.platform}`);
    const response = await analyzeWithRetry([system, user]);
    const analysis = {
      ...response.analysis,
      question_id: row.questionId,
      platform: row.platform,
      prompt: row.prompt,
      source_url: row.url,
      model: response.model,
      usage: response.usage,
      analyzed_at: new Date().toISOString(),
      local_signals: signals,
    };
    writeJson(outFile, analysis);
    results.push(analysis);
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  const payload = {
    createdAt: new Date().toISOString(),
    runDir: RUN_DIR,
    model: MODEL,
    total: results.length,
    aggregate: aggregate(results),
    results,
  };
  writeJson(OUT_PATH, payload);
  console.log(`geo_analysis_saved ${OUT_PATH}`);
  console.log(JSON.stringify({ total: payload.total, aggregate: payload.aggregate }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
