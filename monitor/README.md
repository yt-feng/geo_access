# GEO 后台监测

本目录使用 Playwright 专用 Chromium 监测豆包、DeepSeek、腾讯元宝。

它不使用 AppleScript，不发送系统键盘事件，不控制前台 Chrome，也不解密或导出 Chrome cookie。

## 第一次使用

在本机终端进入 repo：

```bash
cd /Users/ytfeng/Code_Pj/geo_access
npm run monitor:login
```

这会打开一个 Playwright Chromium 窗口。请在这个专用窗口里登录：

- https://www.doubao.com/chat/
- https://chat.deepseek.com/
- https://yuanbao.tencent.com/chat/naQivTmsDa

登录完成后关闭这个 Chromium 窗口即可。登录态保存在：

```text
~/.geo_access_playwright_profile
```

这个目录会被后续 `monitor:once` / `monitor:loop` 复用，所以不需要每次重新登录。除非平台主动让登录态失效、改密码、清 profile，才需要重登。

## 解除验证

如果 `summary.json` 里豆包状态是 `captcha_required`，打开专用 Chromium 手动解除一次：

```bash
cd /Users/ytfeng/Code_Pj/geo_access
npm run monitor:unlock -- doubao
```

这仍然使用同一个 `~/.geo_access_playwright_profile`，解除后的状态会持久化到后续后台监测。

## 单次监测

```bash
cd /Users/ytfeng/Code_Pj/geo_access
npm run monitor:once
```

输出会保存到：

```text
monitor_runs/<timestamp>/
```

每个平台会生成：

- `<platform>.txt`
- `<platform>.html`
- `<platform>.png`
- `<platform>_references.txt`
- `<platform>_references.json`

`summary.json` 会记录每个平台的 `status`：

- `ok`：已等到回答稳定后保存。
- `ok_no_references_detected`：回答已稳定，但没有识别到可见资料引用清单。
- `captcha_required`：页面触发验证码，需要用 `monitor:unlock` 人工解除。
- `login_required`：登录态失效，需要重新跑 `monitor:login`。
- `timeout`：到达最长等待时间，页面仍未满足完成条件。

元宝会额外等待流式输出结束；如果检测到资料引用清单、`源` 面板、段落引用标记、结构化引用条目或引用链接，会一起保存到 `_references.*`。默认最长等待 240 秒，可调整：

```bash
GEO_YUANBAO_TIMEOUT_MS=300000 npm run monitor:once
```

只跑某个平台排查时：

```bash
GEO_MONITOR_PLATFORMS=yuanbao npm run monitor:once
```

元宝专用快捷命令：

```bash
npm run monitor:yuanbao
```

## 问题矩阵批量监测

默认读取：

```text
monitor_runs/prompt_matrix.txt
```

只跑 DeepSeek 和腾讯元宝：

```bash
npm run monitor:matrix
```

每个问题会保存到独立目录：

```text
monitor_runs/<timestamp>_prompt_matrix/q01/
monitor_runs/<timestamp>_prompt_matrix/q02/
...
```

批量总表：

```text
monitor_runs/<timestamp>_prompt_matrix/summary.json
monitor_runs/<timestamp>_prompt_matrix/matrix_summary.csv
```

## 品牌化 GEO 逐回答分析

对批量采集结果逐条打分，指标包括：

- 答案可见度
- 认知准确度
- 证据纳入度
- 推荐转化力

运行前把 DeepSeek API key 放到环境变量，不要写进仓库：

```bash
DEEPSEEK_API_KEY=... npm run analyze:geo
npm run analyze:competitive
npm run dashboard:matrix
```

输出会保存到：

```text
monitor_runs/<timestamp>_prompt_matrix/geo_analysis_summary.json
monitor_runs/<timestamp>_prompt_matrix/competitive_geo_summary.json
monitor_runs/<timestamp>_prompt_matrix/q01/deepseek_geo_analysis.json
monitor_runs/<timestamp>_prompt_matrix/q01/yuanbao_geo_analysis.json
```

`analyze:competitive` 不调用模型，会基于本地回答文本和 `_references.json` 统计：

