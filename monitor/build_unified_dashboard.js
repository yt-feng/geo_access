#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "monitor_runs", "unified_dashboard.html");
const OUT_JSON = path.join(ROOT, "monitor_runs", "unified_dashboard_summary.json");

const PATHS = {
  matrixRun: path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix"),
  matrixDashboard: path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix", "dashboard.html"),
  geoAnalysis: path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix", "geo_analysis_summary.json"),
  competitive: path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix", "competitive_geo_summary.json"),
  minimedRun: path.join(ROOT, "monitor_runs", "2026-05-30T16-25-01-295Z_minimed_intent_lab"),
  minimedDashboard: path.join(ROOT, "monitor_runs", "2026-05-30T16-25-01-295Z_minimed_intent_lab", "intent_dashboard.html"),
  minimedIntent: path.join(ROOT, "monitor_runs", "2026-05-30T16-25-01-295Z_minimed_intent_lab", "intent_coverage_summary.json"),
  yuanbaoOptimization: path.join(ROOT, "monitor_runs", "yuanbao_medtronic_optimization", "yuanbao_geo_optimization.json"),
  yuanbaoOptimizationDashboard: path.join(ROOT, "monitor_runs", "yuanbao_medtronic_optimization", "yuanbao_geo_optimization.html"),
  wildchatPurchase: path.join(ROOT, "monitor_runs", "wildchat_purchase_archetypes", "purchase_archetypes.json"),
  wildchatPurchaseDashboard: path.join(ROOT, "monitor_runs", "wildchat_purchase_archetypes", "purchase_archetypes.html"),
  wildchatSynthesis: path.join(ROOT, "monitor_runs", "wildchat_purchase_archetypes", "deepseek_synthesis.json"),
  wildchatSynthesisDashboard: path.join(ROOT, "monitor_runs", "wildchat_purchase_archetypes", "deepseek_synthesis.html"),
  prDigest: path.join(ROOT, "monitor_runs", "pr_guideline_digest", "pr_guideline_digest.json"),
  prDigestDashboard: path.join(ROOT, "monitor_runs", "pr_guideline_digest", "pr_guideline_digest.html"),
  openSourceUniverse: path.join(ROOT, "monitor_runs", "open_source_geo_universe", "repo_universe.json"),
  openSourceUniverseDashboard: path.join(ROOT, "monitor_runs", "open_source_geo_universe", "open_source_geo_universe.html"),
};

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

function rel(to) {
  return path.relative(path.dirname(OUT_FILE), to).split(path.sep).join("/");
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Math.round(Number(value))}%`;
}

function num(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return String(Math.round(Number(value)));
}

function list(items, mapper = (item) => item) {
  const rows = (items || []).filter(Boolean).map((item) => `<li>${escapeHtml(mapper(item))}</li>`);
  return rows.length ? rows.join("") : "<li>暂无</li>";
}

function card(title, text, link, meta) {
  return `
    <a class="link-card" href="${escapeHtml(rel(link))}">
      <span>${escapeHtml(meta || "打开")}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </a>`;
}

function scoreRows(geoAggregate = {}) {
  const platforms = [
    ["yuanbao", "腾讯元宝"],
    ["deepseek", "DeepSeek"],
  ];
  return platforms.map(([id, label]) => {
    const row = geoAggregate[id] || {};
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(row.count || 0)}</td>
        <td>${num(row.answer_visibility)}</td>
        <td>${num(row.cognitive_accuracy)}</td>
        <td>${num(row.evidence_inclusion)}</td>
        <td>${num(row.recommendation_conversion)}</td>
        <td><strong>${num(row.total_score)}</strong></td>
      </tr>`;
  }).join("");
}

function brandRows(brands = []) {
  return brands.slice(0, 10).map((brand) => `
    <tr>
      <td>${escapeHtml(brand.name)}</td>
      <td>${escapeHtml(brand.role === "target" ? "目标品牌" : "竞品")}</td>
      <td>${escapeHtml(brand.answerMentions || 0)}</td>
      <td>${pct(brand.answerShare)}</td>
      <td>${escapeHtml(brand.sourceWeight || 0)}</td>
      <td>${pct(brand.sourceShare)}</td>
      <td>${escapeHtml(brand.officialSourceCount || 0)}</td>
    </tr>`).join("");
}

function areaRows(areas = []) {
  return areas.map((area) => `
    <tr>
      <td>${escapeHtml(area.label)}</td>
      <td>${escapeHtml(area.promptCount || 0)}</td>
      <td>${num(area.avgTotalScore)}</td>
      <td>${escapeHtml(area.officialReferenceGaps || 0)}</td>
      <td>${escapeHtml(area.riskFlagCount || 0)}</td>
      <td>${escapeHtml(area.p0Actions || 0)}</td>
    </tr>`).join("");
}

