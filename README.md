# GEO Access

美敦力 Medtronic 在 DeepSeek、腾讯元宝、豆包等 AI 平台中的 GEO 表现监测与报告资产。

## 当前主要产物

- `GEO评估报告_美敦力Medtronic_豆包DeepSeek腾讯元宝.html`: 初版综合报告。
- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/dashboard.html`: DeepSeek 与腾讯元宝问题矩阵 dashboard。
- `monitor_runs/2026-05-28T03-16-25-378Z_prompt_matrix/geo_analysis_summary.json`: 基于 DeepSeek API 的逐回答 GEO 分析汇总。
- `monitor_runs/prompt_matrix.txt`: 监测问题矩阵。

## 常用命令

```bash
npm install
npm run monitor:login
npm run monitor:matrix
DEEPSEEK_API_KEY=... npm run analyze:geo
npm run dashboard:matrix
```

`DEEPSEEK_API_KEY` 只通过环境变量传入，不要写入仓库。