- 美敦力与竞品在回答中的 share-of-voice。
- 美敦力与竞品在引用来源中的加权证据份额。
- 竞品官方来源、监管/临床/学术来源、医疗媒体/公众号等 source authority。
- 回答可见度由竞品领先、引用证据偏向竞品、缺少美敦力官方来源等风险。

`dashboard:matrix` 会自动内联这套竞品 GEO 扫描结果，并同步写出 `competitive_geo_summary.json`。

## 腾讯元宝 GEO 技术改造输出

先把本地公关稿件指南抽成摘要化规则，不提交原始 PDF/PPTX：

```bash
npm run digest:pr
```

再聚焦腾讯元宝生成美敦力优化 dashboard：

```bash
GEO_OPTIMIZER_USE_LLM=1 DEEPSEEK_API_KEY=... npm run optimize:yuanbao
```

如果不传 `GEO_OPTIMIZER_USE_LLM=1`，会用本地规则生成确定性版本；传入后会调用 DeepSeek API 做稿件策略归纳。输出：

```text
monitor_runs/pr_guideline_digest/pr_guideline_digest.html
monitor_runs/yuanbao_medtronic_optimization/yuanbao_geo_optimization.html
monitor_runs/yuanbao_medtronic_optimization/yuanbao_geo_optimization.json
monitor_runs/yuanbao_medtronic_optimization/article_briefs.json
```

这个 dashboard 会把元宝监测结果转成：

- 产品线和问题层面的官方引用缺口。
- 竞品提及与竞品来源权重风险。
- 需要补的官方事实表、FAQ、临床/监管证据、风险口径。
- 符合公关稿件指南的文章/资产 brief。
- 下一轮应投喂腾讯元宝验证的监测 prompt。

## MiniMed 意图覆盖实验

本实验先选 WildChat 作为用户意图数据源适配方向。当前小样本版使用 WildChat-style fallback seed，生成 MiniMed 主要竞品的测试问题；网络可访问 Hugging Face 后，可以把 seed 替换成真实 WildChat 用户问题抽样。

下载真实 WildChat：

```bash
python3 -m pip install -r requirements-wildchat.txt
python3 tools/wildchat_download.py --repo_id allenai/WildChat-1M --repo_type dataset --mirror
python3 tools/wildchat_extract_intents.py --limit 500
python3 tools/wildchat_intent_archetypes.py --per-intent 60
```

从真实 WildChat 抽取跨行业购买/选择意图范式，并用 DeepSeek 做噪音剔除和归纳：

```bash
python3 tools/wildchat_purchase_archetypes.py --per-archetype 18 --max-conversations 100000
DEEPSEEK_API_KEY=... python3 tools/wildchat_deepseek_synthesis.py
```

输出：

```text
monitor_runs/wildchat_purchase_archetypes/purchase_archetypes.html
monitor_runs/wildchat_purchase_archetypes/deepseek_synthesis.html
monitor_runs/wildchat_purchase_archetypes/medtronic_prompt_matrix_from_archetypes.txt
```

生成 MiniMed 竞品/意图问题：

```bash
npm run intent:minimed:prepare
```

只跑腾讯元宝：

```bash
npm run monitor:minimed:yuanbao
```

计算 performance 和关键 intention 覆盖，并生成 dashboard：

```bash
npm run intent:minimed:score
```

输出会保存到：

```text
monitor_runs/<timestamp>_minimed_intent_lab/intent_dashboard.html
monitor_runs/<timestamp>_minimed_intent_lab/intent_coverage_summary.json
monitor_runs/<timestamp>_minimed_intent_lab/intent_coverage_summary.csv
```

## 循环监测

默认 360 分钟跑一次：

```bash
cd /Users/ytfeng/Code_Pj/geo_access
npm run monitor:loop
```

自定义间隔：

```bash
GEO_MONITOR_INTERVAL_MINUTES=60 npm run monitor:loop
```

## 注意

不要使用旧的 `AppleScript` 方案做长期监测；它会抢前台窗口。

不要使用 `Google Chrome.app --headless`，这台机器上会触发 Chrome 崩溃弹窗。Playwright Chromium 在 sandbox 外验证可用。
