#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const { analyzeCompetitiveAnswer, aggregateCompetitive } = require("./competitive_geo");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MATRIX_RUN_DIR = path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix");
const DEFAULT_INTENT_RUN_DIR = path.join(ROOT, "monitor_runs", "2026-05-30T16-25-01-295Z_minimed_intent_lab");
const DEFAULT_PR_DIGEST = path.join(ROOT, "monitor_runs", "pr_guideline_digest", "pr_guideline_digest.json");
const OUT_DIR = path.join(ROOT, "monitor_runs", "yuanbao_medtronic_optimization");

const API_KEY = process.env.DEEPSEEK_API_KEY;
const USE_LLM = process.env.GEO_OPTIMIZER_USE_LLM === "1";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const PRODUCT_AREAS = [
  {
    id: "cardiac_rhythm",
    label: "心律管理 / 心衰 / 远程监测",
    patterns: [/心律|心衰|远程监测|起搏|ICD|CRT|Reveal|CareLink|OptiVol|BlueSync/i],
    ownedAssets: ["CareLink", "BlueSync", "OptiVol", "Reveal LINQ", "Micra", "Cobalt/Crome"],
    evidenceNeeds: ["官方产品事实表", "医生FAQ", "术后随访说明", "心衰监测证据页", "数据隐私说明"],
    suggestedTitle: "美敦力心律管理与远程监测：从植入器械到随访数据的证据说明",
  },
  {
    id: "structural_heart",
    label: "结构性心脏 / TAVR / 瓣膜",
    patterns: [/结构性心脏|TAVR|瓣膜|Evolut|CoreValve|主动脉瓣|肺动脉瓣/i],
    ownedAssets: ["Evolut", "CoreValve", "TAVR", "主动脉瓣/外科瓣膜", "瓣膜术后随访"],
    evidenceNeeds: ["临床证据索引", "适用患者边界", "学习曲线说明", "术后风险FAQ", "医保/收费说明"],
    suggestedTitle: "TAVR与瓣膜治疗如何选择：美敦力Evolut相关证据与患者沟通清单",
  },
  {
    id: "surgical",
    label: "医疗外科 / 能量 / 吻合 / Hugo RAS",
    patterns: [/LigaSure|Valleylab|Tri-Staple|吻合|缝合|疝|Hugo|外科机器人|Touch Surgery|数字手术/i],
    ownedAssets: ["LigaSure", "Valleylab", "Tri-Staple", "Hugo RAS", "Touch Surgery"],
    evidenceNeeds: ["产品适用场景", "耗材使用规范", "经销商合规FAQ", "培训路径", "售后责任边界"],
    suggestedTitle: "从能量平台到数字手术：美敦力医疗外科产品的场景、培训与合规边界",
  },
  {
    id: "diabetes",
    label: "糖尿病 / MiniMed / CGM / 闭环",
    patterns: [/糖尿病|胰岛素泵|CGM|闭环|MiniMed|Simplera|Guardian|SmartGuard|TIR|低血糖/i],
    ownedAssets: ["MiniMed", "SmartGuard", "Guardian", "Simplera", "CareLink", "TIR"],
    evidenceNeeds: ["MiniMed vs 竞品FAQ", "TIR/低血糖证据说明", "传感器准确性资料", "儿童/成人适用边界", "费用和可及性说明"],
    suggestedTitle: "MiniMed闭环系统怎么选：控糖表现、低血糖风险与日常佩戴的关键问题",
  },
  {
    id: "reputation_safety",
    label: "安全 / 召回 / 声誉风险",
    patterns: [/召回|负面|风险|安全|副作用|还能放心|不良事件|投诉/i],
    ownedAssets: ["产品安全声明", "召回事实核验", "风险沟通FAQ", "术后注意事项", "监管信息链接"],
    evidenceNeeds: ["召回/更正事实页", "官方声明", "监管链接", "患者咨询路径", "媒体问答口径"],
    suggestedTitle: "如何看待医疗器械召回与安全信息：美敦力产品风险沟通FAQ",
  },
  {
    id: "channel_access",
    label: "渠道 / 医保 / 采购 / 合作",
    patterns: [/医保|收费|集采|医院|采购|经销商|渠道|合作|培训|售后|价格|总拥有成本/i],
    ownedAssets: ["医院引进FAQ", "经销商合规指南", "培训体系", "售后服务边界", "医保/收费说明"],
    evidenceNeeds: ["合规红线", "售后SLA", "培训认证", "医院采购材料", "区域政策链接"],
    suggestedTitle: "医院与渠道伙伴如何评估美敦力方案：合规、培训、售后与可及性问答",
  },
];

