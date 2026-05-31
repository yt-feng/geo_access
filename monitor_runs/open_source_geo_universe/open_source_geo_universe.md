# GEO / AEO / LLMO 开源项目功能宇宙盘点

生成时间：2026-05-31  
范围：AI 时代品牌评估、GEO/AEO/LLMO、AI visibility、llms.txt、AI 可引用性、答案监测、竞品声量、引用来源、内容优化。排除 GeoIP、地图/GIS、纯传统 SEO 工具。

## 结论

当前 `geo_access` 已经覆盖了“品牌在 AI 回答里如何出现”的监测和分析核心：DeepSeek / 腾讯元宝采集、回答稳定等待、引用清单保存、逐回答 GEO 四项指标分析、竞品 share-of-voice、引用来源权重、WildChat 意图挖掘、HTML dashboard。

但它还没有覆盖开源项目里很常见的另一半：让品牌官网、资料页、FAQ、白皮书、产品页变成 AI 更容易抓取、解析、引用的工程层。也就是 `llms.txt`、`llms-full.txt`、`robots.txt`、`sitemap.xml`、Schema/JSON-LD、`ai.txt`、Markdown twins、站点爬取、文档转 Markdown、内容库存、可引用性审计、内容改写优化循环。

如果目标是“full universe”，建议把系统分成两条线：

1. **Monitor**：继续强化当前已有的 AI 回答监测、品牌指标、竞品、引用来源、意图覆盖、dashboard。
2. **Optimize**：新增站点/内容 GEO readiness 审计、LLM-readable publishing、source authority、内容改写实验、CI 回归监测。

## 外部项目格局

GitHub 话题页显示，相关生态已经不是少量项目：`generative-engine-optimization` 有 258 个公开仓库，`ai-visibility` 有 119 个，`llms-txt` 有 362 个。这里不把所有噪音仓库逐个展开，而是按功能层抽代表项目。

## 当前系统覆盖度

| 功能层 | 当前覆盖 | 判断 |
|---|---:|---|
| 多平台 AI 回答采集 | DeepSeek、腾讯元宝、豆包登录/验证码处理框架 | 强，但平台还少 |
| 回答完成监测 | 元宝流式完成和引用清单等待 | 中强 |
| HTML / PNG / TXT / 引用保存 | 已有 | 强 |
| 品牌 GEO 四项指标 | 答案可见度、认知准确度、证据纳入度、推荐转化力 | 强 |
| 竞品扫描 | 回答 SOV、引用证据份额、竞品高权重来源 | 已有首版 |
| 用户意图挖掘 | WildChat 购买/选择意图范式、MiniMed 小实验 | 已有首版 |
| Dashboard | 批量问题矩阵、逐回答分析、竞品 GEO、意图实验 | 强 |
| llms.txt / ai.txt / robots / sitemap / schema 审计 | 无 | 关键缺口 |
| 站点爬取与文档转 Markdown | 无 | 关键缺口 |
| 内容库存和来源资产库 | 无 | 关键缺口 |
| 内容改写 / agentic GEO 优化 | 无 | 关键缺口 |
| SERP / Google AI Overview 监测 | 无 | 关键缺口 |
| 多 run 趋势、告警、回归门禁 | 只有 loop，没有趋势数据库和 CI gate | 中等缺口 |

## 功能宇宙矩阵