function actionRows(actions = []) {
  return actions.slice(0, 8).map((item) => `
    <tr>
      <td><span class="priority ${escapeHtml(String(item.priority || "P1").toLowerCase())}">${escapeHtml(item.priority || "P1")}</span></td>
      <td>${escapeHtml(item.action || "")}</td>
      <td>${escapeHtml(item.why || "")}</td>
      <td>${escapeHtml(item.output || "")}</td>
    </tr>`).join("");
}

function briefCards(briefs = []) {
  return briefs.slice(0, 6).map((brief) => `
    <article class="brief">
      <h3>${escapeHtml(brief.title || brief.id)}</h3>
      <p>${escapeHtml(brief.objective || brief.target_ai_gap || "")}</p>
      <div class="brief-meta">
        <span>${escapeHtml((brief.evidenceToCollect || brief.evidence_to_collect || []).slice(0, 3).join(" / "))}</span>
      </div>
    </article>`).join("");
}

function sourceRows(sources = []) {
  return sources.slice(0, 10).map((source) => {
    const brands = (source.brands || []).map((brand) => brand.name || brand.id).join("、");
    return `
      <tr>
        <td>${escapeHtml(source.source || "")}</td>
        <td>${escapeHtml(source.title || "")}</td>
        <td>${escapeHtml(source.authority?.label || "")}</td>
        <td>${escapeHtml(source.authority?.score || "")}</td>
        <td>${escapeHtml(brands)}</td>
      </tr>`;
  }).join("");
}

function archetypeRows(archetypes = []) {
  return archetypes.slice(0, 9).map((item) => `
    <tr>
      <td>${escapeHtml(item.label || item.id)}</td>
      <td>${escapeHtml(item.stage || item.decision_stage || "")}</td>
      <td>${escapeHtml(item.user_pattern || (item.classic_user_phrasings || []).join(" / "))}</td>
      <td>${escapeHtml(item.geo_risk || (item.what_user_really_needs || []).join("；"))}</td>
    </tr>`).join("");
}

function capabilityRows(layers = []) {
  return layers.map((layer) => `
    <tr>
      <td>${escapeHtml(layer.id)}</td>
      <td>${escapeHtml(layer.name)}</td>
      <td>${escapeHtml(layer.current_coverage)}</td>
      <td>${escapeHtml((layer.representative_repos || []).slice(0, 4).join("、"))}</td>
      <td>${escapeHtml(layer.recommended_fusion)}</td>
    </tr>`).join("");
}

const JOURNEY_STAGES = [
  {
    id: "need",
    label: "1. 需求定义",
    shortLabel: "需求定义",
    archetypeIds: ["need_framing"],
    promptKeywords: ["应该看", "哪些指标", "什么品类", "核心产品", "临床场景"],
    userQuestion: "我到底该看什么方案，哪些指标重要？",
    currentGap: "监测样本仍以品牌/竞品问题为主，非品牌泛问覆盖偏少。",
  },
  {
    id: "shortlist",
    label: "2. 候选清单",
    shortLabel: "候选清单",
    archetypeIds: ["category_recommendation", "alternatives"],
    promptKeywords: ["怎么选", "其他竞品", "替代方案", "平替", "候选"],
    userQuestion: "AI 会把哪些品牌放进候选清单？",
    currentGap: "已有竞品对比，但还缺少不点名美敦力时的候选清单监测。",
  },
  {
    id: "compare",
    label: "3. 方案比较",
    shortLabel: "方案比较",
    archetypeIds: ["compare_options", "should_buy_worth"],
    promptKeywords: ["对比", "相比", "哪个", "performance", "优势", "短板", "值得", "比较", "怎么选"],
    userQuestion: "美敦力和竞品相比，谁更适合我？",
    currentGap: "已有产品线对比，下一步要把适用人群、不适用人群和证据边界固化为必测维度。",
  },
  {
    id: "trust",
    label: "4. 信任验证",
    shortLabel: "信任验证",
    archetypeIds: ["risk_trust"],
    promptKeywords: ["安全", "副作用", "召回", "负面", "风险", "放心", "证据", "来源"],
    userQuestion: "安全、召回、风险和证据是否足够可信？",
    currentGap: "安全问法已覆盖，但官方事实核验和监管/临床证据入口仍需持续观察。",
  },
  {
    id: "access",
    label: "5. 价格可及",
    shortLabel: "价格可及",
    archetypeIds: ["price_value", "channel_access"],
    promptKeywords: ["价格", "费用", "医保", "报销", "集采", "收费", "经销商", "渠道", "购买", "可及"],
    userQuestion: "买不买得起，哪里买，医院能不能用？",
    currentGap: "真实需求信号最高，但医保、地区可及、医院采购和渠道路径仍需拆成独立问法。",
  },
  {
    id: "support",
    label: "6. 使用服务",
    shortLabel: "使用服务",
    archetypeIds: ["post_purchase"],
    promptKeywords: ["术后", "注意事项", "培训", "售后", "维护", "随访", "安装", "服务"],
    userQuestion: "装上或买了之后，培训、维护、售后怎么办？",
    currentGap: "售后/培训被问到，但日常使用、耗材、故障、长期随访问题库偏薄。",
  },
];