const DEFAULT_PR_RULES = {
  writing_rules: [
    { label: "事实和数据先于形容词", rule: "优先给出客观事实、来源、适用场景和限制条件。" },
    { label: "风险问题预先给口径", rule: "涉及召回、安全、费用、隐私时提供事实边界和咨询路径。" },
    { label: "把专业术语翻译成人话", rule: "专业说法同时配患者/医生可理解解释。" },
  ],
  medical_compliance_rules: [
    "避免绝对化和疗效承诺。",
    "医疗事实、数据、引用必须人工核验。",
    "描述安全性要同时说明风险和适用条件。",
  ],
  geo_writing_rules: [
    { label: "给AI可引用的证据包", rule: "官方事实、临床/监管证据、适用场景、风险提示、FAQ。" },
  ],
  forbidden_or_risky_patterns: ["最佳", "最好", "根治", "治愈率", "安全无副作用", "绝对安全", "零风险"],
};

function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
  try { fs.chmodSync(dir, mode); } catch {}
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avg(items, selector) {
  const values = items.map(selector).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function stripUiText(text, prompt) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  const promptIndex = normalized.lastIndexOf(prompt);
  let body = promptIndex >= 0 ? normalized.slice(promptIndex + prompt.length) : normalized;
  body = body
    .replace(/^\s*(快速模式|深度思考|智能搜索|联网搜索|内容由 AI 生成，请仔细甄别|内容由AI生成，仅供参考)\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return body || normalized;
}

function areaPriority(areaId) {
  return {
    diabetes: 0,
    structural_heart: 1,
    surgical: 2,
    cardiac_rhythm: 3,
    channel_access: 4,
    reputation_safety: 5,
  }[areaId] ?? 99;
}

function findAreaInText(text) {
  return PRODUCT_AREAS
    .slice()
    .sort((a, b) => areaPriority(a.id) - areaPriority(b.id))
    .find((area) => area.patterns.some((pattern) => pattern.test(text)));
}

function detectArea(prompt, answer) {
  // The answer often mentions cross-product assets such as CareLink. The prompt
  // is the cleaner signal for the user's actual decision context.
  return findAreaInText(prompt) || findAreaInText(answer) || PRODUCT_AREAS[0];
}

function termCount(text, term) {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (String(text || "").match(new RegExp(escaped, "gi")) || []).length;
}

function riskyLanguageHits(text, patterns) {
  return patterns.filter((pattern) => String(text || "").includes(pattern));
}

function geoAnalysisMap(runDir) {
  const payload = readJson(path.join(runDir, "geo_analysis_summary.json"), { results: [] });
  const map = new Map();
  for (const item of payload.results || []) {
    map.set(`${item.question_id}:${item.platform}`, item);
  }
  return { payload, map };
}

function summarizeReferences(references = {}) {
  const items = references.referenceItems || [];
  const links = references.probableReferenceLinks || [];
  return {
    referenceItemCount: items.length,
    probableReferenceLinkCount: links.length,
    officialLikeCount: items.filter((item) => /medtronic|美敦力/i.test(`${item.source || ""} ${item.title || ""} ${item.url || ""}`)).length,
    topItems: items.slice(0, 8).map((item) => ({
      index: item.index,
      title: item.title,
      source: item.source,
      snippet: item.snippet,
      url: item.url,
    })),
  };
}

function rowRiskFlags({ area, answer, references, competitive, analysis, prDigest }) {
  const refs = summarizeReferences(references);
  const med = competitive.medtronic || {};
  const riskHits = riskyLanguageHits(answer, prDigest.forbidden_or_risky_patterns || []);
  const missingAssets = area.ownedAssets.filter((asset) => termCount(answer, asset) === 0);
  const flags = [];

  if (refs.officialLikeCount === 0) flags.push("缺少可识别的美敦力官方来源");
  if ((competitive.competitorMentionTotal || 0) > (med.answerMentions || 0)) flags.push("竞品在回答中的提及量超过美敦力");
  if ((competitive.competitorSourceWeight || 0) > (med.sourceWeight || 0)) flags.push("竞品引用证据权重超过美敦力");
  if (analysis?.scores?.evidence_inclusion < 75) flags.push("证据纳入分偏低");
  if (analysis?.scores?.recommendation_conversion < 75) flags.push("推荐转化力偏低");
  if (riskHits.length) flags.push(`出现医疗传播高风险词：${riskHits.slice(0, 4).join("、")}`);
  if (missingAssets.length >= 3) flags.push(`关键品牌资产覆盖不足：${missingAssets.slice(0, 4).join("、")}`);

  return { flags, missingAssets, riskHits, refs };
}

function actionForRow({ area, prompt, competitive, risk }) {
  const topCompetitorSources = (competitive.highWeightCompetitorSources || []).slice(0, 3);
  const primaryGap = risk.flags[0] || "需要提升官方证据可引用性";
  return {
    areaId: area.id,
    areaLabel: area.label,
    priority: risk.flags.length >= 3 ? "P0" : risk.flags.length >= 1 ? "P1" : "P2",
    prompt,
    primaryGap,
    ownedAssetToCreate: area.suggestedTitle,
    evidenceToCollect: area.evidenceNeeds,
    keyAssetsToMention: area.ownedAssets,
    competitorSourcesToWatch: topCompetitorSources.map((source) => ({
      brand: source.brandName,
      title: source.title,
      source: source.source,
      authority: source.authority?.label,
      score: source.authority?.score,
    })),
    nextYuanbaoPrompt: `请只基于官方、监管、临床/指南和权威医疗媒体来源，回答：${prompt}。请列出资料引用清单，并说明美敦力资料是否足够支撑结论。`,
  };
}

function buildRows(runDir, prDigest) {
  const summary = readJson(path.join(runDir, "summary.json"));
  if (!summary?.summary?.length) throw new Error(`No summary.json found under ${runDir}`);
  const { payload: geoPayload, map } = geoAnalysisMap(runDir);
  const rows = [];
  for (const row of summary.summary.filter((item) => item.platform === "yuanbao")) {
    const qDir = path.join(runDir, row.questionId);
    const answer = stripUiText(readText(path.join(qDir, "yuanbao.txt")), row.prompt);
    const references = readJson(path.join(qDir, "yuanbao_references.json"), {});
    const competitive = analyzeCompetitiveAnswer({
      questionId: row.questionId,
      platform: row.platform,
      prompt: row.prompt,
      answer,
      references,
    });
    const area = detectArea(row.prompt, answer);
    const analysis = map.get(`${row.questionId}:yuanbao`) || null;
    const risk = rowRiskFlags({ area, answer, references, competitive, analysis, prDigest });
    rows.push({
      questionId: row.questionId,
      prompt: row.prompt,
      status: row.status,
      url: row.url,
      textLength: answer.length,
      area,
      analysis,
      competitive,
      risk,
      action: actionForRow({ area, prompt: row.prompt, competitive, risk }),
      localFiles: {
        txt: path.relative(OUT_DIR, path.join(qDir, "yuanbao.txt")).split(path.sep).join("/"),
        html: path.relative(OUT_DIR, path.join(qDir, "yuanbao.html")).split(path.sep).join("/"),
        references: path.relative(OUT_DIR, path.join(qDir, "yuanbao_references.txt")).split(path.sep).join("/"),
        screenshot: path.relative(OUT_DIR, path.join(qDir, "yuanbao.png")).split(path.sep).join("/"),
      },
    });
  }
  return { summary, geoPayload, rows };
}

function countBy(items, selector) {
  const out = {};
  for (const item of items) {
    const key = selector(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function buildArticleBriefs(rows, prDigest) {
  const byArea = new Map();
  for (const row of rows) {
    if (!byArea.has(row.area.id)) byArea.set(row.area.id, []);
    byArea.get(row.area.id).push(row);
  }

  return PRODUCT_AREAS
    .filter((area) => byArea.has(area.id))
    .map((area) => {
      const areaRows = byArea.get(area.id);
      const topFlags = Object.entries(countBy(areaRows.flatMap((row) => row.risk.flags), (flag) => flag))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([flag, count]) => ({ flag, count }));
      const competitorSources = areaRows
        .flatMap((row) => row.action.competitorSourcesToWatch)
        .slice(0, 6);
      return {
        id: area.id,
        title: area.suggestedTitle,
        objective: `提升腾讯元宝在“${area.label}”相关问题中对美敦力官方资料、关键品牌资产和风险边界的引用概率。`,
        audience: ["医生/科室负责人", "患者及家属", "医院采购/运营", "媒体与AI搜索"],
        answerShape: ["一句话结论", "适用/不适用人群", "竞品对比表", "证据清单", "风险和术后/使用注意事项", "下一步咨询路径"],
        evidenceToCollect: area.evidenceNeeds,
        assetsToMention: area.ownedAssets,
        topYuanbaoGaps: topFlags,
        competitorSourcesToWatch: competitorSources,
        draftOutline: [
          "标题：用事实场景表达，不用绝对化宣传语",
          "导语：交代用户真实决策问题和美敦力可提供的证据边界",
          "事实表：产品、适用场景、限制条件、医生咨询路径",
          "对比表：美敦力与主要竞品各自适用场景",
          "证据清单：官方、监管、临床/指南、权威医疗媒体来源",
          "风险FAQ：召回、安全、费用、数据隐私或售后责任",
        ],
        complianceGuardrails: prDigest.medical_compliance_rules || DEFAULT_PR_RULES.medical_compliance_rules,
      };
    });
}

function buildAggregate({ matrixRunDir, intentRunDir, rows }) {
  const competitiveAggregate = aggregateCompetitive(rows.map((row) => row.competitive));
  const intentSummary = readJson(path.join(intentRunDir, "intent_coverage_summary.json"), null);
  const scoreRows = rows.map((row) => row.analysis).filter(Boolean);
  const riskRows = rows.filter((row) => row.risk.flags.length);
  const byArea = PRODUCT_AREAS.map((area) => {
    const areaRows = rows.filter((row) => row.area.id === area.id);
    if (!areaRows.length) return null;
    return {
      id: area.id,
      label: area.label,
      promptCount: areaRows.length,
      avgTotalScore: avg(areaRows, (row) => row.analysis?.scores?.total_score),
      officialReferenceGaps: areaRows.filter((row) => row.risk.refs.officialLikeCount === 0).length,
      riskFlagCount: areaRows.reduce((sum, row) => sum + row.risk.flags.length, 0),
      p0Actions: areaRows.filter((row) => row.action.priority === "P0").length,
    };
  }).filter(Boolean);

  const allFlags = rows.flatMap((row) => row.risk.flags);
  return {
    matrixRunDir,
    intentRunDir,
    createdAt: new Date().toISOString(),
    platform: "yuanbao",
    promptCount: rows.length,
    scoreSummary: {
      answer_visibility: avg(scoreRows, (item) => item.scores?.answer_visibility),
      cognitive_accuracy: avg(scoreRows, (item) => item.scores?.cognitive_accuracy),
      evidence_inclusion: avg(scoreRows, (item) => item.scores?.evidence_inclusion),
      recommendation_conversion: avg(scoreRows, (item) => item.scores?.recommendation_conversion),
      total_score: avg(scoreRows, (item) => item.scores?.total_score),
    },
    competitive: {
      medtronicAnswerShare: competitiveAggregate.medtronic.answerShare,
      competitorAnswerShare: competitiveAggregate.competitorAnswerShare,
      medtronicSourceShare: competitiveAggregate.medtronic.sourceShare,
      competitorSourceShare: competitiveAggregate.competitorSourceShare,
      topCompetitorSources: competitiveAggregate.topCompetitorSources.slice(0, 10),
    },
    intentLab: intentSummary ? {
      coverageScore: intentSummary.coverageScore,
      performanceScore: intentSummary.performanceScore,
      avgReferences: intentSummary.avgReferences,
      topMissingCriteria: intentSummary.topMissingCriteria || [],
      byCompetitor: intentSummary.byCompetitor || [],
    } : null,
    byArea,
    riskSummary: {
      rowsWithRisk: riskRows.length,
      topFlags: Object.entries(countBy(allFlags, (flag) => flag))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([flag, count]) => ({ flag, count })),
    },
  };
}

function localSynthesis(aggregate, briefs) {
  return {
    executive_takeaway: "聚焦腾讯元宝时，美敦力已有较高答案可见度和推荐倾向；下一步应把监测结果转为官方可引用资产，优先补齐安全、费用、竞品对比和临床/监管证据。",
    what_yuanbao_can_do_now: [
      "稳定采集元宝回答、HTML、截图和资料引用清单。",
      "逐条判断美敦力是否被找到、说得是否准确、证据是否足够、是否愿意推荐。",
      "计算美敦力与竞品在回答和引用中的 share-of-voice。",
      "识别竞品高权重来源和元宝更容易采纳的证据类型。",
      "把缺口转成稿件 brief、FAQ、事实表和下一轮监测 prompt。",
    ],
    immediate_actions: [
      "先做 MiniMed 竞品对比事实页，因为意图实验已验证该场景高频且元宝引用多。",
      "补一页召回/安全信息FAQ，避免元宝只引用第三方负面内容。",
      "建立 source authority catalog，把官方、监管、临床、媒体、竞品来源分层。",
      "每次发布新稿后用同一组元宝 prompt 回归监测引用份额是否上升。",
    ],
    content_briefs: briefs.slice(0, 6),
    score_snapshot: aggregate.scoreSummary,
  };
}

function compactRows(rows) {
  return rows.map((row) => ({
    questionId: row.questionId,
    prompt: row.prompt,
    status: row.status,
    url: row.url,
    textLength: row.textLength,
    area: {
      id: row.area.id,
      label: row.area.label,
    },
    scores: row.analysis?.scores || null,
    references: row.risk.refs,
    competitive: {
      medtronicAnswerMentions: row.competitive.medtronic?.answerMentions || 0,
      medtronicSourceWeight: row.competitive.medtronic?.sourceWeight || 0,
      competitorMentionTotal: row.competitive.competitorMentionTotal || 0,
      competitorSourceWeight: row.competitive.competitorSourceWeight || 0,
      risks: row.competitive.risks || [],
      topCompetitorSources: (row.competitive.highWeightCompetitorSources || []).slice(0, 5).map((source) => ({
        source: source.source,
        title: source.title,
        authority: source.authority,
        brands: (source.brands || []).map((brand) => ({
          id: brand.id,
          name: brand.name,
          role: brand.role,
          reason: brand.reason,
          score: brand.score,
        })),
      })),
    },
    risk: {
      flags: row.risk.flags,
      missingAssets: row.risk.missingAssets,
      riskHits: row.risk.riskHits,
    },
    action: row.action,
    localFiles: row.localFiles,
  }));
}

function llmPrompt({ aggregate, briefs, prDigest }) {
  return `你是医疗器械品牌GEO和公关内容策略顾问。请只输出JSON。

任务：基于腾讯元宝监测数据，为“美敦力 Medtronic”生成可执行的GEO技术改造和稿件优化方案。不要编造医学事实；所有临床、安全、适应症、监管、费用说法都必须标注“需官方/医学/法规核验”。

需要输出：
{
  "executive_takeaway": string,
  "what_yuanbao_can_do_now": string[],
  "priority_actions": [{"priority":"P0"|"P1"|"P2","action":string,"why":string,"output":string}],
  "content_briefs": [{"title":string,"target_ai_gap":string,"angle":string,"outline":string[],"evidence_to_collect":string[],"compliance_notes":string[]}],
  "next_monitoring_prompts": string[],
  "dashboard_copy": {"hero":string,"risk_note":string}
}

元宝聚合数据：
${JSON.stringify(aggregate, null, 2)}

本地生成的稿件brief候选：
${JSON.stringify(briefs, null, 2).slice(0, 16000)}

公关写作规则摘要：
${JSON.stringify({
    writing_rules: prDigest.writing_rules,
    geo_writing_rules: prDigest.geo_writing_rules,
    medical_compliance_rules: prDigest.medical_compliance_rules,
    forbidden_or_risky_patterns: prDigest.forbidden_or_risky_patterns,
  }, null, 2).slice(0, 10000)}
`;
}

function parseJsonContent(content) {
  const trimmed = String(content || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in LLM response");
  return JSON.parse(match[0]);
}

function callDeepSeek(prompt) {
  if (!API_KEY) throw new Error("DEEPSEEK_API_KEY is required");
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: "You are a rigorous GEO, AEO, medical-device PR and source-authority analyst. Output valid JSON only." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.15,
    max_tokens: 4200,
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
          reject(new Error(`DeepSeek API HTTP ${res.statusCode}: ${text.slice(0, 800)}`));
          return;
        }
        try {
          const payload = JSON.parse(text);
          resolve({
            model: payload.model,
            usage: payload.usage,
            synthesis: parseJsonContent(payload.choices?.[0]?.message?.content || ""),
          });
        } catch (error) {
          reject(new Error(`Failed to parse DeepSeek response: ${error.message}; raw=${text.slice(0, 800)}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("DeepSeek request timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function sourceList(items = []) {
  if (!items.length) return "<li>暂无</li>";
  return items.map((item) => `<li><strong>${escapeHtml(item.brandName || item.brand || "")}</strong> ${escapeHtml(item.title || item.source || "")}<span>${escapeHtml(item.authority?.label || item.authority || "")} ${escapeHtml(item.authority?.score || item.score || "")}</span></li>`).join("");
}

function buildHtml({ aggregate, rows, briefs, synthesis, prDigest }) {
  const areaRows = aggregate.byArea.map((area) => `
    <tr>
      <td>${escapeHtml(area.label)}</td>
      <td>${escapeHtml(area.promptCount)}</td>
      <td>${escapeHtml(area.avgTotalScore)}</td>
      <td>${escapeHtml(area.officialReferenceGaps)}</td>
      <td>${escapeHtml(area.riskFlagCount)}</td>
      <td>${escapeHtml(area.p0Actions)}</td>
    </tr>`).join("");

  const riskRows = aggregate.riskSummary.topFlags.map((item) => `
    <tr><td>${escapeHtml(item.flag)}</td><td>${escapeHtml(item.count)}</td></tr>`).join("");

  const briefCards = briefs.map((brief) => `
    <article class="brief">
      <h3>${escapeHtml(brief.title)}</h3>
      <p>${escapeHtml(brief.objective)}</p>
      <h4>证据要补</h4>
      <ul>${brief.evidenceToCollect.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <h4>AI答案形态</h4>
      <p>${escapeHtml(brief.answerShape.join(" / "))}</p>
      <h4>元宝缺口</h4>
      <ul>${brief.topYuanbaoGaps.map((item) => `<li>${escapeHtml(item.flag)} (${escapeHtml(item.count)})</li>`).join("") || "<li>暂无显著缺口</li>"}</ul>
    </article>`).join("");

  const rowCards = rows.map((row) => `
    <article class="row-card">
      <div class="row-head">
        <h3>${escapeHtml(row.questionId.toUpperCase())} · ${escapeHtml(row.area.label)}</h3>
        <span class="${row.action.priority.toLowerCase()}">${escapeHtml(row.action.priority)}</span>
      </div>
      <p class="prompt">${escapeHtml(row.prompt)}</p>
      <div class="mini-grid">
        <div><span>GEO总分</span><strong>${escapeHtml(row.analysis?.scores?.total_score ?? "-")}</strong></div>
        <div><span>美敦力提及</span><strong>${escapeHtml(row.competitive.medtronic?.answerMentions || 0)}</strong></div>
        <div><span>竞品提及</span><strong>${escapeHtml(row.competitive.competitorMentionTotal || 0)}</strong></div>
        <div><span>官方引用</span><strong>${escapeHtml(row.risk.refs.officialLikeCount)}</strong></div>
      </div>
      <h4>风险/缺口</h4>
      <ul>${row.risk.flags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("") || "<li>暂无显著风险</li>"}</ul>
      <h4>建议资产</h4>
      <p>${escapeHtml(row.action.ownedAssetToCreate)}</p>
      <h4>下一轮元宝监测</h4>
      <p>${escapeHtml(row.action.nextYuanbaoPrompt)}</p>
      <div class="links">
        <a href="${escapeHtml(row.localFiles.txt)}">回答</a>
        <a href="${escapeHtml(row.localFiles.references)}">引用</a>
        <a href="${escapeHtml(row.localFiles.screenshot)}">截图</a>
      </div>
    </article>`).join("");

  const llmActions = (synthesis.priority_actions || synthesis.immediate_actions || []).map((item) => {
    if (typeof item === "string") return `<li>${escapeHtml(item)}</li>`;
    return `<li><strong>${escapeHtml(item.priority || "")}</strong> ${escapeHtml(item.action || "")}<span>${escapeHtml(item.why || item.output || "")}</span></li>`;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>腾讯元宝 · 美敦力 GEO 技术改造 Dashboard</title>
  <style>
    :root { --bg:#f6f7f8; --panel:#fff; --ink:#172026; --muted:#64717d; --line:#dce2e7; --accent:#0f766e; --soft:#dff5f1; --warn:#b45309; --warn-soft:#fff4db; --risk:#b91c1c; --risk-soft:#fee2e2; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.55; }
    a { color:var(--accent); text-decoration:none; font-weight:700; }
    a:hover { text-decoration:underline; }
    header { background:#10201f; color:#fff; padding:32px 28px; }
    .wrap { max-width:1180px; margin:0 auto; }
    h1 { margin:0 0 8px; font-size:29px; letter-spacing:0; }
    header p { margin:0; color:#c7d8d4; max-width:940px; }
    main { padding:24px 28px 48px; }
    section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; margin-bottom:18px; }
    h2 { margin:0 0 12px; font-size:20px; }
    h3 { margin:0 0 8px; font-size:16px; }
    h4 { margin:12px 0 6px; font-size:13px; }
    p { margin:8px 0; }
    .stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .stat, .mini-grid div { border:1px solid var(--line); border-radius:8px; padding:12px; background:#fbfcfd; }
    .stat span, .mini-grid span { display:block; color:var(--muted); font-size:12px; font-weight:800; }
    .stat strong, .mini-grid strong { display:block; margin-top:5px; font-size:24px; }
    .callout { border:1px solid #a7d8d1; background:var(--soft); border-radius:8px; padding:14px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .brief, .row-card { border:1px solid var(--line); background:#fbfcfd; border-radius:8px; padding:14px; }
    .row-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .p0,.p1,.p2 { display:inline-flex; min-height:26px; align-items:center; padding:0 8px; border-radius:999px; font-size:12px; font-weight:900; }
    .p0 { color:var(--risk); background:var(--risk-soft); }
    .p1 { color:var(--warn); background:var(--warn-soft); }
    .p2 { color:#166534; background:#dcfce7; }
    .prompt { color:#33424c; font-weight:700; }
    .mini-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:10px 0; }
    .mini-grid strong { font-size:18px; }
    .links { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .links a { display:inline-flex; min-height:30px; align-items:center; padding:0 10px; border:1px solid var(--line); border-radius:8px; background:#fff; font-size:12px; }
    table { width:100%; border-collapse:collapse; }
    th,td { border-bottom:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; font-size:13px; }
    th { background:#f1f4f6; color:#33424c; }
    li { margin:5px 0; }
    li span { display:block; color:var(--muted); font-size:12px; }
    .source-list { margin:0; padding-left:20px; }
    .source-list li { font-size:13px; }
    @media(max-width:900px){ header,main{padding-left:16px;padding-right:16px;} .stats,.grid,.mini-grid{grid-template-columns:1fr;} h1{font-size:24px;} }
  </style>
</head>
<body>
  <header><div class="wrap"><h1>腾讯元宝 · 美敦力 GEO 技术改造 Dashboard</h1><p>${escapeHtml(synthesis.dashboard_copy?.hero || synthesis.executive_takeaway || localSynthesis(aggregate, briefs).executive_takeaway)}</p></div></header>
  <main><div class="wrap">
    <section>
      <h2>现在能做到什么程度</h2>
      <div class="callout">${escapeHtml(synthesis.executive_takeaway || localSynthesis(aggregate, briefs).executive_takeaway)}</div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>元宝问题数</span><strong>${escapeHtml(aggregate.promptCount)}</strong></div>
        <div class="stat"><span>GEO总分</span><strong>${escapeHtml(aggregate.scoreSummary.total_score)}</strong></div>
        <div class="stat"><span>证据纳入</span><strong>${escapeHtml(aggregate.scoreSummary.evidence_inclusion)}</strong></div>
        <div class="stat"><span>美敦力回答SOV</span><strong>${escapeHtml(aggregate.competitive.medtronicAnswerShare)}%</strong></div>
        <div class="stat"><span>美敦力引用SOV</span><strong>${escapeHtml(aggregate.competitive.medtronicSourceShare)}%</strong></div>
      </div>
    </section>

    <section>
      <h2>优先动作</h2>
      <ul>${llmActions}</ul>
    </section>

    <section>
      <h2>产品线缺口</h2>
      <table><thead><tr><th>产品线</th><th>问题数</th><th>GEO均分</th><th>官方引用缺口</th><th>风险标记</th><th>P0动作</th></tr></thead><tbody>${areaRows}</tbody></table>
    </section>

    <section>
      <h2>风险标记</h2>
      <table><thead><tr><th>标记</th><th>次数</th></tr></thead><tbody>${riskRows}</tbody></table>
    </section>

    <section>
      <h2>竞品高权重来源</h2>
      <ol class="source-list">${sourceList(aggregate.competitive.topCompetitorSources)}</ol>
    </section>

    <section>
      <h2>稿件与资产 Brief</h2>
      <div class="grid">${briefCards}</div>
    </section>

    <section>
      <h2>逐问题优化动作</h2>
      <div class="grid">${rowCards}</div>
    </section>

    <section>
      <h2>公关写作规则已接入</h2>
      <p>读取资料数：${escapeHtml(prDigest.document_count || 0)}。当前脚本只保存摘要化规则，不提交原始PDF/PPTX。</p>
      <ul>${(prDigest.medtronic_application || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  </div></main>
</body>
</html>`;
}

async function main() {
  const matrixRunDir = path.resolve(process.argv[2] || process.env.GEO_OPTIMIZER_RUN_DIR || DEFAULT_MATRIX_RUN_DIR);
  const intentRunDir = path.resolve(process.env.GEO_INTENT_RUN_DIR || DEFAULT_INTENT_RUN_DIR);
  const prDigest = readJson(process.env.PR_GUIDELINE_DIGEST || DEFAULT_PR_DIGEST, DEFAULT_PR_RULES);
  ensureDir(OUT_DIR);

  const { rows } = buildRows(matrixRunDir, prDigest);
  const aggregate = buildAggregate({ matrixRunDir, intentRunDir, rows });
  const briefs = buildArticleBriefs(rows, prDigest);
  let synthesis = localSynthesis(aggregate, briefs);
  let llm = null;

  if (USE_LLM) {
    try {
      llm = await callDeepSeek(llmPrompt({ aggregate, briefs, prDigest }));
      synthesis = { ...synthesis, ...llm.synthesis };
    } catch (error) {
      synthesis.llm_error = error.message;
      console.error(`optimizer_llm_failed ${error.message.slice(0, 240)}`);
    }
  }

  const payload = {
    createdAt: new Date().toISOString(),
    matrixRunDir,
    intentRunDir,
    platform: "yuanbao",
    aggregate,
    synthesis,
    llm: llm ? { model: llm.model, usage: llm.usage } : null,
    articleBriefs: briefs,
    rows: compactRows(rows),
  };
  writeJson(path.join(OUT_DIR, "yuanbao_geo_optimization.json"), payload);
  writeJson(path.join(OUT_DIR, "article_briefs.json"), briefs);
  fs.writeFileSync(path.join(OUT_DIR, "yuanbao_geo_optimization.html"), buildHtml({ aggregate, rows, briefs, synthesis, prDigest }), { mode: 0o600 });
  console.log(`yuanbao_geo_optimization_saved ${path.join(OUT_DIR, "yuanbao_geo_optimization.html")}`);
  console.log(JSON.stringify({
    promptCount: aggregate.promptCount,
    totalScore: aggregate.scoreSummary.total_score,
    evidenceInclusion: aggregate.scoreSummary.evidence_inclusion,
    medtronicAnswerShare: aggregate.competitive.medtronicAnswerShare,
    medtronicSourceShare: aggregate.competitive.medtronicSourceShare,
    usedLlm: Boolean(llm),
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