| 层 | 能力 | 代表开源项目 | 开源项目做什么 | `geo_access` 现状 | 应融合的实现 |
|---|---|---|---|---|---|
| L0 | 用户意图 / prompt universe | WildChat、LMSYS-Chat、开源 SEO/GEO skill packs | 从真实问法、搜索、论坛、agent workflow 中归纳问题范式 | 已接入 WildChat 购买意图 | 扩展成 `intent_library.json`，支持行业、品牌、竞品、漏斗阶段、证据需求 |
| L1 | 多引擎监测 | OneGlanse、Elmo、Aperture、XanLens、aeo-radar、aeo-platform | 监测 ChatGPT、Gemini、Claude、Perplexity、Google AI Overview 等 AI answer engines | DeepSeek / 元宝较强，豆包待验证码；海外平台未接 | 加 `providers/` 抽象：web UI + API 双通道，统一输出 answer/reference/screenshot/raw |
| L2 | AI visibility / brand scoring | GetCito、Aperture、Sonde、Citatra、AEO mentions crawler | 品牌出现、竞品比较、可见度分数、报告 | GEO 四项指标 + 竞品 SOV 已有 | 加时间序列：brand visibility over time、平台差异、intent 差异 |
| L3 | 引用 / source authority | searchstack-aeo、Aperture、SEO skill packs | 分析引用来源、竞品内容、权威性、backlinks 或搜索信号 | 已有启发式引用权重 | 建 `source_authority_catalog.json`，按官方/监管/学术/媒体/社区/竞品/经销商分级 |
| L4 | AI discoverability 技术审计 | aeorank、aeo.js、claude-rank、AEO God Mode、akii optimizer | 审计 llms.txt、robots、sitemap、JSON-LD、schema、canonical、AI crawler rules | 无 | 新增 `site_audit`：输入域名，输出 0-100 GEO readiness、缺陷和修复建议 |
| L5 | LLM-readable publishing | AnswerDotAI/llms-txt、firecrawl/llmstxt-generator、llms-txt-hub、mkdocs/sphinx/starlight 插件 | 生成 `llms.txt`、`llms-full.txt`、docs 索引和 AI-readable 文档 | 无 | 新增 `llms_txt_generator`：从站点 crawl / sitemap / markdown 生成文件 |
| L6 | 站点爬取 / 文档转 Markdown | crawl4ai、microsoft/markitdown、sourcey、ragrabbit | 把网页、PDF、Office、API docs 转成 LLM-friendly Markdown | 无 | 先用轻量 Playwright/HTTP crawler + MarkItDown 可选适配，做内容库存 |
| L7 | 内容优化 / 改写实验 | GEO-optim/GEO、AgenticGEO、MAGEO、AutoGEO、geo-optimizer | 用指标、agent、critic、planner、editor 迭代改写内容，提高回答引用和可见度 | 无 | 新增 `optimizer_lab`，先离线生成改写建议，再跑小样本 A/B 监测 |
| L8 | SERP / AI Overview | searchstack-aeo、GetCito、SEO skill packs | Google SERP、AI Overview、关键词、GSC、backlink 集成 | 无 | 可接 DataForSEO/SerpAPI 或手动 Playwright SERP collector |
| L9 | CI / regression / scheduled ops | aeorank GitHub Action、cron-ready CLI、agent skills | PR 或定时检测，阈值失败、报告归档 | 只有本地 loop | 加 GitHub Actions + `baseline.json`，可对可见度和引用份额做回归门禁 |
| L10 | CMS / framework 插件 | WordPress、WooCommerce、Astro、MkDocs、Sphinx、Magento 插件 | 把 llms.txt/schema/AI crawler rules 自动发布进站点 | 无 | 不先做插件；先输出静态文件和修复 patch，后续按客户栈适配 |

## 代表项目清单

### A. 研究与内容优化

