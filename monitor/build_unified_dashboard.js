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

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>美敦力 GEO 融合总 Dashboard</title>
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
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.55; }
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
    .link-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .link-card { display:block; border:1px solid var(--line); border-radius:8px; padding:14px; background:#fbfcfd; color:var(--ink); min-height:140px; }
    .link-card span { display:inline-flex; min-height:24px; align-items:center; padding:0 8px; border-radius:999px; background:var(--soft); color:var(--accent); font-size:12px; font-weight:900; }
    .link-card strong { display:block; margin-top:10px; font-size:16px; }
    .link-card p { color:var(--muted); font-size:13px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .brief { border:1px solid var(--line); background:#fbfcfd; border-radius:8px; padding:14px; }
    .brief-meta { color:var(--muted); font-size:12px; margin-top:8px; }
    .table-wrap { overflow-x:auto; }
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
    @media(max-width:980px){ header,main{padding-left:16px;padding-right:16px;} .stats,.link-grid,.grid{grid-template-columns:1fr;} h1{font-size:24px;} section{padding:14px;} }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>美敦力 GEO 融合总 Dashboard</h1>
      <p>统一入口：AI 平台监测、腾讯元宝技术改造、竞品引用、MiniMed 意图覆盖、WildChat 真实问法、公关写作规则和开源功能宇宙。</p>
      <div class="meta">
        <span class="pill">生成时间 ${escapeHtml(new Date(summary.createdAt).toLocaleString("zh-CN", { hour12:false }))}</span>
        <span class="pill">目标品牌 Medtronic / 美敦力</span>
        <span class="pill">重点平台 腾讯元宝</span>
      </div>
    </div>
  </header>
  <main>
    <div class="wrap">
      <section>
        <h2>总览</h2>
        <div class="callout">${escapeHtml(synthesis.executive_takeaway || "元宝侧可见度和推荐倾向已经可用，下一步重点是把监测缺口转成官方可引用资产和稳定回归监测。")}</div>
        <div class="stats" style="margin-top:12px">
          <div class="stat"><span>元宝GEO总分</span><strong>${num(s.yuanbaoTotalScore)}</strong></div>
          <div class="stat"><span>元宝证据纳入</span><strong>${num(s.yuanbaoEvidenceInclusion)}</strong></div>
          <div class="stat"><span>元宝回答SOV</span><strong>${pct(s.yuanbaoMedtronicAnswerShare)}</strong></div>
          <div class="stat"><span>元宝引用SOV</span><strong>${pct(s.yuanbaoMedtronicSourceShare)}</strong></div>
          <div class="stat"><span>MiniMed覆盖</span><strong>${num(s.minimedCoverageScore)}</strong></div>
          <div class="stat"><span>WildChat匹配问法</span><strong>${escapeHtml(s.wildchatMatchedTurns)}</strong></div>
        </div>
      </section>

      <section>
        <h2>分项 Dashboard 入口</h2>
        <div class="link-grid">
          ${card("腾讯元宝 · 美敦力技术改造", "补源清单、产品线风险、稿件 brief、下一轮监测 prompt。", PATHS.yuanbaoOptimizationDashboard, "优先看")}
          ${card("DeepSeek / 元宝问题矩阵", "16 个问题逐题回答、截图、引用、GEO 四项指标、竞品分析。", PATHS.matrixDashboard, "监测")}
          ${card("MiniMed 竞品意图实验", "Tandem、Omnipod、Dexcom、Abbott 各 2 个问题的覆盖和 performance。", PATHS.minimedDashboard, "意图")}
          ${card("WildChat 购买意图范式", "从真实用户问法抽取购买、对比、风险、渠道、售后范式。", PATHS.wildchatPurchaseDashboard, "数据源")}
          ${card("DeepSeek 意图归纳", "用 DeepSeek 对 WildChat 候选样本做噪音剔除和范式映射。", PATHS.wildchatSynthesisDashboard, "LLM分析")}
          ${card("公关稿件指南 Digest", "医疗传播禁用/慎用、事实优先、风险口径、AI 人工复核。", PATHS.prDigestDashboard, "写作")}
          ${card("开源 GEO 功能宇宙", "GEO/AEO/LLMO/llms.txt 开源项目能力矩阵和缺口路线图。", PATHS.openSourceUniverseDashboard, "战略")}
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
        <h2>腾讯元宝技术改造重点</h2>
        <div class="grid">
          <div>
            <h3>优先动作</h3>
            <div class="table-wrap">
              <table>
                <thead><tr><th>优先级</th><th>动作</th><th>原因</th><th>产物</th></tr></thead>
                <tbody>${actionRows(topActions)}</tbody>
              </table>
            </div>
          </div>
          <div>
            <h3>高频风险</h3>
            <ul>${list(riskFlags.slice(0, 8), (item) => `${item.flag}（${item.count}）`)}</ul>
          </div>
        </div>
      </section>

      <section>
        <h2>产品线缺口</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>产品线</th><th>问题数</th><th>GEO均分</th><th>官方引用缺口</th><th>风险标记</th><th>P0动作</th></tr></thead>
            <tbody>${areaRows(yAgg.byArea)}</tbody>
          </table>
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
        <h2>稿件 / 资产 Brief</h2>
        <div class="grid">${briefCards(y.articleBriefs || [])}</div>
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
        <h2>开源功能宇宙与缺口</h2>
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

      <section>
        <h2>运行方式</h2>
        <p>更新各分项后重新生成总入口：</p>
        <p><code>npm run dashboard:unified</code></p>
        <p>如需刷新元宝技术改造：</p>
        <p><code>npm run digest:pr</code> 和 <code>GEO_OPTIMIZER_USE_LLM=1 DEEPSEEK_API_KEY=... npm run optimize:yuanbao</code></p>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function main() {
  const summary = buildSummary();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeJson(OUT_JSON, {
    createdAt: summary.createdAt,
    links: summary.links,
    snapshot: summary.snapshot,
    yuanbaoActions: summary.yuanbao.synthesis?.priority_actions || [],
    yuanbaoRiskFlags: summary.yuanbao.aggregate?.riskSummary?.topFlags || [],
    openSourceGaps: summary.universe.major_gaps || [],
  });
  fs.writeFileSync(OUT_FILE, buildHtml(summary), { mode: 0o600 });
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