function archetypeById(wildchat = {}, synthesis = {}) {
  const map = new Map();
  for (const item of wildchat.archetypes || []) map.set(item.id, item);
  for (const item of synthesis.archetypes || []) map.set(item.id, { ...(map.get(item.id) || {}), ...item });
  return map;
}

function promptMatches(prompt, keywords) {
  return keywords.some((keyword) => String(prompt || "").toLowerCase().includes(String(keyword).toLowerCase()));
}

function rowsForStage(rows = [], stage) {
  return rows.filter((row) => promptMatches(row.prompt, stage.promptKeywords));
}

function stageStatus(score) {
  if (score >= 70) return { label: "强", className: "good" };
  if (score >= 45) return { label: "中", className: "medium" };
  return { label: "弱", className: "weak" };
}

function journeyTargetPrompts(demandCount) {
  if (demandCount >= 300) return 12;
  if (demandCount >= 150) return 10;
  if (demandCount >= 80) return 8;
  if (demandCount >= 40) return 6;
  if (demandCount >= 15) return 4;
  return 2;
}

function buildJourney(wildchat = {}, synthesis = {}, yuanbao = {}, intent = {}) {
  const archetypes = archetypeById(wildchat, synthesis);
  const rows = yuanbao.rows || [];
  return JOURNEY_STAGES.map((stage) => {
    const stageRows = rowsForStage(rows, stage);
    const demandCount = stage.archetypeIds.reduce((sum, id) => {
      const item = archetypes.get(id) || {};
      return sum + Number(item.observed_match_count || item.sample_count || 0);
    }, 0);
    const riskCount = stageRows.reduce((sum, row) => sum + (row.risk?.flags?.length || 0), 0);
    const officialGaps = stageRows.filter((row) => (row.references?.officialLikeCount || 0) === 0).length;
    const avgScore = stageRows.length ? Math.round(stageRows.reduce((sum, row) => sum + Number(row.scores?.total_score || 0), 0) / stageRows.length) : 0;
    const targetPrompts = journeyTargetPrompts(demandCount);
    const coverageDepth = targetPrompts ? Math.min(100, Math.round((stageRows.length / targetPrompts) * 100)) : 0;
    const coverageScore = Math.max(0, Math.min(100, Math.round(
      (coverageDepth * 0.55)
      + (avgScore ? avgScore * 0.35 : 0)
      - Math.min(10, officialGaps * 5)
      - Math.min(12, riskCount * 0.6)
    )));
    const status = stageStatus(coverageScore);
    return {
      ...stage,
      demandCount,
      monitoredPrompts: stageRows.length,
      targetPrompts,
      coverageDepth,
      avgGeoScore: avgScore,
      riskCount,
      officialGaps,
      coverageScore,
      statusLabel: status.label,
      statusClass: status.className,
      archetypes: stage.archetypeIds.map((id) => archetypes.get(id)).filter(Boolean).map((item) => item.label || item.id),
      relatedIntentCoverage: intent.byIntent || [],
    };
  });
}

function bar(value, label = "") {
  const width = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return `<div class="bar" aria-label="${escapeHtml(label)}"><span style="width:${width}%"></span></div>`;
}

function journeyCards(journey = []) {
  return journey.map((stage) => `
    <article class="journey-card ${escapeHtml(stage.statusClass)}">
      <div class="journey-head">
        <h3>${escapeHtml(stage.label)}</h3>
        <strong>${escapeHtml(stage.statusLabel)}</strong>
      </div>
      <p class="question">${escapeHtml(stage.userQuestion)}</p>
      ${bar(stage.coverageScore, stage.shortLabel)}
      <div class="journey-metrics">
        <span>真实问法 ${escapeHtml(stage.demandCount)}</span>
        <span>已测/目标 ${escapeHtml(stage.monitoredPrompts)}/${escapeHtml(stage.targetPrompts)}</span>
        <span>覆盖深度 ${escapeHtml(stage.coverageDepth)}%</span>
        <span>风险 ${escapeHtml(stage.riskCount)}</span>
      </div>
      <p class="gap">${escapeHtml(stage.currentGap)}</p>
    </article>`).join("");
}

function journeyRows(journey = []) {
  return journey.map((stage) => `
    <tr>
      <td>${escapeHtml(stage.shortLabel)}</td>
      <td>${escapeHtml(stage.archetypes.join("、"))}</td>
      <td>${escapeHtml(stage.demandCount)}</td>
      <td>${escapeHtml(stage.monitoredPrompts)}/${escapeHtml(stage.targetPrompts)}</td>
      <td>${num(stage.avgGeoScore)}</td>
      <td>${escapeHtml(stage.officialGaps)}</td>
      <td><span class="status ${escapeHtml(stage.statusClass)}">${escapeHtml(stage.statusLabel)}</span></td>
    </tr>`).join("");
}

