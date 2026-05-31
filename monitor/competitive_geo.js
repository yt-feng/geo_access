#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUN_DIR = path.join(ROOT, "monitor_runs", "2026-05-28T03-16-25-378Z_prompt_matrix");

const BRANDS = [
  {
    id: "medtronic",
    name: "Medtronic / 美敦力",
    role: "target",
    aliases: [
      "Medtronic", "美敦力", "MiniMed", "CareLink", "Guardian", "Simplera", "SmartGuard",
      "Micra", "Evolut", "CoreValve", "Hugo", "LigaSure", "Valleylab", "Tri-Staple",
      "Reveal LINQ", "Cobalt", "Crome", "OptiVol", "BlueSync", "Touch Surgery",
    ],
    domains: ["medtronic.com", "news.medtronic.com", "europe.medtronic.com", "medtronic-diabetes.com"],
  },
  {
    id: "abbott",
    name: "Abbott / 雅培",
    role: "competitor",
    aliases: ["Abbott", "雅培", "St. Jude", "St Jude", "圣犹达", "FreeStyle Libre", "Libre", "瞬感", "CardioMEMS", "MultiPoint", "SJM"],
    domains: ["abbott.com", "cardiovascular.abbott", "freestyle.abbott", "freestylelibre.com", "sjm.com"],
  },
  {
    id: "boston_scientific",
    name: "Boston Scientific / 波士顿科学",
    role: "competitor",
    aliases: ["Boston Scientific", "波士顿科学", "HeartLogic", "S-ICD", "Emblem", "Latitude", "WATCHMAN"],
    domains: ["bostonscientific.com"],
  },
  {
    id: "biotronik",
    name: "Biotronik / 百多力",
    role: "competitor",
    aliases: ["Biotronik", "百多力", "Home Monitoring", "HeartInsight"],
    domains: ["biotronik.com"],
  },
  {
    id: "edwards",
    name: "Edwards / 爱德华",
    role: "competitor",
    aliases: ["Edwards", "Edwards Lifesciences", "爱德华", "SAPIEN", "Sapien", "Sapien 3"],
    domains: ["edwards.com", "edwards.com.cn"],
  },
  {
    id: "johnson_ethicon",
    name: "J&J Ethicon / 强生爱惜康",
    role: "competitor",
    aliases: ["Johnson & Johnson", "J&J", "强生", "Ethicon", "爱惜康", "MONARCH", "Auris", "ENSEAL", "HARMONIC"],
    domains: ["jnj.com", "jjmedtech.com", "ethicon.com"],
  },
  {
    id: "intuitive",
    name: "Intuitive / 达芬奇",
    role: "competitor",
    aliases: ["Intuitive Surgical", "Intuitive", "直觉外科", "达芬奇", "da Vinci", "Ion"],
    domains: ["intuitive.com", "intuitivesurgical.com"],
  },
  {
    id: "dexcom",
    name: "Dexcom",
    role: "competitor",
    aliases: ["Dexcom", "Dexcom G6", "Dexcom G7", "G7"],
    domains: ["dexcom.com"],
  },
  {
    id: "insulet",
    name: "Insulet / Omnipod",
    role: "competitor",
    aliases: ["Insulet", "Omnipod", "Omnipod 5"],
    domains: ["insulet.com", "omnipod.com"],
  },
  {
    id: "tandem",
    name: "Tandem Diabetes Care",
    role: "competitor",
    aliases: ["Tandem", "t:slim", "t:slim X2", "Mobi", "Control-IQ"],
    domains: ["tandemdiabetes.com"],
  },
  {
    id: "bd",
    name: "BD / 碧迪",
    role: "competitor",
    aliases: ["BD", "Becton Dickinson", "碧迪"],
    domains: ["bd.com"],
  },
  {
    id: "siemens_healthineers",
    name: "Siemens Healthineers / 西门子医疗",
    role: "competitor",
    aliases: ["Siemens Healthineers", "Siemens", "西门子医疗", "西门子"],
    domains: ["siemens-healthineers.com"],
  },
  {
    id: "philips",
    name: "Philips / 飞利浦",
    role: "competitor",
    aliases: ["Philips", "飞利浦"],
    domains: ["philips.com"],
  },
  {
    id: "microport",
    name: "MicroPort / 微创",
    role: "competitor",
    aliases: ["MicroPort", "微创", "微创医疗"],
    domains: ["microport.com"],
  },
];

