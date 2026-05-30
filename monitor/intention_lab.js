#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(ROOT, "monitor_runs");
const LAB_DIR = path.join(OUT_ROOT, "minimed_intent_lab");
const RUN_LABEL = "minimed_intent_lab";

const CRITERIA = {
  tir_efficacy: {
    label: "控糖效果/TIR",
    patterns: ["TIR", "time in range", "范围内时间", "控糖", "血糖控制", "HbA1c", "糖化", "餐后"],
  },
  hypoglycemia: {
    label: "低血糖/安全预警",
    patterns: ["低血糖", "高血糖", "报警", "预警", "暂停输注", "酮症", "安全", "风险"],
  },
  algorithm: {
    label: "闭环算法/AID",
    patterns: ["闭环", "AID", "自动模式", "算法", "SmartGuard", "Control-IQ", "自动基础率", "自动校正", "Auto"],
  },
  cgm_accuracy: {
    label: "CGM/传感器准确性",
    patterns: ["CGM", "传感器", "Guardian", "Simplera", "Dexcom", "Libre", "MARD", "校准", "准确"],
  },
  wearability: {
    label: "佩戴体验/管路",
    patterns: ["管路", "无管路", "贴片", "佩戴", "防水", "换耗材", "耗材更换", "体积", "皮肤"],
  },
  cost_access: {
    label: "费用/医保/可及性",
    patterns: ["费用", "价格", "医保", "报销", "耗材成本", "国内", "可及", "上市", "渠道", "购买"],
  },
  patient_fit: {
    label: "患者画像/适用人群",
    patterns: ["1型", "一型", "2型", "二型", "儿童", "青少年", "成人", "孕", "年龄", "胰岛素", "适合"],
  },
  training_support: {
    label: "培训/售后/医生支持",
    patterns: ["培训", "售后", "随访", "医生", "内分泌", "教育护士", "厂商", "客服", "支持"],
  },
  evidence_sources: {
    label: "证据/临床来源",
    patterns: ["研究", "临床", "试验", "指南", "FDA", "NMPA", "数据", "证据", "引用", "来源"],
  },
  brand_comparison: {
    label: "品牌/竞品差异",
    patterns: ["美敦力", "Medtronic", "MiniMed", "竞品", "相比", "对比", "优势", "短板", "缺点"],
  },
};

const INTENTS = [
  {
    id: "performance",
    label: "Performance: 控糖表现与产品能力",
    source: "WildChat adapter fallback seed",
    expectedCriteria: [
      "tir_efficacy",
      "hypoglycemia",
      "algorithm",
      "cgm_accuracy",
      "wearability",
      "evidence_sources",
      "brand_comparison",
    ],
    seedPrompts: [
      "Which insulin pump has better glucose control and fewer lows?",
      "Compare MiniMed 780G with another pump for TIR, safety, sensor accuracy, and daily use.",
      "Is the automated insulin delivery algorithm worth switching for?",
    ],
  },
  {
    id: "decision_fit",
    label: "Intention Coverage: 用户选择路径",
    source: "WildChat adapter fallback seed",
    expectedCriteria: [
      "patient_fit",
      "algorithm",
      "hypoglycemia",
      "cgm_accuracy",
      "wearability",
      "cost_access",
      "training_support",
      "brand_comparison",
    ],
    seedPrompts: [
      "Should I choose MiniMed or another diabetes device for my child?",
      "What questions should I ask before switching insulin pump or CGM?",
      "Which diabetes device is better for my budget, lifestyle, and doctor support?",
    ],
  },
];