function splitBar(label, targetShare, competitorShare) {
  return `
    <article class="split-card">
      <div class="split-head">
        <strong>${escapeHtml(label)}</strong>
        <span>美敦力 ${pct(targetShare)} / 竞品 ${pct(competitorShare)}</span>
      </div>
      <div class="split-bar" aria-label="${escapeHtml(label)}">
        <span style="width:${Math.max(0, Math.min(100, Number(targetShare) || 0))}%"></span>
        <i style="width:${Math.max(0, Math.min(100, Number(competitorShare) || 0))}%"></i>
      </div>
    </article>`;
}

function shareVisuals(summary) {
  const s = summary.snapshot || {};
  const comp = summary.competitive || {};
  return [
    splitBar("腾讯元宝回答声量", s.yuanbaoMedtronicAnswerShare, 100 - Number(s.yuanbaoMedtronicAnswerShare || 0)),
    splitBar("腾讯元宝引用声量", s.yuanbaoMedtronicSourceShare, 100 - Number(s.yuanbaoMedtronicSourceShare || 0)),
    splitBar("全矩阵回答声量", s.matrixMedtronicAnswerShare, comp.competitorAnswerShare),
    splitBar("全矩阵引用声量", s.matrixMedtronicSourceShare, comp.competitorSourceShare),
  ].join("");
}

function areaRiskCards(areas = []) {
  return areas.slice(0, 6).map((area) => {
    const riskScore = Math.max(0, Math.min(100,
      (Number(area.riskFlagCount || 0) * 12)
      + (Number(area.officialReferenceGaps || 0) * 14)
      + Math.max(0, 82 - Number(area.avgTotalScore || 0))
    ));
    return `
      <article class="risk-tile">
        <div>
          <strong>${escapeHtml(area.label)}</strong>
          <span>${escapeHtml(area.promptCount || 0)}题 · 风险${escapeHtml(area.riskFlagCount || 0)} · 官方缺口${escapeHtml(area.officialReferenceGaps || 0)}</span>
        </div>
        ${bar(riskScore, area.label)}
      </article>`;
  }).join("");
}

function findingCards(summary) {
  const s = summary.snapshot;
  const riskFlags = summary.yuanbao.aggregate?.riskSummary?.topFlags || [];
  const journey = summary.journey || [];
  const weakStages = journey.filter((stage) => stage.statusClass !== "good").map((stage) => stage.shortLabel).join("、");
  const topRisk = riskFlags[0]?.flag || "竞品引用证据穿透";
  const findings = [
    {
      title: "元宝可见度已进入可管理区间",
      value: num(s.yuanbaoTotalScore),
      text: `元宝总分 ${num(s.yuanbaoTotalScore)}，答案可见度 ${num(s.yuanbaoAnswerVisibility)}，说明品牌在回答中能被看见。`,
    },
    {
      title: "证据是当前主要分水岭",
      value: num(s.yuanbaoEvidenceInclusion),
      text: `证据纳入 ${num(s.yuanbaoEvidenceInclusion)}，但竞品引用份额仍有 ${pct(100 - s.yuanbaoMedtronicSourceShare)}。`,
    },
    {
      title: "旅程缺口集中在高影响节点",
      value: weakStages || "稳定",
      text: weakStages ? `意图库需要补强：${weakStages}。` : "核心旅程阶段均已有基础覆盖。",
    },
    {
      title: "最高频风险",
      value: `${riskFlags[0]?.count || 0}次`,
      text: topRisk,
    },
  ];
  return findings.map((item) => `
    <article class="finding">
      <span>${escapeHtml(item.title)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>`).join("");
}

function buildSummary() {
  const geo = readJson(PATHS.geoAnalysis, { aggregate: {} });
  const competitive = readJson(PATHS.competitive, { aggregate: {} });
  const intentPayload = readJson(PATHS.minimedIntent, { aggregate: {} });
  const yuanbao = readJson(PATHS.yuanbaoOptimization, { aggregate: {}, synthesis: {}, articleBriefs: [] });
  const wildchat = readJson(PATHS.wildchatPurchase, { summary: {}, topline_takeaways: [], archetypes: [] });
  const wildchatSynthesis = readJson(PATHS.wildchatSynthesis, { analysis: {} });
  const pr = readJson(PATHS.prDigest, {});
  const universe = readJson(PATHS.openSourceUniverse, {});

  const intent = intentPayload.aggregate || intentPayload;
  const compAgg = competitive.aggregate || competitive;
  const yuanbaoAgg = yuanbao.aggregate || {};
  const yScores = yuanbaoAgg.scoreSummary || geo.aggregate?.yuanbao || {};

  return {
    createdAt: new Date().toISOString(),
    links: {
      matrixDashboard: rel(PATHS.matrixDashboard),
      yuanbaoOptimizationDashboard: rel(PATHS.yuanbaoOptimizationDashboard),
      minimedDashboard: rel(PATHS.minimedDashboard),
      wildchatPurchaseDashboard: rel(PATHS.wildchatPurchaseDashboard),
      wildchatSynthesisDashboard: rel(PATHS.wildchatSynthesisDashboard),
      prDigestDashboard: rel(PATHS.prDigestDashboard),
      openSourceUniverseDashboard: rel(PATHS.openSourceUniverseDashboard),
    },
    snapshot: {
      yuanbaoTotalScore: yScores.total_score || 0,
      yuanbaoEvidenceInclusion: yScores.evidence_inclusion || 0,
      yuanbaoAnswerVisibility: yScores.answer_visibility || 0,
      yuanbaoRecommendationConversion: yScores.recommendation_conversion || 0,
      yuanbaoMedtronicAnswerShare: yuanbaoAgg.competitive?.medtronicAnswerShare || 0,
      yuanbaoMedtronicSourceShare: yuanbaoAgg.competitive?.medtronicSourceShare || 0,
      matrixMedtronicAnswerShare: compAgg.medtronic?.answerShare || 0,
      matrixMedtronicSourceShare: compAgg.medtronic?.sourceShare || 0,
      minimedCoverageScore: intent.coverageScore || 0,
      minimedPerformanceScore: intent.performanceScore || 0,
      wildchatMatchedTurns: wildchat.summary?.matched_user_turns || 0,
      prGuideDocuments: pr.document_count || 0,
      openSourceLayers: universe.capability_layers?.length || 0,
    },
    geo,
    competitive: compAgg,
    intent,
    yuanbao,
    wildchat,
    wildchatSynthesis: wildchatSynthesis.analysis || {},
    pr,
    universe,
    journey: buildJourney(wildchat, wildchatSynthesis.analysis || {}, yuanbao, intent),
  };
}