const AUTHORITY_RULES = [
  { id: "regulatory", label: "监管/政府", score: 96, patterns: [/\.gov\b/i, /fda\.gov/i, /accessdata\.fda\.gov/i, /nmpa\.gov\.cn/i, /ema\.europa\.eu/i] },
  { id: "clinical_trial", label: "临床注册/指南", score: 92, patterns: [/clinicaltrials\.gov/i, /ichgcp\.net/i, /guideline/i, /指南|共识/] },
  { id: "academic", label: "期刊/学术", score: 88, patterns: [/pubmed|nih\.gov|ncbi\.nlm\.nih\.gov|nejm|jamanetwork|thelancet|ahajournals|diabetesjournals|nature|springer|sciencedirect|mdpi\.com|frontiersin|wiley/i] },
  { id: "professional_society", label: "专业协会", score: 82, patterns: [/acc\.org|escardio|heart\.org|diabetes\.org|easd|ada/i, /美国心脏病学会|中华医学会/] },
  { id: "brand_official", label: "品牌官方", score: 78, patterns: [] },
  { id: "medical_media", label: "医疗媒体/行业", score: 62, patterns: [/medscape|medtech|fierce|pharmcube|medsci|dxy|丁香园|医脉通|严道医声|医疗器械创新网|动脉网|器械之家/i] },
  { id: "market_report", label: "市场研究/商业", score: 55, patterns: [/market|research|report|maximizemarketresearch|grandviewresearch|fortunebusinessinsights|新浪|雪球|证券|研报/i] },
  { id: "social", label: "社媒/公众号", score: 38, patterns: [/公众号|微信|小红书|知乎|微博|·/] },
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeHost(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {}
  const domainMatch = raw.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/i);
  return domainMatch ? domainMatch[0].toLowerCase().replace(/^www\./, "") : "";
}

function hostMatches(host, domain) {
  const cleanHost = String(host || "").toLowerCase().replace(/^www\./, "");
  const cleanDomain = String(domain || "").toLowerCase().replace(/^www\./, "");
  return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
}

