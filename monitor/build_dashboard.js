#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { analyzeCompetitiveAnswer, aggregateCompetitive } = require("./competitive_geo");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUN_DIR = path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix");
const RUN_DIR = path.resolve(process.argv[2] || process.env.GEO_DASHBOARD_RUN_DIR || DEFAULT_RUN_DIR);
const OUT_FILE = path.join(RUN_DIR, "dashboard.html");
const COMPETITIVE_OUT_FILE = path.join(RUN_DIR, "competitive_geo_summary.json");

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(from, to) {
  return path.relative(from, to).split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function excerpt(text, max = 900) {
  const compact = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trim()}...`;
}

function classify(prompt) {
  if (/心律|心衰|远程监测|起搏器|ICD|CRT|Reveal LINQ/.test(prompt)) return "心律/心衰";
  if (/TAVR|瓣膜|结构性心脏|Evolut|肺动脉瓣/.test(prompt)) return "结构心";
  if (/能量|吻合|缝合|疝|LigaSure|Valleylab|Tri-Staple|Hugo|机器人/.test(prompt)) return "医疗外科";
  if (/糖尿病|胰岛素|CGM|MiniMed|Simplera/.test(prompt)) return "糖尿病";
  if (/渠道|合作|培训|服务|经销商|召回|负面/.test(prompt)) return "渠道/风险";
  return "其他";
}

function statusLabel(status) {
  return status === "ok" ? "OK" : status;
}

function metric(items, fn) {
  return items.reduce((sum, item) => sum + Number(fn(item) || 0), 0);
}

function avg(items, fn) {
  return items.length ? Math.round(metric(items, fn) / items.length) : 0;
}

function platformName(id) {
  return id === "yuanbao" ? "腾讯元宝" : id === "deepseek" ? "DeepSeek" : id;
}

function platformClass(id) {
  return id === "yuanbao" ? "yuanbao" : "deepseek";
}

function scoreBar(label, value) {
  const score = Number(value || 0);
  return `
    <div class="score-row">
      <span>${escapeHtml(label)}</span>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, score))}%"></i></div>
      <strong>${escapeHtml(score)}</strong>
    </div>
  `;
}

function shortList(items, emptyText = "无") {
  const values = (items || []).filter(Boolean).slice(0, 5);
  if (!values.length) return `<li>${escapeHtml(emptyText)}</li>`;
  return values.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function compactBrandName(name) {
  return String(name || "").replace(/\s*\/\s*/g, " / ");
}

function percentBar(label, value, tone = "") {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  return `
    <div class="score-row ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <div class="bar"><i style="width:${score}%"></i></div>
      <strong>${score}%</strong>
    </div>
  `;
}

function brandRankList(items, field, suffix = "") {
  const rows = (items || []).filter((item) => Number(item[field] || 0) > 0).slice(0, 5);
  if (!rows.length) return `<li>暂无明显品牌信号</li>`;
  return rows.map((item) => `
    <li>
      <span>${escapeHtml(compactBrandName(item.name))}</span>
      <strong>${escapeHtml(item[field])}${escapeHtml(suffix)}</strong>
    </li>
  `).join("");
}

function sourceList(items) {
  const rows = (items || []).slice(0, 5);
  if (!rows.length) return `<li>暂无高权重竞品来源</li>`;
  return rows.map((item) => {
    const brands = (item.brands || []).map((brand) => brand.name).join(" / ");
    return `
      <li>
        <span>${escapeHtml(item.source || "未知来源")} · ${escapeHtml(item.authority?.label || "-")} ${escapeHtml(item.authority?.score || 0)}</span>
        <strong>${escapeHtml(item.title || brands || "未命名来源")}</strong>
      </li>
    `;
  }).join("");
}

function competitiveCell(row) {
  if (!row?.competitive) return "-";
  const comp = row.competitive;
  const mentionTotal = (comp.medtronic?.answerMentions || 0) + (comp.competitorMentionTotal || 0);
  const sourceTotal = (comp.medtronic?.sourceWeight || 0) + (comp.competitorSourceWeight || 0);
  const compAnswerShare = mentionTotal ? Math.round((comp.competitorMentionTotal / mentionTotal) * 100) : 0;
  const compSourceShare = sourceTotal ? Math.round((comp.competitorSourceWeight / sourceTotal) * 100) : 0;
  const risk = comp.risks.length ? " ⚠" : "";
  return `${compAnswerShare}% / ${compSourceShare}%${risk}`;
}

function build() {
  const summaryPath = path.join(RUN_DIR, "summary.json");
  const summary = readJson(summaryPath);
  if (!summary?.summary?.length) throw new Error(`No summary found: ${summaryPath}`);
  const geoAnalysis = readJson(path.join(RUN_DIR, "geo_analysis_summary.json"), { results: [], aggregate: {} });
  const analysisByKey = new Map((geoAnalysis.results || []).map((item) => [`${item.question_id}:${item.platform}`, item]));

  const grouped = new Map();
  for (const row of summary.summary) {
    if (!grouped.has(row.questionId)) grouped.set(row.questionId, { questionId: row.questionId, prompt: row.prompt, rows: {} });
    grouped.get(row.questionId).rows[row.platform] = row;
  }

  const questions = Array.from(grouped.values()).sort((a, b) => a.questionId.localeCompare(b.questionId));
  for (const question of questions) {
    question.category = classify(question.prompt);
    for (const platform of ["deepseek", "yuanbao"]) {
      const row = question.rows[platform];
      if (!row) continue;
      const qDir = path.join(RUN_DIR, question.questionId);
      row.txtPath = path.join(qDir, `${platform}.txt`);
      row.htmlPath = path.join(qDir, `${platform}.html`);
      row.pngPath = path.join(qDir, `${platform}.png`);
      row.referencesPath = path.join(qDir, `${platform}_references.txt`);
      row.referencesJsonPath = path.join(qDir, `${platform}_references.json`);
      row.answer = stripUiText(readText(row.txtPath), question.prompt);
      row.answerExcerpt = excerpt(row.answer);
      row.references = readJson(row.referencesJsonPath, {});
      row.geoAnalysis = analysisByKey.get(`${question.questionId}:${platform}`);
      row.competitive = analyzeCompetitiveAnswer({
        questionId: question.questionId,
        platform,
        prompt: question.prompt,
        answer: row.answer,
        references: row.references,
      });
    }
  }

  const rows = summary.summary;
  const yuanbaoRows = rows.filter((row) => row.platform === "yuanbao");
  const deepseekRows = rows.filter((row) => row.platform === "deepseek");
  const categories = Array.from(new Set(questions.map((question) => question.category)));
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const aggregate = geoAnalysis.aggregate || {};
  const deepseekAggregate = aggregate.deepseek || {};
  const yuanbaoAggregate = aggregate.yuanbao || {};
  const competitiveResults = questions.flatMap((question) => (
    ["deepseek", "yuanbao"].map((platform) => question.rows[platform]?.competitive).filter(Boolean)
  ));
  const competitiveAggregate = aggregateCompetitive(competitiveResults);
  fs.writeFileSync(COMPETITIVE_OUT_FILE, JSON.stringify({
    createdAt: new Date().toISOString(),
    runDir: RUN_DIR,
    aggregate: competitiveAggregate,
    results: competitiveResults,
  }, null, 2), { mode: 0o600 });

  const categoryTabs = categories.map((category) => (
    `<button class="seg" data-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");

  const questionNav = questions.map((question) => `
    <a class="nav-item" href="#${question.questionId}" data-category="${escapeHtml(question.category)}">
      <span>${escapeHtml(question.questionId.toUpperCase())}</span>
      <strong>${escapeHtml(question.prompt)}</strong>
    </a>
  `).join("");

  const tableRows = questions.map((question) => {
    const deepseek = question.rows.deepseek;
    const yuanbao = question.rows.yuanbao;
    return `
      <tr data-category="${escapeHtml(question.category)}">
        <td><a href="#${question.questionId}">${escapeHtml(question.questionId.toUpperCase())}</a></td>
        <td>${escapeHtml(question.category)}</td>
        <td>${escapeHtml(question.prompt)}</td>
        <td><span class="status">${escapeHtml(statusLabel(deepseek?.status || "-"))}</span></td>
        <td>${escapeHtml(deepseek?.textLength || 0)}</td>
        <td>${escapeHtml(deepseek?.referenceLinkCount || 0)}</td>
        <td>${escapeHtml(deepseek?.geoAnalysis?.scores?.total_score ?? "-")}</td>
        <td>${escapeHtml(competitiveCell(deepseek))}</td>
        <td><span class="status">${escapeHtml(statusLabel(yuanbao?.status || "-"))}</span></td>
        <td>${escapeHtml(yuanbao?.textLength || 0)}</td>
        <td>${escapeHtml(yuanbao?.referenceItemCount || 0)}</td>
        <td>${escapeHtml(yuanbao?.citationMarkerCount || 0)}</td>
        <td>${escapeHtml(yuanbao?.geoAnalysis?.scores?.total_score ?? "-")}</td>
        <td>${escapeHtml(competitiveCell(yuanbao))}</td>
      </tr>
    `;
  }).join("");

  const competitiveBrandRows = competitiveAggregate.brands.slice(0, 12).map((brand) => `
    <tr>
      <td>${escapeHtml(compactBrandName(brand.name))}</td>
      <td>${escapeHtml(brand.role === "target" ? "目标品牌" : "竞品")}</td>
      <td>${escapeHtml(brand.answerMentions)}</td>
      <td>${escapeHtml(brand.answerShare)}%</td>
      <td>${escapeHtml(brand.sourceWeight)}</td>
      <td>${escapeHtml(brand.sourceShare)}%</td>
      <td>${escapeHtml(brand.officialSourceCount)}</td>
      <td>${escapeHtml(brand.highAuthoritySourceCount)}</td>
    </tr>
  `).join("");

  const competitivePlatformCards = Object.values(competitiveAggregate.byPlatform || {}).map((item) => `
    <div class="competitive-platform">
      <h3>${escapeHtml(platformName(item.platform))}</h3>
      ${percentBar("美敦力回答SOV", item.medtronicAnswerShare, item.platform)}
      ${percentBar("竞品回答SOV", item.competitorAnswerShare, "competitor")}
      ${percentBar("美敦力证据份额", item.medtronicSourceShare, item.platform)}
      ${percentBar("竞品证据份额", item.competitorSourceShare, "competitor")}
      <p>${escapeHtml(item.riskCount)} / ${escapeHtml(item.sampleCount)} 条回答存在竞品压制或证据偏置风险。</p>
    </div>
  `).join("");

  const cards = questions.map((question) => {
    const deepseek = question.rows.deepseek;
    const yuanbao = question.rows.yuanbao;
    const platformPanel = (row, platform) => {
      if (!row) return "";
      const refs = row.references?.referenceItems || [];
      const analysis = row.geoAnalysis;
      const competitive = row.competitive;
      const competitiveBlock = competitive ? `
        <div class="competitive-analysis">
          <div class="analysis-head">
            <h4>竞品 GEO 扫描</h4>
            <strong>${escapeHtml(competitive.risks.length ? `${competitive.risks.length} 风险` : "OK")}</strong>
          </div>
          <div class="competitive-cols">
            <div>
              <h5>回答可见度</h5>
              <ol>${brandRankList(competitive.answerRanking, "answerMentions", "次")}</ol>
            </div>
            <div>
              <h5>引用证据权重</h5>
              <ol>${brandRankList(competitive.sourceRanking, "sourceWeight", "")}</ol>
            </div>
          </div>
          <div class="analysis-tags">
            <span>美敦力提及：${escapeHtml(competitive.medtronic?.answerMentions || 0)}</span>
            <span>竞品提及：${escapeHtml(competitive.competitorMentionTotal || 0)}</span>
            <span>美敦力证据：${escapeHtml(competitive.medtronic?.sourceWeight || 0)}</span>
            <span>竞品证据：${escapeHtml(competitive.competitorSourceWeight || 0)}</span>
          </div>
          ${competitive.risks.length ? `<ul class="risk-list">${competitive.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>` : ""}
          <details>
            <summary>高权重竞品来源</summary>
            <ol class="source-compact">${sourceList(competitive.highWeightCompetitorSources)}</ol>
          </details>
        </div>
      ` : "";
      const topRefs = refs.slice(0, 8).map((item) => `
        <li>
          <span>${escapeHtml(item.source || "未知来源")}</span>
          <strong>${escapeHtml(item.title || item.snippet || "未命名来源")}</strong>
        </li>
      `).join("");
      const analysisBlock = analysis ? `
        <div class="geo-analysis">
          <div class="analysis-head">
            <h4>品牌化 GEO 诊断</h4>
            <strong>${escapeHtml(analysis.scores?.total_score ?? "-")}</strong>
          </div>
          <div class="score-grid">
            ${scoreBar("答案可见度", analysis.scores?.answer_visibility)}
            ${scoreBar("认知准确度", analysis.scores?.cognitive_accuracy)}
            ${scoreBar("证据纳入度", analysis.scores?.evidence_inclusion)}
            ${scoreBar("推荐转化力", analysis.scores?.recommendation_conversion)}
          </div>
          <p class="takeaway">${escapeHtml(analysis.dashboard_takeaway || analysis.summary || "")}</p>
          <div class="analysis-tags">
            <span>立场：${escapeHtml(analysis.sentiment_and_trust?.stance || "-")}</span>
            <span>证据噪音：${escapeHtml(analysis.evidence?.source_noise_level ?? "-")}</span>
            <span>${analysis.sentiment_and_trust?.balanced_evaluation ? "评价中肯" : "评价需复核"}</span>
            <span>${analysis.sentiment_and_trust?.detracts_customer ? "有劝退风险" : "无明显劝退"}</span>
          </div>
          <details>
            <summary>关键诊断</summary>
            <div class="analysis-detail">
              <div>
                <h5>品牌资产</h5>
                <ul>${shortList(analysis.brand_asset_understanding?.correct_assets, "未识别")}</ul>
              </div>
              <div>
                <h5>错误/混淆</h5>
                <ul>${shortList(analysis.brand_asset_understanding?.confusions_or_errors, "未发现明显问题")}</ul>
              </div>
              <div>
                <h5>风险表达</h5>
                <ul>${shortList(analysis.sentiment_and_trust?.negative_or_risk_claims, "无")}</ul>
              </div>
              <div>
                <h5>优化动作</h5>
                <ul>${shortList(analysis.improvement_actions, "暂无")}</ul>
              </div>
            </div>
          </details>
        </div>
      ` : `<div class="geo-analysis muted-box">尚未生成逐回答 GEO 分析。运行 <code>npm run analyze:geo</code> 后重新生成 dashboard。</div>`;
      return `
        <section class="platform ${platformClass(platform)}">
          <div class="platform-head">
            <div>
              <span class="platform-name">${platformName(platform)}</span>
              <h3>${escapeHtml(row.waitResult?.state?.title || row.name || platformName(platform))}</h3>
            </div>
            <div class="badges">
              <span class="status">${escapeHtml(statusLabel(row.status))}</span>
              <span>${escapeHtml(row.textLength || 0)} 字</span>
              ${platform === "yuanbao" ? `<span>${escapeHtml(row.referenceItemCount || 0)} 来源</span>` : `<span>${escapeHtml(row.referenceLinkCount || 0)} 链接</span>`}
            </div>
          </div>
          ${analysisBlock}
          ${competitiveBlock}
          <p class="answer">${escapeHtml(row.answerExcerpt)}</p>
          ${topRefs ? `<div class="refs"><h4>引用来源</h4><ol>${topRefs}</ol></div>` : ""}
          <div class="evidence">
            <a href="${escapeHtml(rel(RUN_DIR, row.txtPath))}">文本</a>
            <a href="${escapeHtml(rel(RUN_DIR, row.htmlPath))}">HTML</a>
            <a href="${escapeHtml(rel(RUN_DIR, row.pngPath))}">截图</a>
            <a href="${escapeHtml(rel(RUN_DIR, row.referencesPath))}">引用</a>
            <a href="${escapeHtml(row.url)}">原对话</a>
          </div>
        </section>
      `;
    };

    return `
      <article class="q-card" id="${question.questionId}" data-category="${escapeHtml(question.category)}">
        <div class="q-head">
          <div>
            <span class="qid">${escapeHtml(question.questionId.toUpperCase())}</span>
            <h2>${escapeHtml(question.prompt)}</h2>
          </div>
          <span class="category">${escapeHtml(question.category)}</span>
        </div>
        <div class="compare">
          ${platformPanel(deepseek, "deepseek")}
          ${platformPanel(yuanbao, "yuanbao")}
        </div>
      </article>
    `;
  }).join("");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>美敦力 GEO 监测 Dashboard - DeepSeek vs 腾讯元宝</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #172033;
      --muted: #667085;
      --line: #d8dee8;
      --deepseek: #2b6fcb;
      --yuanbao: #0f8f74;
      --accent: #b84c3d;
      --soft: #eef2f7;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--ink); background: var(--bg); }
    a { color: inherit; text-decoration: none; }
    .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }
    aside { position: sticky; top: 0; height: 100vh; overflow: auto; border-right: 1px solid var(--line); background: #fff; padding: 20px 16px; }
    main { padding: 24px; max-width: 1500px; width: 100%; }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
    .mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: var(--ink); color: white; font-weight: 800; }
    .brand h1 { font-size: 16px; margin: 0; line-height: 1.25; }
    .brand p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
    .nav-item { display: grid; grid-template-columns: 44px 1fr; gap: 8px; padding: 10px 8px; border-radius: 8px; margin-bottom: 4px; border: 1px solid transparent; }
    .nav-item:hover { background: var(--soft); border-color: var(--line); }
    .nav-item span { font-size: 12px; color: var(--muted); font-weight: 700; }
    .nav-item strong { font-size: 12px; line-height: 1.35; font-weight: 600; }
    .hero { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin-bottom: 18px; }
    .hero h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    .hero p { margin: 0; color: var(--muted); line-height: 1.6; }
    .stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .stat { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .stat span { color: var(--muted); font-size: 12px; }
    .stat strong { display: block; font-size: 24px; margin-top: 6px; }
    .geo-overview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .overview-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .overview-card h2 { margin: 0 0 8px; font-size: 16px; }
    .overview-card > strong { display: block; font-size: 34px; margin-bottom: 10px; }
    .score-row { display: grid; grid-template-columns: 84px minmax(80px, 1fr) 34px; gap: 8px; align-items: center; min-height: 24px; font-size: 12px; }
    .bar { height: 8px; background: var(--soft); border-radius: 999px; overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
    .deepseek .bar i { background: var(--deepseek); }
    .yuanbao .bar i { background: var(--yuanbao); }
    .competitor .bar i { background: #8a5a12; }
    .competitive-overview { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin-bottom: 18px; }
    .competitive-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
    .competitive-head h2 { margin: 0 0 6px; font-size: 18px; }
    .competitive-head p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
    .competitive-head a { display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font-size: 12px; font-weight: 800; }
    .competitive-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .competitive-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .competitive-platform { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fbfcfd; }
    .competitive-platform h3 { margin: 0 0 10px; font-size: 14px; }
    .competitive-platform p { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .compact-table { margin: 0; }
    .competitive-analysis { border: 1px solid var(--line); border-radius: 8px; background: #fffaf0; padding: 12px; margin: 12px 0; }
    .competitive-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .competitive-cols h5 { margin: 0 0 6px; font-size: 12px; }
    .competitive-cols ol, .source-compact { margin: 0; padding-left: 20px; }
    .competitive-cols li, .source-compact li { margin-bottom: 6px; font-size: 12px; line-height: 1.35; }
    .competitive-cols li span, .source-compact li span { display: block; color: var(--muted); font-weight: 700; }
    .competitive-cols li strong, .source-compact li strong { font-weight: 650; }
    .risk-list { margin: 10px 0 0; padding-left: 18px; color: #8a351f; font-size: 12px; line-height: 1.45; }
    .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
    .seg { border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 8px; min-height: 34px; padding: 0 12px; cursor: pointer; font-weight: 650; }
    .seg.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .table-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: auto; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #f0f3f7; color: #475467; font-size: 12px; position: sticky; top: 0; z-index: 1; }
    td:nth-child(3) { max-width: 460px; line-height: 1.45; }
    .status { display: inline-flex; align-items: center; justify-content: center; min-width: 38px; min-height: 22px; border-radius: 999px; padding: 0 8px; background: #e9f7ef; color: #167044; font-size: 12px; font-weight: 800; }
    .q-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .q-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--line); background: #fbfcfd; }
    .qid, .category { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: var(--soft); color: var(--muted); font-weight: 800; font-size: 12px; }
    .q-head h2 { margin: 8px 0 0; font-size: 18px; line-height: 1.35; }
    .compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; }
    .platform { padding: 16px 18px; border-right: 1px solid var(--line); }
    .platform:last-child { border-right: 0; }
    .platform-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; min-height: 64px; }
    .platform-name { font-size: 12px; font-weight: 900; letter-spacing: .02em; }
    .deepseek .platform-name { color: var(--deepseek); }
    .yuanbao .platform-name { color: var(--yuanbao); }
    .platform h3 { font-size: 15px; margin: 5px 0 0; line-height: 1.35; }
    .badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .badges span:not(.status) { display: inline-flex; min-height: 22px; align-items: center; border-radius: 999px; padding: 0 8px; background: var(--soft); color: var(--muted); font-size: 12px; font-weight: 700; white-space: nowrap; }
    .geo-analysis { border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; padding: 12px; margin: 12px 0; }
    .analysis-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .analysis-head h4 { margin: 0; font-size: 13px; }
    .analysis-head strong { font-size: 24px; }
    .score-grid { display: grid; gap: 4px; }
    .takeaway { margin: 10px 0 0; color: #344054; line-height: 1.5; font-size: 12px; }
    .analysis-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    .analysis-tags span { display: inline-flex; align-items: center; min-height: 22px; border-radius: 999px; padding: 0 8px; background: var(--soft); color: #475467; font-size: 12px; font-weight: 700; }
    details { margin-top: 10px; }
    summary { cursor: pointer; color: var(--muted); font-size: 12px; font-weight: 800; }
    .analysis-detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
    .analysis-detail h5 { margin: 0 0 6px; font-size: 12px; }
    .analysis-detail ul { margin: 0; padding-left: 18px; color: #344054; font-size: 12px; line-height: 1.4; }
    .muted-box { color: var(--muted); font-size: 12px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--soft); padding: 1px 4px; border-radius: 4px; }
    .answer { white-space: pre-wrap; line-height: 1.62; font-size: 13px; color: #263449; max-height: 360px; overflow: auto; padding-right: 4px; }
    .refs { border-top: 1px solid var(--line); margin-top: 14px; padding-top: 12px; }
    .refs h4 { margin: 0 0 8px; font-size: 13px; }
    .refs ol { margin: 0; padding-left: 20px; max-height: 240px; overflow: auto; }
    .refs li { margin-bottom: 8px; line-height: 1.35; font-size: 12px; }
    .refs li span { display: block; color: var(--muted); font-weight: 800; margin-bottom: 2px; }
    .refs li strong { font-weight: 600; }
    .evidence { display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--line); margin-top: 14px; padding-top: 12px; }
    .evidence a { display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; font-size: 12px; font-weight: 800; }
    .evidence a:hover { border-color: var(--ink); }
    .hidden { display: none !important; }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
      aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .geo-overview { grid-template-columns: 1fr; }
      .competitive-stats, .competitive-grid, .competitive-cols { grid-template-columns: 1fr; }
      .compare { grid-template-columns: 1fr; }
      .platform { border-right: 0; border-bottom: 1px solid var(--line); }
      .platform:last-child { border-bottom: 0; }
      .analysis-detail { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <div class="brand">
        <div class="mark">G</div>
        <div>
          <h1>GEO 监测 Dashboard</h1>
          <p>DeepSeek vs 腾讯元宝</p>
        </div>
      </div>
      <nav>${questionNav}</nav>
    </aside>
    <main>
      <section class="hero">
        <h1>美敦力 Medtronic GEO 监测结果</h1>
        <p>数据目录：${escapeHtml(path.basename(RUN_DIR))}。生成时间：${escapeHtml(generatedAt)}。本页汇总 16 个问题在 DeepSeek 与腾讯元宝上的回答、证据文件与引用来源。</p>
      </section>
      <section class="stats">
        <div class="stat"><span>问题数</span><strong>${questions.length}</strong></div>
        <div class="stat"><span>总样本</span><strong>${rows.length}</strong></div>
        <div class="stat"><span>成功样本</span><strong>${rows.filter((row) => row.status === "ok").length}</strong></div>
        <div class="stat"><span>元宝引用条目</span><strong>${metric(yuanbaoRows, (row) => row.referenceItemCount)}</strong></div>
        <div class="stat"><span>平均 GEO 分</span><strong>${avg(geoAnalysis.results || [], (row) => row.scores?.total_score)}</strong></div>
      </section>
      <section class="geo-overview">
        <div class="overview-card deepseek">
          <h2>DeepSeek GEO 均分</h2>
          <strong>${escapeHtml(deepseekAggregate.total_score ?? "-")}</strong>
          <div>${scoreBar("答案可见度", deepseekAggregate.answer_visibility)}${scoreBar("认知准确度", deepseekAggregate.cognitive_accuracy)}${scoreBar("证据纳入度", deepseekAggregate.evidence_inclusion)}${scoreBar("推荐转化力", deepseekAggregate.recommendation_conversion)}</div>
        </div>
        <div class="overview-card yuanbao">
          <h2>腾讯元宝 GEO 均分</h2>
          <strong>${escapeHtml(yuanbaoAggregate.total_score ?? "-")}</strong>
          <div>${scoreBar("答案可见度", yuanbaoAggregate.answer_visibility)}${scoreBar("认知准确度", yuanbaoAggregate.cognitive_accuracy)}${scoreBar("证据纳入度", yuanbaoAggregate.evidence_inclusion)}${scoreBar("推荐转化力", yuanbaoAggregate.recommendation_conversion)}</div>
        </div>
      </section>
      <section class="competitive-overview">
        <div class="competitive-head">
          <div>
            <h2>竞品 GEO 竞争态势</h2>
            <p>回答 share-of-voice 与引用来源权重同时统计；引用权重按官方/监管/临床/学术/媒体/社媒分层，并对靠前引用加权。</p>
          </div>
          <a href="${escapeHtml(rel(RUN_DIR, COMPETITIVE_OUT_FILE))}">JSON</a>
        </div>
        <div class="competitive-stats">
          <div class="stat"><span>美敦力回答SOV</span><strong>${escapeHtml(competitiveAggregate.medtronic.answerShare)}%</strong></div>
          <div class="stat"><span>竞品回答SOV</span><strong>${escapeHtml(competitiveAggregate.competitorAnswerShare)}%</strong></div>
          <div class="stat"><span>美敦力引用份额</span><strong>${escapeHtml(competitiveAggregate.medtronic.sourceShare)}%</strong></div>
          <div class="stat"><span>竞品引用份额</span><strong>${escapeHtml(competitiveAggregate.competitorSourceShare)}%</strong></div>
          <div class="stat"><span>竞品高权重来源</span><strong>${escapeHtml(competitiveAggregate.topCompetitorSources.length)}</strong></div>
        </div>
        <div class="competitive-grid">
          ${competitivePlatformCards}
          <div class="competitive-platform">
            <h3>高权重竞品来源 Top</h3>
            <ol class="source-compact">${sourceList(competitiveAggregate.topCompetitorSources)}</ol>
          </div>
        </div>
        <div class="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>品牌</th>
                <th>角色</th>
                <th>回答提及</th>
                <th>回答SOV</th>
                <th>引用权重</th>
                <th>引用份额</th>
                <th>官方来源</th>
                <th>高权重来源</th>
              </tr>
            </thead>
            <tbody>${competitiveBrandRows}</tbody>
          </table>
        </div>
      </section>
      <div class="controls">
        <button class="seg active" data-filter="all">全部</button>
        ${categoryTabs}
      </div>
      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>编号</th>
              <th>分类</th>
              <th>问题</th>
              <th>DeepSeek</th>
              <th>字数</th>
              <th>链接</th>
              <th>GEO分</th>
              <th>竞品SOV/证据</th>
              <th>元宝</th>
              <th>字数</th>
              <th>来源</th>
              <th>段落引用</th>
              <th>GEO分</th>
              <th>竞品SOV/证据</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>
      ${cards}
    </main>
  </div>
  <script>
    const buttons = Array.from(document.querySelectorAll(".seg"));
    const filterables = Array.from(document.querySelectorAll("[data-category]"));
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const filter = button.dataset.filter;
        filterables.forEach((item) => {
          item.classList.toggle("hidden", filter !== "all" && item.dataset.category !== filter);
        });
      });
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(OUT_FILE, html);
  console.log(`dashboard_saved ${OUT_FILE}`);
}

build();