function buildHtml(summary) {
  const s = summary.snapshot;
  const y = summary.yuanbao;
  const yAgg = y.aggregate || {};
  const synthesis = y.synthesis || {};
  const comp = summary.competitive || {};
  const geoAgg = summary.geo.aggregate || {};
  const intent = summary.intent || {};
  const wildchat = summary.wildchat || {};
  const universe = summary.universe || {};
  const pr = summary.pr || {};
  const topActions = synthesis.priority_actions || [];
  const riskFlags = yAgg.riskSummary?.topFlags || [];
  const journey = summary.journey || [];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>美敦力 AI 品牌可见度看板</title>
  <style>
    :root {
      --bg:#f6f7f8;
      --panel:#fff;
      --ink:#172026;
      --muted:#64717d;
      --line:#dce2e7;
      --accent:#0f766e;
      --soft:#dff5f1;
      --warn:#b45309;
      --warn-soft:#fff4db;
      --risk:#b91c1c;
      --risk-soft:#fee2e2;
      --ok:#166534;
      --ok-soft:#dcfce7;
    }
    * { box-sizing:border-box; }
    html { max-width:100%; overflow-x:hidden; }
    body { margin:0; max-width:100%; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.55; overflow-x:hidden; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    header { background:#10201f; color:#fff; padding:34px 28px 30px; }
    .wrap { max-width:1200px; margin:0 auto; }
    h1 { margin:0 0 8px; font-size:30px; letter-spacing:0; }
    header p { margin:0; color:#c7d8d4; max-width:980px; }
    main { padding:24px 28px 48px; }
    section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; margin-bottom:18px; }
    h2 { margin:0 0 12px; font-size:20px; }
    h3 { margin:0 0 8px; font-size:16px; }
    p { margin:8px 0; }
    .meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
    .pill { display:inline-flex; align-items:center; min-height:28px; padding:0 10px; border:1px solid rgba(255,255,255,.22); border-radius:999px; color:#dbecea; font-size:12px; font-weight:800; }
    .stats { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; }
    .stat { border:1px solid var(--line); border-radius:8px; padding:13px; background:#fbfcfd; }
    .stat span { display:block; color:var(--muted); font-size:12px; font-weight:800; }
    .stat strong { display:block; margin-top:5px; font-size:24px; }
    .callout { border:1px solid #a7d8d1; background:var(--soft); border-radius:8px; padding:14px; }
    .finding-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:12px; }
    .finding { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fbfcfd; }
    .finding span { display:block; color:var(--muted); font-size:12px; font-weight:900; }
    .finding strong { display:block; margin-top:7px; font-size:22px; line-height:1.2; }
    .finding p { color:#33424c; font-size:13px; }
    .split-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:12px; }
    .split-card { border:1px solid var(--line); border-radius:8px; padding:13px; background:#fbfcfd; }
    .split-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; color:var(--muted); font-size:12px; font-weight:800; }
    .split-head strong { color:var(--ink); font-size:14px; }
    .split-bar { display:flex; height:12px; border-radius:999px; overflow:hidden; background:#e8edf1; margin-top:12px; }
    .split-bar span { display:block; height:100%; background:var(--accent); }
    .split-bar i { display:block; height:100%; background:#d97706; }
    .journey { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
    .journey-card { border:1px solid var(--line); border-radius:8px; padding:12px; background:#fbfcfd; min-height:190px; }
    .journey-card.good { border-color:#a7d8b3; background:#fbfffc; }
    .journey-card.medium { border-color:#f1c27d; background:#fffaf0; }
    .journey-card.weak { border-color:#f2aaa7; background:#fff7f7; }
    .journey-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
    .journey-head strong, .status { display:inline-flex; align-items:center; justify-content:center; min-width:28px; min-height:26px; padding:0 8px; border-radius:999px; font-size:12px; font-weight:900; }
    .journey-head strong.good, .status.good { background:var(--ok-soft); color:var(--ok); }
    .journey-head strong.medium, .status.medium { background:var(--warn-soft); color:var(--warn); }
    .journey-head strong.weak, .status.weak { background:var(--risk-soft); color:var(--risk); }
    .journey-card.good .journey-head strong { background:var(--ok-soft); color:var(--ok); }
    .journey-card.medium .journey-head strong { background:var(--warn-soft); color:var(--warn); }
    .journey-card.weak .journey-head strong { background:var(--risk-soft); color:var(--risk); }
    .question { min-height:44px; color:#33424c; font-size:13px; font-weight:700; }
    .gap { color:var(--muted); font-size:12px; }
    .bar { height:8px; border-radius:999px; background:#e8edf1; overflow:hidden; margin:10px 0; }
    .bar span { display:block; height:100%; border-radius:999px; background:var(--accent); }
    .journey-metrics { display:grid; gap:4px; color:var(--muted); font-size:12px; font-weight:800; }
    .risk-tiles { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
    .risk-tile { border:1px solid var(--line); border-radius:8px; background:#fbfcfd; padding:12px; }
    .risk-tile strong { display:block; }
    .risk-tile span { display:block; color:var(--muted); font-size:12px; font-weight:800; margin-top:3px; }
    .link-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .link-card { display:block; border:1px solid var(--line); border-radius:8px; padding:14px; background:#fbfcfd; color:var(--ink); min-height:140px; }
    .link-card span { display:inline-flex; min-height:24px; align-items:center; padding:0 8px; border-radius:999px; background:var(--soft); color:var(--accent); font-size:12px; font-weight:900; }
    .link-card strong { display:block; margin-top:10px; font-size:16px; }
    .link-card p { color:var(--muted); font-size:13px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .brief { border:1px solid var(--line); background:#fbfcfd; border-radius:8px; padding:14px; }
    .brief-meta { color:var(--muted); font-size:12px; margin-top:8px; }
    .table-wrap { max-width:100%; overflow-x:auto; }
    table { width:100%; border-collapse:collapse; min-width:860px; }
    th,td { border-bottom:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; font-size:13px; }
    th { background:#f1f4f6; color:#33424c; font-size:12px; }
    tr:last-child td { border-bottom:0; }
    ul { padding-left:20px; margin:8px 0; }
    li { margin:6px 0; }
    .priority { display:inline-flex; min-height:26px; align-items:center; padding:0 8px; border-radius:999px; font-size:12px; font-weight:900; }
    .p0 { color:var(--risk); background:var(--risk-soft); }
    .p1 { color:var(--warn); background:var(--warn-soft); }
    .p2 { color:var(--ok); background:var(--ok-soft); }
    code { background:#eef2f5; border:1px solid #dde5eb; border-radius:6px; padding:1px 5px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
    @media(max-width:1100px){ .journey,.finding-grid,.split-grid,.risk-tiles{grid-template-columns:repeat(2,minmax(0,1fr));} }
    @media(max-width:980px){ header,main{padding-left:16px;padding-right:16px;} .stats,.link-grid,.grid,.journey,.finding-grid,.split-grid,.risk-tiles{grid-template-columns:1fr;} h1{font-size:24px;} section{padding:14px;} }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>美敦力 AI 品牌可见度看板</h1>
      <p>从用户提问到 AI 推荐：追踪美敦力在腾讯元宝、DeepSeek 等 AI 回答中的可见度、证据质量、竞品声量和意图库覆盖。</p>
      <div class="meta">
        <span class="pill">生成时间 ${escapeHtml(new Date(summary.createdAt).toLocaleString("zh-CN", { hour12:false }))}</span>
        <span class="pill">目标品牌 Medtronic / 美敦力</span>
        <span class="pill">主视角 品牌部管理层</span>
      </div>
    </div>
  </header>
  <main>
    <div class="wrap">
      <section>
        <h2>管理层摘要</h2>
        <div class="callout">${escapeHtml("腾讯元宝侧美敦力已具备较高可见度，但 AI 证据链仍会被竞品高权重来源穿透；用户旅程中的需求定义、方案比较、价格可及，是意图库当前最需要补足的观察盲区。")}</div>
        <div class="stats" style="margin-top:12px">
          <div class="stat"><span>元宝GEO总分</span><strong>${num(s.yuanbaoTotalScore)}</strong></div>
          <div class="stat"><span>元宝证据纳入</span><strong>${num(s.yuanbaoEvidenceInclusion)}</strong></div>
          <div class="stat"><span>元宝回答SOV</span><strong>${pct(s.yuanbaoMedtronicAnswerShare)}</strong></div>
          <div class="stat"><span>元宝引用SOV</span><strong>${pct(s.yuanbaoMedtronicSourceShare)}</strong></div>
          <div class="stat"><span>MiniMed覆盖</span><strong>${num(s.minimedCoverageScore)}</strong></div>
          <div class="stat"><span>WildChat匹配问法</span><strong>${escapeHtml(s.wildchatMatchedTurns)}</strong></div>
        </div>
        <div class="finding-grid">${findingCards(summary)}</div>
        <div class="split-grid">${shareVisuals(summary)}</div>
      </section>

      <section>
        <h2>用户旅程 × 意图库缺口</h2>
        <div class="journey">${journeyCards(journey)}</div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>旅程阶段</th><th>对应真实意图范式</th><th>WildChat需求信号</th><th>已测/目标</th><th>平均GEO</th><th>官方引用缺口</th><th>覆盖状态</th></tr></thead>
            <tbody>${journeyRows(journey)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>GEO 四项核心指标</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>平台</th><th>样本数</th><th>答案可见度</th><th>认知准确度</th><th>证据纳入度</th><th>推荐转化力</th><th>总分</th></tr></thead>
            <tbody>${scoreRows(geoAgg)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>品牌风险雷达</h2>
        <div class="risk-tiles">${areaRiskCards(yAgg.byArea || [])}</div>
        <div class="grid">
          <div>
            <h3>产品线缺口</h3>
            <div class="table-wrap">
              <table>
                <thead><tr><th>产品线</th><th>问题数</th><th>GEO均分</th><th>官方引用缺口</th><th>风险标记</th></tr></thead>
                <tbody>${(yAgg.byArea || []).map((area) => `
                  <tr>
                    <td>${escapeHtml(area.label)}</td>
                    <td>${escapeHtml(area.promptCount || 0)}</td>
                    <td>${num(area.avgTotalScore)}</td>
                    <td>${escapeHtml(area.officialReferenceGaps || 0)}</td>
                    <td>${escapeHtml(area.riskFlagCount || 0)}</td>
                  </tr>`).join("")}</tbody>
              </table>
            </div>
          </div>
          <div>
            <h3>高频风险信号</h3>
            <ul>${list(riskFlags.slice(0, 8), (item) => `${item.flag}（${item.count}）`)}</ul>
          </div>
        </div>
      </section>

      <section>
        <h2>竞品与引用来源</h2>
        <div class="stats">
          <div class="stat"><span>全矩阵美敦力回答SOV</span><strong>${pct(s.matrixMedtronicAnswerShare)}</strong></div>
          <div class="stat"><span>全矩阵竞品回答SOV</span><strong>${pct(comp.competitorAnswerShare)}</strong></div>
          <div class="stat"><span>全矩阵美敦力引用SOV</span><strong>${pct(s.matrixMedtronicSourceShare)}</strong></div>
          <div class="stat"><span>全矩阵竞品引用SOV</span><strong>${pct(comp.competitorSourceShare)}</strong></div>
          <div class="stat"><span>美敦力官方源</span><strong>${escapeHtml(comp.medtronic?.officialSourceCount || 0)}</strong></div>
          <div class="stat"><span>竞品高权重源</span><strong>${escapeHtml(yAgg.competitive?.topCompetitorSources?.length || 0)}</strong></div>
        </div>
        <h3 style="margin-top:16px">品牌 / 竞品排行</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>品牌</th><th>类型</th><th>回答提及</th><th>回答份额</th><th>引用权重</th><th>引用份额</th><th>官方来源</th></tr></thead>
            <tbody>${brandRows(comp.brands)}</tbody>
          </table>
        </div>
        <h3 style="margin-top:16px">元宝高权重竞品来源</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>来源</th><th>标题</th><th>类型</th><th>权重</th><th>关联品牌</th></tr></thead>
            <tbody>${sourceRows(yAgg.competitive?.topCompetitorSources)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>MiniMed 意图覆盖</h2>
        <div class="stats">
          <div class="stat"><span>问题数</span><strong>${escapeHtml(intent.promptCount || 0)}</strong></div>
          <div class="stat"><span>成功率</span><strong>${pct(intent.okRate)}</strong></div>
          <div class="stat"><span>覆盖分</span><strong>${num(intent.coverageScore)}</strong></div>
          <div class="stat"><span>Performance</span><strong>${num(intent.performanceScore)}</strong></div>
          <div class="stat"><span>平均引用</span><strong>${num(intent.avgReferences)}</strong></div>
          <div class="stat"><span>缺口项</span><strong>${escapeHtml((intent.topMissingCriteria || []).length)}</strong></div>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>竞品</th><th>类别</th><th>覆盖分</th><th>Performance</th><th>平均引用</th><th>缺口</th></tr></thead>
            <tbody>${(intent.byCompetitor || []).map((item) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(item.category)}</td>
                <td>${num(item.coverageScore)}</td>
                <td>${num(item.performanceScore)}</td>
                <td>${num(item.avgReferences)}</td>
                <td>${escapeHtml((item.missingCriteria || []).map((gap) => `${gap.label}(${gap.count})`).join("、") || "无")}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>真实用户意图：WildChat</h2>
        <div class="callout">${escapeHtml((wildchat.topline_takeaways || [])[0] || "购买意图是一条从需求定义到售后的决策链。")}</div>
        <div class="stats" style="margin-top:12px">
          <div class="stat"><span>扫描对话</span><strong>${escapeHtml(wildchat.summary?.scanned_conversations || 0)}</strong></div>
          <div class="stat"><span>用户轮次</span><strong>${escapeHtml(wildchat.summary?.scanned_user_turns || 0)}</strong></div>
          <div class="stat"><span>匹配问法</span><strong>${escapeHtml(wildchat.summary?.matched_user_turns || 0)}</strong></div>
          <div class="stat"><span>样本数</span><strong>${escapeHtml(wildchat.summary?.sample_count || 0)}</strong></div>
          <div class="stat"><span>范式数</span><strong>${escapeHtml(wildchat.summary?.archetype_count || 0)}</strong></div>
          <div class="stat"><span>医疗健康样本</span><strong>${escapeHtml(wildchat.summary?.domain_counts?.["医疗健康"] || 0)}</strong></div>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>范式</th><th>阶段</th><th>用户问法</th><th>GEO风险 / 真实需求</th></tr></thead>
            <tbody>${archetypeRows(summary.wildchatSynthesis.archetypes || wildchat.archetypes)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>公关写作规则</h2>
        <div class="grid">
          <div>
            <h3>医疗合规守卫</h3>
            <ul>${list(pr.medical_compliance_rules)}</ul>
          </div>
          <div>
            <h3>GEO写作规则</h3>
            <ul>${list(pr.geo_writing_rules, (item) => `${item.label}：${item.rule}`)}</ul>
            <p>资料索引：${escapeHtml(pr.document_count || 0)} 个本地文件。原始 PDF/PPTX 不提交，只保留摘要规则。</p>
          </div>
        </div>
      </section>

      <section>
        <h2>方法与数据资产</h2>
        <div class="link-grid">
          ${card("腾讯元宝 · 美敦力技术改造", "元宝侧逐题诊断、产品线风险和证据信号。", PATHS.yuanbaoOptimizationDashboard, "平台")}
          ${card("DeepSeek / 元宝问题矩阵", "16 个问题逐题回答、截图、引用、GEO 四项指标、竞品分析。", PATHS.matrixDashboard, "监测")}
          ${card("MiniMed 竞品意图实验", "Tandem、Omnipod、Dexcom、Abbott 的覆盖和 performance。", PATHS.minimedDashboard, "意图")}
          ${card("WildChat 购买意图范式", "从真实用户问法抽取购买、对比、风险、渠道、售后范式。", PATHS.wildchatPurchaseDashboard, "问法")}
          ${card("公关稿件指南 Digest", "医疗传播禁用/慎用、事实优先、风险口径、AI 人工复核。", PATHS.prDigestDashboard, "规则")}
          ${card("开源 GEO 功能宇宙", "GEO/AEO/LLMO/llms.txt 开源项目能力矩阵。", PATHS.openSourceUniverseDashboard, "能力")}
        </div>
      </section>

      <section>
        <h2>能力建设缺口</h2>
        <div class="grid">
          <div>
            <h3>当前主要缺口</h3>
            <ul>${list((universe.major_gaps || []).slice(0, 8))}</ul>
          </div>
          <div>
            <h3>本系统已形成的强项</h3>
            <ul>${list(universe.local_system_strengths || [])}</ul>
          </div>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>层</th><th>能力</th><th>当前覆盖</th><th>代表项目</th><th>融合建议</th></tr></thead>
            <tbody>${capabilityRows(universe.capability_layers || [])}</tbody>
          </table>
        </div>
      </section>

    </div>
  </main>
</body>
</html>`;
}

function compactJourneySummary(journey = []) {
  return journey.map((stage) => ({
    id: stage.id,
    label: stage.label,
    demandCount: stage.demandCount,
    monitoredPrompts: stage.monitoredPrompts,
    targetPrompts: stage.targetPrompts,
    coverageDepth: stage.coverageDepth,
    avgGeoScore: stage.avgGeoScore,
    riskCount: stage.riskCount,
    officialGaps: stage.officialGaps,
    coverageScore: stage.coverageScore,
    status: stage.statusLabel,
    currentGap: stage.currentGap,
  }));
}

function main() {
  const summary = buildSummary();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeJson(OUT_JSON, {
    createdAt: summary.createdAt,
    links: summary.links,
    snapshot: summary.snapshot,
    journey: compactJourneySummary(summary.journey),
    yuanbaoActions: summary.yuanbao.synthesis?.priority_actions || [],
    yuanbaoRiskFlags: summary.yuanbao.aggregate?.riskSummary?.topFlags || [],
    openSourceGaps: summary.universe.major_gaps || [],
  });
  fs.writeFileSync(OUT_FILE, buildHtml(summary).replace(/[ \t]+$/gm, ""), { mode: 0o600 });
  console.log(`unified_dashboard_saved ${OUT_FILE}`);
  console.log(JSON.stringify(summary.snapshot, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}