function countAlias(text, alias) {
  if (!text || !alias) return 0;
  const source = String(text);
  const pattern = /[a-z0-9]/i.test(alias)
    ? new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(alias)}(?![A-Za-z0-9])`, "gi")
    : new RegExp(escapeRegExp(alias), "g");
  return (source.match(pattern) || []).length;
}

function firstAliasIndex(text, aliases) {
  let best = -1;
  const lower = String(text || "").toLowerCase();
  for (const alias of aliases) {
    const index = /[a-z0-9]/i.test(alias)
      ? lower.search(new RegExp(`(?<![a-z0-9])${escapeRegExp(alias.toLowerCase())}(?![a-z0-9])`, "i"))
      : String(text || "").indexOf(alias);
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  return best;
}

function brandMentions(text, brand) {
  const aliasCounts = brand.aliases
    .map((alias) => ({ alias, count: countAlias(text, alias) }))
    .filter((item) => item.count > 0);
  return {
    brandId: brand.id,
    brandName: brand.name,
    role: brand.role,
    count: aliasCounts.reduce((sum, item) => sum + item.count, 0),
    firstIndex: firstAliasIndex(text, brand.aliases),
    aliases: aliasCounts,
  };
}

function matchOfficialBrand(host) {
  return BRANDS.find((brand) => brand.domains.some((domain) => hostMatches(host, domain))) || null;
}

function classifyAuthority(source, host, officialBrand) {
  if (officialBrand) {
    return { id: "brand_official", label: "品牌官方", score: 78 };
  }
  const joined = `${source.source || ""} ${source.title || ""} ${source.snippet || ""} ${source.text || ""} ${host || ""}`;
  for (const rule of AUTHORITY_RULES) {
    if (rule.id === "brand_official") continue;
    if (rule.patterns.some((pattern) => pattern.test(joined))) {
      return { id: rule.id, label: rule.label, score: rule.score };
    }
  }
  if (host) return { id: "web", label: "普通网页", score: 46 };
  return { id: "unknown", label: "未知来源", score: 30 };
}

function collectReferences(references = {}) {
  const items = [];
  for (const item of references.referenceItems || []) {
    items.push({
      index: item.index || items.length + 1,
      source: item.source || "",
      title: item.title || "",
      snippet: item.snippet || "",
      text: item.text || "",
      href: item.href || "",
      type: "reference_item",
    });
  }
  for (const item of references.probableReferenceLinks || []) {
    items.push({
      index: items.length + 1,
      source: item.host || "",
      title: item.text || item.title || "",
      snippet: item.ariaLabel || "",
      text: `${item.text || ""} ${item.title || ""} ${item.ariaLabel || ""}`,
      href: item.href || "",
      type: "reference_link",
    });
  }
  return items.slice(0, 120);
}

function analyzeReferences(references = {}) {
  const rawItems = collectReferences(references);
  const brandSourceScores = Object.fromEntries(BRANDS.map((brand) => [brand.id, 0]));
  const brandOfficialCounts = Object.fromEntries(BRANDS.map((brand) => [brand.id, 0]));
  const brandHighAuthorityCounts = Object.fromEntries(BRANDS.map((brand) => [brand.id, 0]));
  const enriched = [];

  rawItems.forEach((item, idx) => {
    const host = normalizeHost(item.href || item.source);
    const officialBrand = matchOfficialBrand(host);
    const authority = classifyAuthority(item, host, officialBrand);
    const joined = `${item.source} ${item.title} ${item.snippet} ${item.text} ${host}`;
    const matchedBrands = new Map();
    if (officialBrand) matchedBrands.set(officialBrand.id, { brand: officialBrand, reason: "official_domain" });
    for (const brand of BRANDS) {
      const mention = brandMentions(joined, brand);
      if (mention.count > 0) matchedBrands.set(brand.id, { brand, reason: matchedBrands.get(brand.id)?.reason || "text_mention" });
    }
    const positionFactor = Math.max(0.55, 1 - idx * 0.045);
    const matched = Array.from(matchedBrands.values()).map(({ brand, reason }) => {
      const officialBonus = reason === "official_domain" ? 18 : 0;
      const score = Math.round((authority.score + officialBonus) * positionFactor);
      brandSourceScores[brand.id] += score;
      if (reason === "official_domain") brandOfficialCounts[brand.id] += 1;
      if (authority.score >= 75 || reason === "official_domain") brandHighAuthorityCounts[brand.id] += 1;
      return { id: brand.id, name: brand.name, role: brand.role, reason, score };
    });
    enriched.push({
      ...item,
      host,
      authority,
      matchedBrands: matched,
    });
  });

  return {
    items: enriched,
    brandSourceScores,
    brandOfficialCounts,
    brandHighAuthorityCounts,
  };
}

function analyzeCompetitiveAnswer({ questionId, platform, prompt, answer, references }) {
  const answerText = String(answer || "");
  const mentions = BRANDS.map((brand) => brandMentions(answerText, brand)).filter((item) => item.count > 0);
  const totalMentions = mentions.reduce((sum, item) => sum + item.count, 0);
  const refAnalysis = analyzeReferences(references);
  const totalSourceWeight = Object.values(refAnalysis.brandSourceScores).reduce((sum, value) => sum + value, 0);
  const brandRows = BRANDS.map((brand) => {
    const mention = mentions.find((item) => item.brandId === brand.id) || {
      brandId: brand.id,
      brandName: brand.name,
      role: brand.role,
      count: 0,
      firstIndex: -1,
      aliases: [],
    };
    const sourceWeight = refAnalysis.brandSourceScores[brand.id] || 0;
    return {
      id: brand.id,
      name: brand.name,
      role: brand.role,
      answerMentions: mention.count,
      answerShare: totalMentions ? Math.round((mention.count / totalMentions) * 100) : 0,
      firstMentionIndex: mention.firstIndex,
      aliases: mention.aliases,
      sourceWeight,
      sourceShare: totalSourceWeight ? Math.round((sourceWeight / totalSourceWeight) * 100) : 0,
      officialSourceCount: refAnalysis.brandOfficialCounts[brand.id] || 0,
      highAuthoritySourceCount: refAnalysis.brandHighAuthorityCounts[brand.id] || 0,
    };
  });
  const answerRanking = brandRows
    .filter((item) => item.answerMentions > 0)
    .sort((a, b) => b.answerMentions - a.answerMentions || a.firstMentionIndex - b.firstMentionIndex)
    .slice(0, 8);
  const sourceRanking = brandRows
    .filter((item) => item.sourceWeight > 0)
    .sort((a, b) => b.sourceWeight - a.sourceWeight)
    .slice(0, 8);
  const medtronic = brandRows.find((item) => item.id === "medtronic");
  const competitors = brandRows.filter((item) => item.role === "competitor");
  const competitorMentionTotal = competitors.reduce((sum, item) => sum + item.answerMentions, 0);
  const competitorSourceWeight = competitors.reduce((sum, item) => sum + item.sourceWeight, 0);
  const highWeightCompetitorSources = refAnalysis.items
    .filter((item) => item.authority.score >= 70 && item.matchedBrands.some((brand) => brand.role === "competitor"))
    .slice(0, 8)
    .map((item) => ({
      source: item.source || item.host || "未知来源",
      title: item.title || item.snippet || "",
      authority: item.authority,
      brands: item.matchedBrands.filter((brand) => brand.role === "competitor"),
    }));
  const risks = [];
  const topAnswer = answerRanking[0];
  const topSource = sourceRanking[0];
  if (topAnswer && topAnswer.role === "competitor" && (topAnswer.answerMentions > (medtronic?.answerMentions || 0))) {
    risks.push("回答可见度由竞品领先");
  }
  if (topSource && topSource.role === "competitor" && competitorSourceWeight > (medtronic?.sourceWeight || 0) * 1.2) {
    risks.push("引用证据权重偏向竞品");
  }
  if ((medtronic?.officialSourceCount || 0) === 0 && competitors.some((item) => item.officialSourceCount > 0)) {
    risks.push("竞品官方来源出现，但缺少美敦力官方来源");
  }
  if (highWeightCompetitorSources.length > 0) {
    risks.push("存在高权重竞品来源");
  }

  return {
    questionId,
    platform,
    prompt,
    answerMentionTotal: totalMentions,
    sourceWeightTotal: totalSourceWeight,
    medtronic,
    competitorMentionTotal,
    competitorSourceWeight,
    answerRanking,
    sourceRanking,
    brandRows,
    highWeightCompetitorSources,
    risks,
  };
}

function aggregateCompetitive(items) {
  const totalsByBrand = Object.fromEntries(BRANDS.map((brand) => [brand.id, {
    id: brand.id,
    name: brand.name,
    role: brand.role,
    answerMentions: 0,
    sourceWeight: 0,
    officialSourceCount: 0,
    highAuthoritySourceCount: 0,
    firstMentionHits: 0,
  }]));
  const byPlatform = {};
  let totalMentions = 0;
  let totalSourceWeight = 0;
  const highWeightCompetitorSources = [];
  const risks = [];

  for (const item of items) {
    byPlatform[item.platform] ||= {
      platform: item.platform,
      sampleCount: 0,
      medtronicMentions: 0,
      competitorMentions: 0,
      medtronicSourceWeight: 0,
      competitorSourceWeight: 0,
      riskCount: 0,
    };
    const platformAgg = byPlatform[item.platform];
    platformAgg.sampleCount += 1;
    platformAgg.medtronicMentions += item.medtronic?.answerMentions || 0;
    platformAgg.competitorMentions += item.competitorMentionTotal || 0;
    platformAgg.medtronicSourceWeight += item.medtronic?.sourceWeight || 0;
    platformAgg.competitorSourceWeight += item.competitorSourceWeight || 0;
    platformAgg.riskCount += item.risks.length ? 1 : 0;

    totalMentions += item.answerMentionTotal;
    totalSourceWeight += item.sourceWeightTotal;
    highWeightCompetitorSources.push(...item.highWeightCompetitorSources.map((source) => ({
      questionId: item.questionId,
      platform: item.platform,
      ...source,
    })));
    if (item.risks.length) risks.push({ questionId: item.questionId, platform: item.platform, risks: item.risks });

    for (const row of item.brandRows) {
      const target = totalsByBrand[row.id];
      target.answerMentions += row.answerMentions;
      target.sourceWeight += row.sourceWeight;
      target.officialSourceCount += row.officialSourceCount;
      target.highAuthoritySourceCount += row.highAuthoritySourceCount;
      if (row.firstMentionIndex >= 0) target.firstMentionHits += 1;
    }
  }

  const brands = Object.values(totalsByBrand)
    .map((row) => ({
      ...row,
      answerShare: totalMentions ? Math.round((row.answerMentions / totalMentions) * 100) : 0,
      sourceShare: totalSourceWeight ? Math.round((row.sourceWeight / totalSourceWeight) * 100) : 0,
    }))
    .filter((row) => row.answerMentions || row.sourceWeight)
    .sort((a, b) => b.answerMentions - a.answerMentions || b.sourceWeight - a.sourceWeight);

  for (const platformAgg of Object.values(byPlatform)) {
    const mentionTotal = platformAgg.medtronicMentions + platformAgg.competitorMentions;
    const sourceTotal = platformAgg.medtronicSourceWeight + platformAgg.competitorSourceWeight;
    platformAgg.medtronicAnswerShare = mentionTotal ? Math.round((platformAgg.medtronicMentions / mentionTotal) * 100) : 0;
    platformAgg.competitorAnswerShare = mentionTotal ? Math.round((platformAgg.competitorMentions / mentionTotal) * 100) : 0;
    platformAgg.medtronicSourceShare = sourceTotal ? Math.round((platformAgg.medtronicSourceWeight / sourceTotal) * 100) : 0;
    platformAgg.competitorSourceShare = sourceTotal ? Math.round((platformAgg.competitorSourceWeight / sourceTotal) * 100) : 0;
  }

  const medtronic = brands.find((brand) => brand.id === "medtronic") || {
    answerMentions: 0,
    answerShare: 0,
    sourceWeight: 0,
    sourceShare: 0,
    officialSourceCount: 0,
  };
  const competitors = brands.filter((brand) => brand.role === "competitor");
  const competitorAnswerMentions = competitors.reduce((sum, row) => sum + row.answerMentions, 0);
  const competitorSourceWeight = competitors.reduce((sum, row) => sum + row.sourceWeight, 0);

  return {
    sampleCount: items.length,
    totalMentions,
    totalSourceWeight,
    medtronic,
    competitorAnswerMentions,
    competitorAnswerShare: totalMentions ? Math.round((competitorAnswerMentions / totalMentions) * 100) : 0,
    competitorSourceWeight,
    competitorSourceShare: totalSourceWeight ? Math.round((competitorSourceWeight / totalSourceWeight) * 100) : 0,
    brands,
    byPlatform,
    topCompetitorSources: highWeightCompetitorSources
      .sort((a, b) => b.authority.score - a.authority.score)
      .slice(0, 20),
    risks,
  };
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

function analyzeRunDir(runDir = DEFAULT_RUN_DIR) {
  const summary = readJson(path.join(runDir, "summary.json"));
  if (!summary?.summary?.length) throw new Error(`No summary found under ${runDir}`);
  const results = [];
  for (const row of summary.summary) {
    const qDir = path.join(runDir, row.questionId);
    const txtPath = path.join(qDir, `${row.platform}.txt`);
    const refsPath = path.join(qDir, `${row.platform}_references.json`);
    const answer = stripUiText(readText(txtPath), row.prompt);
    const references = readJson(refsPath, {});
    results.push(analyzeCompetitiveAnswer({
      questionId: row.questionId,
      platform: row.platform,
      prompt: row.prompt,
      answer,
      references,
    }));
  }
  return {
    createdAt: new Date().toISOString(),
    runDir,
    brands: BRANDS,
    aggregate: aggregateCompetitive(results),
    results,
  };
}

function main() {
  const runDir = path.resolve(process.argv[2] || process.env.GEO_DASHBOARD_RUN_DIR || DEFAULT_RUN_DIR);
  const outPath = path.join(runDir, "competitive_geo_summary.json");
  const payload = analyzeRunDir(runDir);
  writeJson(outPath, payload);
  console.log(`competitive_geo_saved ${outPath}`);
  console.log(JSON.stringify({
    sampleCount: payload.aggregate.sampleCount,
    medtronicAnswerShare: payload.aggregate.medtronic.answerShare,
    competitorAnswerShare: payload.aggregate.competitorAnswerShare,
    medtronicSourceShare: payload.aggregate.medtronic.sourceShare,
    competitorSourceShare: payload.aggregate.competitorSourceShare,
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = {
  BRANDS,
  analyzeCompetitiveAnswer,
  aggregateCompetitive,
  analyzeRunDir,
};
