# GEO Access

美敦力 Medtronic 在 DeepSeek、腾讯元宝、豆包等 AI 平台中的 GEO 表现监测与报告资产。

## 当前主要产物

- `GEO评估报告_美敦力Medtronic_豆包DeepSeek腾讯元宝.html`: 初版综合报告。
- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/dashboard.html`: DeepSeek 与腾讯元宝问题矩阵 dashboard。
- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/geo_analysis_summary.json`: 基于 DeepSeek API 的逐回答 GEO 分析汇总。
- `monitor_runs/yuanbao_medtronic_optimization/yuanbao_geo_optimization.html`: 聚焦腾讯元宝的美敦力 GEO 技术改造 dashboard，包含补源、稿件 brief、竞品引用风险和下一轮监测问题。
- `monitor_runs/pr_guideline_digest/pr_guideline_digest.html`: 从本地公关稿件指南抽取的摘要化写作规则。
- `monitor_runs/wildchat_purchase_archetypes/deepseek_synthesis.html`: 基于真实 WildChat 样本归纳的购买/选择意图范式 dashboard。
- `monitor_runs/wildchat_purchase_archetypes/medtronic_prompt_matrix_from_archetypes.txt`: 由购买意图范式映射出的 MiniMed GEO 监测问题。
- `monitor_runs/prompt_matrix.txt`: 监测问题矩阵。

## 常用命令

```bash
npm install
npm run monitor:login
npm run monitor:matrix
DEEPSEEK_API_KEY=... npm run analyze:geo
npm run analyze:competitive
npm run dashboard:matrix
npm run digest:pr
GEO_OPTIMIZER_USE_LLM=1 DEEPSEEK_API_KEY=... npm run optimize:yuanbao
```

`DEEPSEEK_API_KEY` 只通过环境变量传入，不要写入仓库。

## 下载 WildChat

完整 WildChat-1M 约 3GB，原始数据默认下载到 `data/wildchat/raw/`，该目录不会提交到 GitHub。

```bash
python3 -m pip install -r requirements-wildchat.txt
python3 tools/wildchat_download.py --repo_id allenai/WildChat-1M --repo_type dataset --mirror
python3 tools/wildchat_extract_intents.py --limit 500
python3 tools/wildchat_intent_archetypes.py --per-intent 60
python3 tools/wildchat_purchase_archetypes.py --per-archetype 18 --max-conversations 100000
DEEPSEEK_API_KEY=... python3 tools/wildchat_deepseek_synthesis.py
```

如果 aliendao mirror 不可用，下载器会自动回退到 Hugging Face `snapshot_download`，并保留断点续传缓存。

当前本机手工下载的数据目录是 `data/WildChat/`。该目录包含大体积 parquet，已在 `.gitignore` 中排除，不要提交原始数据。