| repo | 功能 | 对我们的启发 | 当前是否覆盖 |
|---|---|---|---|
| [GEO-optim/GEO](https://github.com/GEO-optim/GEO) | KDD 2024 GEO 论文配套 benchmark / metric | 指标定义和实验基准 | 部分，四指标是业务化版本，不是论文复刻 |
| [AIcling/agentic_geo](https://github.com/AIcling/agentic_geo) | AgenticGEO，策略库、critic、内容重写 | 适合做 `optimizer_lab` 的策略选择器 | 未覆盖 |
| [Wu-beining/MAGEO](https://github.com/Wu-beining/MAGEO) | 多 agent planner/editor/evaluator/memory/fidelity gate | 适合做“改写但不胡编”的闭环 | 未覆盖 |
| [cxcscmu/AutoGEO](https://github.com/cxcscmu/AutoGEO) | 自动学习 generative engine preference 并改写网页内容 | 适合做 A/B 内容实验 | 未覆盖 |
| [geo-team-red/geo-optimizer](https://github.com/geo-team-red/geo-optimizer) | pluggable GEO strategy framework | 可参考策略插件设计 | 未覆盖 |

### B. AI visibility / 品牌监测

| repo | 功能 | 对我们的启发 | 当前是否覆盖 |
|---|---|---|---|
| [aryamantodkar/oneglanse](https://github.com/aryamantodkar/oneglanse) | 免费开源 GEO tracker，监测 ChatGPT/Gemini/Perplexity/Claude/AI Overview | 多引擎品牌监测 UI 和 ClickHouse/Next.js 架构 | 部分，平台不同、无数据库 |
| [elmohq/elmo](https://github.com/elmohq/elmo) | AI visibility tracking | 可参考产品化指标和平台覆盖 | 部分 |
| [anyin-ai/aperture](https://github.com/anyin-ai/aperture) | 自托管 AI visibility analytics，BYOK，竞品分析 | 适合参考多品牌、多平台、竞品 dashboard | 部分 |
| [FayAndXan/xanlens](https://github.com/FayAndXan/xanlens) | 询问 7 个 AI engines 是否知道品牌 | 可参考快速 audit 模式 | 部分 |
| [hellowalt/aeo-radar](https://github.com/hellowalt/aeo-radar) | AEO monitor，跟踪 ChatGPT 等 AI answer engines | 监测产品参考 | 部分 |
| [federicodeponte/aeo-mentions-crawler](https://github.com/federicodeponte/aeo-mentions-crawler) | 多 LLM 平台品牌 mentions | mentions crawler 可参考 | 部分 |
| [webappski/aeo-platform](https://github.com/webappski/aeo-platform) / [webappski/aeo-tracker](https://github.com/webappski/aeo-tracker) | CLI 追踪 ChatGPT/Gemini/Claude 可见度 | 可参考零依赖 CLI 输出 | 部分 |
| [compiuta-origin/sonde-analytics](https://github.com/compiuta-origin/sonde-analytics) | 了解品牌在 LLM responses 中如何出现 | 可参考自托管品牌 analytics | 部分 |
| [Citatra/Citatra](https://github.com/Citatra/Citatra) | AEO/GEO 平台，竞品、backlinks、AI search intelligence | 竞品和 backlinks 维度可借鉴 | 部分 |

### C. llms.txt / AI-readable publishing

| repo | 功能 | 对我们的启发 | 当前是否覆盖 |
|---|---|---|---|
| [AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt) | `llms.txt` 参考/spec | 应作为格式基准 | 未覆盖 |
| [firecrawl/llmstxt-generator](https://github.com/firecrawl/llmstxt-generator) | 从网站生成 `llms.txt` / `llms-full.txt` | 可参考生成流程 | 未覆盖 |
| [thedaviddias/llms-txt-hub](https://github.com/thedaviddias/llms-txt-hub) | AI-ready docs / llms.txt directory | 可用于样例和 benchmark | 未覆盖 |
| [multivmlabs/aeo.js](https://github.com/multivmlabs/aeo.js) | 生成 llms.txt、robots.txt、sitemap、JSON-LD | `site_audit` 和 generator 的直接参照 | 未覆盖 |
| [vinpatel/aeorank](https://github.com/vinpatel/aeorank) | 36 项 AI visibility criteria、9 个 AI-readable files、GitHub App/Action | readiness score / CI gate 参照 | 未覆盖 |
| [dodopayments/dualmark](https://github.com/dodopayments/dualmark) | HTML 给人看，Markdown twins 给 AI agents | 内容发布形态可借鉴 | 未覆盖 |
| [WP-Autoplugin/llms-txt-for-wp](https://github.com/WP-Autoplugin/llms-txt-for-wp) / [vaneavasco/llmstxt-wp](https://github.com/vaneavasco/llmstxt-wp) | WordPress llms.txt 插件 | 后续客户 CMS 适配 | 未覆盖 |
| [pawamoy/mkdocs-llmstxt](https://github.com/pawamoy/mkdocs-llmstxt) / [jdillard/sphinx-llms-txt](https://github.com/jdillard/sphinx-llms-txt) / [delucis/starlight-llms-txt](https://github.com/delucis/starlight-llms-txt) | docs 框架插件 | 文档站客户适配 | 未覆盖 |

### D. 爬取、转换、MCP 和文档资产

| repo | 功能 | 对我们的启发 | 当前是否覆盖 |
|---|---|---|---|
| [unclecode/crawl4ai](https://github.com/unclecode/crawl4ai) | LLM-friendly crawling / Markdown extraction | 站点内容库存和引用资产抽取 | 未覆盖 |
| [microsoft/markitdown](https://github.com/microsoft/markitdown) | 多格式文档转 Markdown | 医疗行业 PDF/Word/Excel/白皮书可转资产库 | 未覆盖 |
| [sourcey/sourcey](https://github.com/sourcey/sourcey) | OpenAPI/MCP/Doxygen/Markdown docs 生成 | 技术文档型客户可借鉴 | 未覆盖 |
| [madarco/ragrabbit](https://github.com/madarco/ragrabbit) | 自托管 AI Search 和 LLM.txt | 可参考站内 RAG + llms.txt | 未覆盖 |
| [langchain-ai/mcpdoc](https://github.com/langchain-ai/mcpdoc) | 把 llms.txt 暴露给 IDE/agents | 后续 MCP 接口参考 | 未覆盖 |
| [thedaviddias/mcp-llms-txt-explorer](https://github.com/thedaviddias/mcp-llms-txt-explorer) | MCP 探索 llms.txt 网站 | 后续 source discovery 参考 | 未覆盖 |

### E. Agent skills / SEO-GEO 操作包

| repo | 功能 | 对我们的启发 | 当前是否覆盖 |
|---|---|---|---|
| [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) | SEO/GEO skills，keyword、content、audit、rank tracking | 可参考工作流模板 | 部分 |
| [Auriti-Labs/geo-optimizer-skill](https://github.com/Auriti-Labs/geo-optimizer-skill) | GEO toolkit，audit/optimize/AI search visibility | 可参考审计 checklist | 未覆盖技术审计 |
| [AgriciDaniel/codex-seo](https://github.com/AgriciDaniel/codex-seo) | Codex-first SEO/GEO suite，GSC/DataForSEO/Firecrawl | 可参考数据源集成 | 未覆盖 |
| [onvoyage-ai/gtm-engineer-skills](https://github.com/onvoyage-ai/gtm-engineer-skills) | AEO/GEO score checks 和 framework-specific fixes | 可参考 scoring checklist | 未覆盖 |
| [Cognitic-Labs/geoskills](https://github.com/Cognitic-Labs/geoskills) | diagnose/fix/monitor AI visibility agent skills | 可参考 agent 命令组织 | 部分 |
| [z1fex/SEO-AGENCY-IN-A-BOX](https://github.com/z1fex/SEO-AGENCY-IN-A-BOX) | 多 agent SEO/AEO/content/reporting | 不建议照搬，但可参考任务编排 | 部分 |

## 缺口优先级

### P0：最该马上补

1. **站点 GEO readiness audit**
   - 输入：品牌官网域名、重点 URL、竞品 URL。
   - 检查：`llms.txt`、`llms-full.txt`、`robots.txt`、`sitemap.xml`、Schema/JSON-LD、canonical、标题/摘要、FAQ、可爬性、PDF/图片文本、AI crawler rules。
   - 输出：0-100 readiness score、缺陷清单、修复建议、可直接发布的文件草案。

2. **source authority catalog**
   - 把当前启发式引用权重变成可维护数据库。
   - 字段：domain、source_type、authority_weight、ownership、is_competitor、is_official、country、medical/regulatory/scientific/media/community、noise risk。
   - 用处：回答引用清单里出现“竞品高权重稿件”时能自动报警。

3. **多 run 趋势和 baseline**
   - 当前 dashboard 是单 run。
   - 需要 `runs_index.json` 或 SQLite：按日期、平台、intent、brand、competitor 聚合。
   - 输出：趋势线、波动、回归、竞品超越、引用来源变化。

4. **intent library**
   - 把 WildChat 范式、行业知识、品牌资产、竞品、漏斗阶段结构化。
   - 输出稳定 prompt matrix，避免每次临时写问题。

### P1：第二阶段

1. **多模型 API collector**
   - ChatGPT/OpenAI、Gemini、Claude、Perplexity、DeepSeek API；国内平台仍保留 Playwright web UI。
   - 统一 answer/reference schema。

2. **Google AI Overview / SERP collector**
   - 对“购买/对比/风险/价格/适应症/医保/售后”等关键词捕捉 AI Overview、自然结果、People Also Ask、竞品稿件。

3. **内容库存和 gap analysis**
   - 爬品牌官网和竞品官网，抽产品页、FAQ、临床证据、白皮书、医生/患者教育内容。
   - 和 AI 回答缺口相连：AI 没说对，是因为站点没有，还是有但没被引用。

### P2：R&D 和产品化

1. **agentic optimizer lab**
   - 参考 AgenticGEO/MAGEO/AutoGEO。
   - 不直接自动发稿，先生成改写建议和实验版本。
   - 用监测结果验证：可见度、准确度、引用份额、推荐转化力是否提升。

2. **CI / GitHub Action**
   - 对官网内容 repo 或知识库 repo 做 PR gate：llms.txt/schema/readiness 不能退化。
   - 对监测结果做 nightly report。

3. **客户栈插件**
   - WordPress、docs、静态站、Magento 等可后置。
   - 先把 generator 做好，再适配插件。

## 推荐融合路线

### Phase 1：补齐 AI 可发现性工程层

新增目录：

```text
site_audit/
  crawler.js
  llms_txt_generator.js
  readiness_rules.js
  source_authority_catalog.json
  build_site_audit_dashboard.js
```

新增命令：

```json
{
  "site:audit": "node site_audit/crawler.js",
  "site:llms": "node site_audit/llms_txt_generator.js",
  "site:dashboard": "node site_audit/build_site_audit_dashboard.js"
}
```

输出：

```text
monitor_runs/<timestamp>_site_audit/
  pages.json
  llms.txt
  llms-full.txt
  readiness_summary.json
  source_assets.json
  site_audit_dashboard.html
```

### Phase 2：把监测 dashboard 升级成多 run 品牌资产 dashboard

新增：

```text
monitor_runs/runs_index.json
monitor_runs/brand_asset_catalog.json
monitor_runs/source_authority_catalog.json
```

Dashboard 新增视图：

- 趋势：答案可见度、认知准确度、证据纳入度、推荐转化力。
- 竞品：回答 SOV、引用 SOV、竞品官方/高权重来源排行。
- 意图：每类用户意图是否覆盖关键问题。
- 来源：官方/监管/学术/媒体/社区/竞品来源比例。
- 缺口：AI 没覆盖的品牌资产、官网没提供的证据、被竞品抢走的来源。

### Phase 3：内容优化实验

新增：

```text
optimizer_lab/
  candidate_generator.js
  evaluator.js
  fidelity_guard.js
  experiment_runner.js
```

流程：

1. 从 dashboard 识别低分意图和被竞品压制的问题。
2. 从 site audit 找到对应页面或内容缺口。
3. 生成改写建议，不直接发布。
4. 维护实验组/对照组 prompt matrix。
5. 跑监测，比较是否提升。

## 当前是否“已经做全”

没有。更准确的判断是：

- **品牌 AI 回答监测**：已经做到了可用的早期产品原型，而且比很多泛泛的 tracker 更适合国内平台和医疗品牌分析。
- **竞品和引用分析**：已经有正确方向，但需要 source authority catalog 和多 run 趋势才能变成稳定系统。
- **真实用户意图**：已经开始，并且 WildChat 路线合理；下一步是结构化 intent library。
- **技术 GEO / AEO 工程层**：基本还没做，这是和大量开源项目相比最大的缺口。
- **内容优化闭环**：还没做，建议后置到审计和数据层稳定之后。

## 源与检索入口

- GitHub topic: [generative-engine-optimization](https://github.com/topics/generative-engine-optimization)
- GitHub topic: [ai-visibility](https://github.com/topics/ai-visibility)
- GitHub topic: [answer-engine-optimization](https://github.com/topics/answer-engine-optimization)
- GitHub topic: [llms-txt](https://github.com/topics/llms-txt)
- 本地表格：`tools/技术改造-github_geo_aio_llm_optimization_repos.xlsx`