const COMPETITORS = [
  {
    id: "tandem",
    name: "Tandem t:slim X2 / Mobi + Control-IQ",
    aliases: ["Tandem", "t:slim", "Mobi", "Control-IQ"],
    category: "带管路闭环胰岛素泵",
    why: "MiniMed 在 AID/闭环泵上的直接对标对象，核心比较点是算法、Dexcom 生态、TIR 与餐时自动校正。",
  },
  {
    id: "insulet",
    name: "Insulet Omnipod 5",
    aliases: ["Insulet", "Omnipod", "Omnipod 5"],
    category: "无管路贴片闭环泵",
    why: "以无管路佩戴体验区分，是用户在生活方式、儿童和运动场景中常会比较的替代选择。",
  },
  {
    id: "dexcom",
    name: "Dexcom G7 + 兼容闭环生态",
    aliases: ["Dexcom", "Dexcom G7", "G7"],
    category: "CGM 与开放兼容生态",
    why: "不是泵本身，但影响闭环体验和选型；用户常把 MiniMed 自家传感器与 Dexcom 精度/兼容性比较。",
  },
  {
    id: "abbott",
    name: "Abbott FreeStyle Libre 3 / 3 Plus",
    aliases: ["Abbott", "FreeStyle Libre", "Libre 3", "雅培", "瞬感"],
    category: "CGM 与部分 AID 兼容生态",
    why: "在 CGM 普及、佩戴天数、费用和医保可及性上与 MiniMed 方案竞争用户心智。",
  },
];

function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
  try { fs.chmodSync(dir, mode); } catch {}
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload, mode = 0o600) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { mode });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rel(from, to) {
  return path.relative(from, to).split(path.sep).join("/");
}

function excerpt(text, max = 900) {
  const compact = String(text || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trim()}...`;
}

function stripAnswer(text, prompt) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  const promptIndex = normalized.lastIndexOf(prompt);
  let body = promptIndex >= 0 ? normalized.slice(promptIndex + prompt.length) : normalized;
  body = body
    .replace(/^\s*(深度思考|联网搜索|智能搜索|内容由 AI 生成，请仔细甄别|内容由AI生成，仅供参考)\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return body || normalized;
}

function includesAny(text, patterns) {
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(String(pattern).toLowerCase()));
}

function statusOk(status) {
  return status === "ok" || status === "ok_no_references_detected";
}

function buildQuestions() {
  const questions = [];
  for (const competitor of COMPETITORS) {
    const performanceIntent = INTENTS.find((intent) => intent.id === "performance");
    const fitIntent = INTENTS.find((intent) => intent.id === "decision_fit");
    questions.push({
      questionId: `q${String(questions.length + 1).padStart(2, "0")}`,
      competitorId: competitor.id,
      competitorName: competitor.name,
      intentId: performanceIntent.id,
      intentLabel: performanceIntent.label,
      expectedCriteria: performanceIntent.expectedCriteria,
      prompt: `美敦力 MiniMed 780G/770G 和 ${competitor.name} 哪个 performance 更好？请从控糖效果/TIR、低血糖风险、闭环算法、CGM准确性、佩戴体验、安全风险和适用人群给出对比建议，并列出你依据的来源。`,
    });
    questions.push({
      questionId: `q${String(questions.length + 1).padStart(2, "0")}`,
      competitorId: competitor.id,
      competitorName: competitor.name,
      intentId: fitIntent.id,
      intentLabel: fitIntent.label,
      expectedCriteria: fitIntent.expectedCriteria,
      prompt: `如果用户正在考虑“美敦力 MiniMed 还是 ${competitor.name}”，AI 回答应该覆盖哪些关键问题，才能帮助患者/家属/医生做决策？请按真实咨询意图给出选择建议。`,
    });
  }
  return questions;
}

function prepareMinimed() {
  ensureDir(LAB_DIR);
  const questions = buildQuestions();
  const promptMatrix = questions.map((question) => question.prompt).join("\n");
  fs.writeFileSync(path.join(LAB_DIR, "prompt_matrix.txt"), `${promptMatrix}\n`, { mode: 0o600 });

  const spec = {
    createdAt: new Date().toISOString(),
    runLabel: RUN_LABEL,
    brand: "Medtronic MiniMed",
    productLine: "MiniMed 780G/770G diabetes management",
    datasetChoice: {
      selected: "WildChat",
      reason: "LMSYS-Chat-1M is gated for direct file access, while WildChat is more practical for real user-intent mining. This first test uses the WildChat adapter shape plus a small fallback seed because live Hugging Face access timed out on this machine.",
      liveRowsUsed: false,
      fallbackSeedUsed: true,
    },
    competitors: COMPETITORS,
    intents: INTENTS,
    criteria: CRITERIA,
    questions,
  };
  writeJson(path.join(LAB_DIR, "intent_spec.json"), spec);
  writeJson(path.join(LAB_DIR, "wildchat_minimed_seed.json"), {
    source: "WildChat adapter fallback seed",
    note: "Replace this file with sampled WildChat user turns when Hugging Face access is available.",
    intents: INTENTS.map((intent) => ({
      id: intent.id,
      label: intent.label,
      seedPrompts: intent.seedPrompts,
    })),
  });

  const readme = [
    "# MiniMed Intent Lab",
    "",
    "This folder contains the first MiniMed competitor/intention experiment.",
    "",
    "Run Yuanbao monitoring:",
    "",
    "```bash",
    "npm run monitor:minimed:yuanbao",
    "npm run intent:minimed:score",
    "```",
    "",
    "Generated prompts are based on a WildChat-style user-intent adapter and fallback seed. The scoring step measures whether Yuanbao covered the expected decision criteria.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(LAB_DIR, "README.md"), readme, { mode: 0o600 });

  console.log(`intent_lab_prepared ${LAB_DIR}`);
  console.log(JSON.stringify({
    promptFile: path.join(LAB_DIR, "prompt_matrix.txt"),
    intentSpecFile: path.join(LAB_DIR, "intent_spec.json"),
    questions: questions.length,
    competitors: COMPETITORS.map((competitor) => competitor.name),
  }, null, 2));
}

