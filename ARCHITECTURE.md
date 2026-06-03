# GEO Access Architecture

Last updated: 2026-06-03

本项目用于监测美敦力 Medtronic 在 AI 问答平台中的 GEO 表现，并把原始回答、引用来源、竞品声量、真实用户意图和公关写作规则融合成品牌部可直接查看的 dashboard。

## 目标

- 监测 AI 平台回答中是否找得到美敦力。
- 判断 AI 是否说得对、证据是否可靠、是否愿意推荐。
- 扫描竞品在回答和引用来源中的 share-of-voice。
- 从真实用户问题中抽取意图范式，发现当前 prompt 库缺口。
- 把监测结果转成可执行的官方资料、FAQ、证据页和稿件 brief。

## 总体数据流

```text
Prompt Matrix / Intent Spec
  -> Playwright Monitor
  -> monitor_runs/<run> 原始文本 / HTML / 截图 / 引用 JSON
  -> GEO Analysis / Competitive Analysis
  -> Yuanbao Optimization / MiniMed Intent Lab / WildChat Archetypes / PR Digest
  -> Unified Dashboard
```

## 主要模块

### 采集层

- `monitor/playwright_monitor.js`
  - 使用 Playwright 专用 Chromium，不控制前台 Chrome。
  - 登录态持久化在 `~/.geo_access_playwright_profile`。
  - 支持单次、循环、问题矩阵批量监测。
  - 保存回答文本、HTML、截图、引用清单和 summary。

- `monitor/cdp_dom_monitor.js`
  - 早期 CDP/DOM 探测方案，保留为调试参考。

### 分析层

- `monitor/analyze_geo.js`
  - 调用 DeepSeek API 做逐回答 GEO 评分。
  - 四项核心指标：答案可见度、认知准确度、证据纳入度、推荐转化力。

- `monitor/competitive_geo.js`
  - 本地规则扫描回答和引用来源。
  - 计算美敦力与竞品 answer/source share-of-voice。
  - 标记竞品领先、竞品高权重引用、缺少美敦力官方来源等风险。

### 优化层

- `monitor/yuanbao_geo_optimizer.js`
  - 聚焦腾讯元宝，把监测结果转为技术改造和内容资产建议。
  - 输出产品线缺口、官方引用缺口、竞品引用风险、文章/FAQ brief。
  - 可选调用 DeepSeek API 做策略归纳；不传模型开关时使用本地确定性规则。

- `monitor/intention_lab.js`
  - MiniMed 竞品意图实验。
  - 根据竞品和意图规格生成问题，评估 performance 与关键 intention 覆盖。

- `tools/pr_guideline_digest.py`
  - 从本地公关稿件指南提取可提交的摘要规则。
  - 原始 PDF/PPTX 不进 GitHub，只保留医疗合规和 GEO 写作规则摘要。

### 意图库层

- `tools/wildchat_download.py`
  - 下载 WildChat-1M，支持断点续传和镜像回退。

- `tools/wildchat_purchase_archetypes.py`
  - 从真实 WildChat 用户问题中抽取购买/选择意图范式。
  - 本地轻量扫描 parquet，不跑本地 LLM，不做大规模 embedding。

- `tools/wildchat_deepseek_synthesis.py`
  - 用 DeepSeek 对 WildChat 候选样本做噪音剔除、范式归纳和 Medtronic/MiniMed prompt 映射。

## Unified Dashboard

统一看板由 `monitor/build_unified_dashboard.js` 生成：

```text
monitor_runs/unified_dashboard.html
monitor_runs/unified_dashboard_summary.json
```

它融合以下输入：

- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/geo_analysis_summary.json`
- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/competitive_geo_summary.json`
- `monitor_runs/yuanbao_medtronic_optimization/yuanbao_geo_optimization.json`
- `monitor_runs/2026-05-30T16-25-01-295Z_minimed_intent_lab/intent_coverage_summary.json`
- `monitor_runs/wildchat_purchase_archetypes/purchase_archetypes.json`
- `monitor_runs/wildchat_purchase_archetypes/deepseek_synthesis.json`
- `monitor_runs/pr_guideline_digest/pr_guideline_digest.json`
- `monitor_runs/open_source_geo_universe/repo_universe.json`

看板面向品牌部管理层，首屏保留：

- 管理层摘要。
- GEO 总分、证据纳入、回答 SOV、引用 SOV 等核心 KPI。
- 美敦力 vs 竞品的回答/引用份额可视化。
- 用户旅程 x 意图库缺口。
- 品牌风险雷达。

内部运行命令、API key、调试说明不写入最终 dashboard。

## 用户旅程意图库模型

`monitor/build_unified_dashboard.js` 内置 `JOURNEY_STAGES`，把 WildChat 真实问法映射到 6 个阶段：

| 阶段 | 用户真实问题 | 主要缺口判断 |
| --- | --- | --- |
| 需求定义 | 我到底该看什么方案，哪些指标重要？ | 非品牌泛问是否覆盖 |
| 候选清单 | AI 会把哪些品牌放进候选清单？ | 不点名美敦力时是否进入候选 |
| 方案比较 | 美敦力和竞品相比，谁更适合我？ | 适用/不适用人群和证据边界是否稳定 |
| 信任验证 | 安全、召回、风险和证据是否可信？ | 官方事实核验、监管/临床证据入口是否足够 |
| 价格可及 | 买不买得起，哪里买，医院能不能用？ | 医保、地区可及、医院采购、渠道路径是否拆细 |
| 使用服务 | 装上或买了之后，培训、维护、售后怎么办？ | 售后、耗材、故障、长期随访问题库是否充分 |

每个阶段会计算：

- `demandCount`：WildChat 真实需求信号数。
- `monitoredPrompts`：当前已监测问题数。
- `targetPrompts`：按真实需求强度推导的目标监测题量。
- `coverageDepth`：已测/目标。
- `avgGeoScore`：该阶段已测问题的平均 GEO 分。
- `officialGaps`：缺少官方引用的问题数。
- `riskCount`：风险标记数。
- `coverageScore` 和 `status`：阶段覆盖判断。

## 关键产物

- `monitor_runs/unified_dashboard.html`：最终 client-ready 看板。
- `monitor_runs/unified_dashboard_summary.json`：统一看板的结构化摘要，包含用户旅程缺口。
- `monitor_runs/yuanbao_medtronic_optimization/yuanbao_geo_optimization.html`：腾讯元宝技术改造看板。
- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/dashboard.html`：DeepSeek / 元宝问题矩阵看板。
- `monitor_runs/2026-05-30T16-25-01-295Z_minimed_intent_lab/intent_dashboard.html`：MiniMed 竞品意图实验看板。
- `monitor_runs/wildchat_purchase_archetypes/deepseek_synthesis.html`：WildChat 意图范式归纳。

## 安全与数据边界

- API key 只通过环境变量传入，不写入仓库。
- Playwright 使用专用 profile，不导出 Chrome cookie。
- 原始 WildChat parquet、PDF/PPTX、公关原始资料默认不提交。
- dashboard 可以提交；大体积原始数据、登录态、截图以外的敏感缓存不提交。
- 用户看到的最终 dashboard 不包含内部命令、模型 key 或调试日志。