function latestRunDir() {
  if (!fs.existsSync(OUT_ROOT)) return null;
  const dirs = fs.readdirSync(OUT_ROOT)
    .filter((name) => name.endsWith(`_${RUN_LABEL}`))
    .map((name) => path.join(OUT_ROOT, name))
    .filter((dir) => fs.existsSync(path.join(dir, "summary.json")))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}

function resolveRunDir(value) {
  if (value || process.env.GEO_INTENT_RUN_DIR) {
    return path.resolve(value || process.env.GEO_INTENT_RUN_DIR);
  }
  const latest = latestRunDir();
  if (!latest) throw new Error(`No ${RUN_LABEL} run found under ${OUT_ROOT}. Run npm run monitor:minimed:yuanbao first.`);
  return latest;
}

function scoreRun(runDirArg) {
  const runDir = resolveRunDir(runDirArg);
  const summary = readJson(path.join(runDir, "summary.json"));
  const spec = readJson(path.join(runDir, "intent_spec.json")) || readJson(path.join(LAB_DIR, "intent_spec.json"));
  if (!summary?.summary?.length) throw new Error(`No monitor summary found in ${runDir}`);
  if (!spec?.questions?.length) throw new Error(`No intent_spec.json found for ${runDir}`);

  const questionById = new Map(spec.questions.map((question) => [question.questionId, question]));
  const rows = summary.summary.filter((row) => row.platform === "yuanbao");
  const analyses = rows.map((row) => {
    const question = questionById.get(row.questionId) || {};
    const txtPath = path.join(runDir, row.questionId, "yuanbao.txt");
    const answer = stripAnswer(fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf8") : "", row.prompt || question.prompt || "");
    const expected = question.expectedCriteria || [];
    const coverage = expected.map((criterionId) => {
      const criterion = CRITERIA[criterionId];
      const covered = criterion ? includesAny(answer, criterion.patterns) : false;
      return {
        id: criterionId,
        label: criterion?.label || criterionId,
        covered,
      };
    });
    const coveredCount = coverage.filter((item) => item.covered).length;
    const coverageScore = expected.length ? Math.round((coveredCount / expected.length) * 100) : 0;
    const competitor = COMPETITORS.find((item) => item.id === question.competitorId);
    const competitorMentioned = competitor ? includesAny(answer, competitor.aliases.concat([competitor.name])) : false;
    const minimedMentioned = includesAny(answer, ["MiniMed", "780G", "770G", "美敦力", "Medtronic"]);
    const balanced = includesAny(answer, ["优势", "短板", "缺点", "局限", "不适合", "风险", "注意"]) && competitorMentioned && minimedMentioned;
    const referenceStrength = Math.min(100, Math.round(((row.referenceItemCount || 0) * 8) + ((row.citationMarkerCount || 0) * 3)));
    const answerStrength = Math.min(100, Math.round((Math.min(row.textLength || 0, 6000) / 6000) * 100));
    const performanceScore = Math.round((
      (statusOk(row.status) ? 30 : 0) +
      (competitorMentioned ? 15 : 0) +
      (minimedMentioned ? 15 : 0) +
      (balanced ? 15 : 0) +
      Math.min(15, Math.round(referenceStrength * 0.15)) +
      Math.min(10, Math.round(answerStrength * 0.10))
    ));

    return {
      questionId: row.questionId,
      platform: row.platform,
      status: row.status,
      ok: statusOk(row.status),
      prompt: row.prompt || question.prompt,
      competitorId: question.competitorId,
      competitorName: question.competitorName,
      intentId: question.intentId,
      intentLabel: question.intentLabel,
      coverage,
      coverageScore,
      missingCriteria: coverage.filter((item) => !item.covered),
      competitorMentioned,
      minimedMentioned,
      balanced,
      performanceScore,
      referenceItemCount: row.referenceItemCount || 0,
      citationMarkerCount: row.citationMarkerCount || 0,
      sourceNodeCount: row.sourceNodeCount || 0,
      textLength: row.textLength || 0,
      elapsedMs: row.waitResult?.elapsedMs || null,
      url: row.url,
      answerExcerpt: excerpt(answer),
      files: {
        text: path.join(row.questionId, "yuanbao.txt"),
        html: path.join(row.questionId, "yuanbao.html"),
        screenshot: path.join(row.questionId, "yuanbao.png"),
        references: path.join(row.questionId, "yuanbao_references.txt"),
      },
    };
  });

  const avg = (items, fn) => items.length ? Math.round(items.reduce((sum, item) => sum + Number(fn(item) || 0), 0) / items.length) : 0;
  const byCompetitor = COMPETITORS.map((competitor) => {
    const items = analyses.filter((item) => item.competitorId === competitor.id);
    return {
      id: competitor.id,
      name: competitor.name,
      category: competitor.category,
      promptCount: items.length,
      okCount: items.filter((item) => item.ok).length,
      coverageScore: avg(items, (item) => item.coverageScore),
      performanceScore: avg(items, (item) => item.performanceScore),
      avgReferences: avg(items, (item) => item.referenceItemCount),
      missingCriteria: rankMissing(items),
    };
  });

  const byIntent = INTENTS.map((intent) => {
    const items = analyses.filter((item) => item.intentId === intent.id);
    return {
      id: intent.id,
      label: intent.label,
      promptCount: items.length,
      coverageScore: avg(items, (item) => item.coverageScore),
      performanceScore: avg(items, (item) => item.performanceScore),
      missingCriteria: rankMissing(items),
    };
  });

  const aggregate = {
    runDir,
    createdAt: new Date().toISOString(),
    promptCount: analyses.length,
    okRate: analyses.length ? Math.round((analyses.filter((item) => item.ok).length / analyses.length) * 100) : 0,
    coverageScore: avg(analyses, (item) => item.coverageScore),
    performanceScore: avg(analyses, (item) => item.performanceScore),
    avgReferences: avg(analyses, (item) => item.referenceItemCount),
    byCompetitor,
    byIntent,
    topMissingCriteria: rankMissing(analyses),
  };

  const payload = { aggregate, analyses, spec };
  writeJson(path.join(runDir, "intent_coverage_summary.json"), payload);
  writeCsv(runDir, analyses);
  buildDashboard(runDir, payload);
  console.log(`intent_scored ${runDir}`);
  console.log(JSON.stringify(aggregate, null, 2));
  return payload;
}

function rankMissing(items) {
  const counts = new Map();
  for (const item of items) {
    for (const criterion of item.missingCriteria || []) {
      counts.set(criterion.label, (counts.get(criterion.label) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 8);
}

function writeCsv(runDir, analyses) {
  const columns = [
    "question_id",
    "competitor",
    "intent",
    "status",
    "coverage_score",
    "performance_score",
    "references",
    "citations",
    "missing_criteria",
    "prompt",
  ];
  const rows = analyses.map((item) => ({
    question_id: item.questionId,
    competitor: item.competitorName,
    intent: item.intentId,
    status: item.status,
    coverage_score: item.coverageScore,
    performance_score: item.performanceScore,
    references: item.referenceItemCount,
    citations: item.citationMarkerCount,
    missing_criteria: item.missingCriteria.map((criterion) => criterion.label).join("; "),
    prompt: item.prompt,
  }));
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
  fs.writeFileSync(path.join(runDir, "intent_coverage_summary.csv"), csv, { mode: 0o600 });
}

function pillList(items) {
  if (!items?.length) return '<span class="pill good">无明显缺口</span>';
  return items.map((item) => `<span class="pill warn">${escapeHtml(item.label)} x${escapeHtml(item.count)}</span>`).join("");
}

function coverageList(coverage) {
  return coverage.map((item) => `<span class="criterion ${item.covered ? "hit" : "miss"}">${escapeHtml(item.label)}</span>`).join("");
}

function bar(value) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="bar"><i style="width:${score}%"></i></div>`;
}

function buildDashboard(runDir, payload) {
  const { aggregate, analyses, spec } = payload;
  const competitorCards = aggregate.byCompetitor.map((item) => `
    <section class="card">
      <div class="card-head">
        <h3>${escapeHtml(item.name)}</h3>
        <span>${escapeHtml(item.category)}</span>
      </div>
      <div class="score-row"><span>Performance</span>${bar(item.performanceScore)}<strong>${escapeHtml(item.performanceScore)}</strong></div>
      <div class="score-row"><span>Intent Coverage</span>${bar(item.coverageScore)}<strong>${escapeHtml(item.coverageScore)}</strong></div>
      <p>OK ${escapeHtml(item.okCount)}/${escapeHtml(item.promptCount)} · 平均引用 ${escapeHtml(item.avgReferences)}</p>
      <div class="pillbox">${pillList(item.missingCriteria)}</div>
    </section>
  `).join("");

  const intentCards = aggregate.byIntent.map((item) => `
    <section class="card">
      <div class="card-head">
        <h3>${escapeHtml(item.label)}</h3>
        <span>${escapeHtml(item.promptCount)} prompts</span>
      </div>
      <div class="score-row"><span>Performance</span>${bar(item.performanceScore)}<strong>${escapeHtml(item.performanceScore)}</strong></div>
      <div class="score-row"><span>Coverage</span>${bar(item.coverageScore)}<strong>${escapeHtml(item.coverageScore)}</strong></div>
      <div class="pillbox">${pillList(item.missingCriteria)}</div>
    </section>
  `).join("");

  const rows = analyses.map((item) => `
    <article class="answer-card">
      <div class="answer-head">
        <div>
          <span>${escapeHtml(item.questionId.toUpperCase())} · ${escapeHtml(item.intentId)}</span>
          <h3>${escapeHtml(item.competitorName)}</h3>
        </div>
        <div class="score-pair">
          <strong>${escapeHtml(item.performanceScore)}</strong>
          <em>perf</em>
          <strong>${escapeHtml(item.coverageScore)}</strong>
          <em>cover</em>
        </div>
      </div>
      <p class="prompt">${escapeHtml(item.prompt)}</p>
      <div class="criteria">${coverageList(item.coverage)}</div>
      <p class="excerpt">${escapeHtml(item.answerExcerpt)}</p>
      <div class="links">
        <a href="${escapeHtml(item.files.text)}">文本</a>
        <a href="${escapeHtml(item.files.html)}">HTML</a>
        <a href="${escapeHtml(item.files.screenshot)}">截图</a>
        <a href="${escapeHtml(item.files.references)}">引用</a>
        ${item.url ? `<a href="${escapeHtml(item.url)}">原对话</a>` : ""}
      </div>
    </article>
  `).join("");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MiniMed Intent Coverage Dashboard</title>
  <style>
    :root { --ink:#17202a; --muted:#657080; --line:#d8dee8; --bg:#f6f7f9; --panel:#fff; --accent:#176b87; --good:#197a4f; --warn:#a45d00; --miss:#ad2f34; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.55; }
    header { padding:32px 40px 20px; background:#ffffff; border-bottom:1px solid var(--line); }
    header h1 { margin:0 0 10px; font-size:28px; letter-spacing:0; }
    header p { margin:0; color:var(--muted); max-width:980px; }
    main { padding:24px 40px 48px; }
    .metrics, .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:18px; }
    .metric, .card, .answer-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .metric span, .card span, .answer-head span { color:var(--muted); font-size:12px; text-transform:uppercase; }
    .metric strong { display:block; font-size:32px; margin-top:6px; }
    h2 { margin:26px 0 12px; font-size:18px; }
    .card-head, .answer-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    .card h3, .answer-card h3 { margin:2px 0 10px; font-size:16px; }
    .score-row { display:grid; grid-template-columns:140px 1fr 42px; align-items:center; gap:10px; margin:10px 0; font-size:13px; }
    .bar { height:8px; background:#e8edf2; border-radius:999px; overflow:hidden; }
    .bar i { display:block; height:100%; background:var(--accent); }
    .pillbox { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .pill, .criterion { display:inline-flex; border-radius:999px; padding:4px 8px; font-size:12px; border:1px solid var(--line); background:#f8fafb; }
    .pill.good, .criterion.hit { color:var(--good); border-color:#a5d6bd; background:#edf8f2; }
    .pill.warn { color:var(--warn); border-color:#e6c38f; background:#fff7e8; }
    .criterion.miss { color:var(--miss); border-color:#e6abb0; background:#fff0f1; }
    .answer-list { display:grid; grid-template-columns:1fr; gap:14px; }
    .score-pair { display:grid; grid-template-columns:auto auto auto auto; gap:5px 8px; align-items:baseline; text-align:right; }
    .score-pair strong { font-size:22px; }
    .score-pair em { color:var(--muted); font-style:normal; font-size:12px; }
    .prompt { color:#344252; font-weight:600; }
    .criteria { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
    .excerpt { color:#2f3a45; white-space:pre-wrap; }
    .links { display:flex; gap:12px; flex-wrap:wrap; border-top:1px solid var(--line); margin-top:12px; padding-top:10px; }
    a { color:var(--accent); text-decoration:none; }
    @media (max-width:1000px) { .metrics, .grid { grid-template-columns:repeat(2,minmax(0,1fr)); } main, header { padding-left:20px; padding-right:20px; } }
    @media (max-width:620px) { .metrics, .grid { grid-template-columns:1fr; } .score-row { grid-template-columns:110px 1fr 36px; } .answer-head { flex-direction:column; } }
  </style>
</head>
<body>
  <header>
    <h1>MiniMed 竞品意图覆盖测试</h1>
    <p>数据源选择：${escapeHtml(spec.datasetChoice?.selected || "WildChat")}。本轮是小样本测试，使用 WildChat adapter fallback seed 生成用户意图，再让腾讯元宝回答 4 个主要竞品各 2 个问题，评估 performance 与关键意图覆盖。</p>
  </header>
  <main>
    <section class="metrics">
      <div class="metric"><span>OK Rate</span><strong>${escapeHtml(aggregate.okRate)}%</strong></div>
      <div class="metric"><span>Performance</span><strong>${escapeHtml(aggregate.performanceScore)}</strong></div>
      <div class="metric"><span>Intent Coverage</span><strong>${escapeHtml(aggregate.coverageScore)}</strong></div>
      <div class="metric"><span>Avg References</span><strong>${escapeHtml(aggregate.avgReferences)}</strong></div>
    </section>
    <h2>竞品表现</h2>
    <section class="grid">${competitorCards}</section>
    <h2>关键意图</h2>
    <section class="grid">${intentCards}</section>
    <h2>品牌需要关注的问题缺口</h2>
    <section class="card"><div class="pillbox">${pillList(aggregate.topMissingCriteria)}</div></section>
    <h2>逐问题诊断</h2>
    <section class="answer-list">${rows}</section>
  </main>
</body>
</html>`;
  fs.writeFileSync(path.join(runDir, "intent_dashboard.html"), html, { mode: 0o600 });
}

function main() {
  const command = process.argv[2] || "prepare-minimed";
  if (command === "prepare-minimed") return prepareMinimed();
  if (command === "score" || command === "dashboard") return scoreRun(process.argv[3]);
  throw new Error(`Unknown command: ${command}`);
}

main();
