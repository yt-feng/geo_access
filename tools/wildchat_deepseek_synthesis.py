#!/usr/bin/env python3
"""
Use DeepSeek API to synthesize clean buyer-intent archetypes from sampled WildChat rows.

The API key is read only from DEEPSEEK_API_KEY. It is never written to output files.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IN = ROOT / "monitor_runs" / "wildchat_purchase_archetypes" / "purchase_archetypes.json"
DEFAULT_OUT_DIR = ROOT / "monitor_runs" / "wildchat_purchase_archetypes"


def compact_input(data: Dict[str, Any], examples_per_archetype: int, chars_per_example: int) -> Dict[str, Any]:
    items = []
    for archetype in data["archetypes"]:
        examples = []
        for example in archetype.get("examples", [])[:examples_per_archetype]:
            text = example.get("text", "")
            if len(text) > chars_per_example:
                text = text[:chars_per_example].rstrip() + "..."
            examples.append({
                "domain": example.get("domain_label"),
                "language": example.get("language"),
                "text": text,
            })
        items.append({
            "id": archetype["id"],
            "label": archetype["label"],
            "stage": archetype["stage"],
            "candidate_pattern": archetype["user_pattern"],
            "candidate_need": archetype["hidden_need"],
            "candidate_geo_risk": archetype["geo_risk"],
            "candidate_medtronic_prompts": archetype["medtronic_prompts"],
            "observed_match_count": archetype["observed_match_count"],
            "examples": examples,
        })
    return {
        "summary": data["summary"],
        "candidate_archetypes": items,
    }


def build_messages(compact: Dict[str, Any]) -> List[Dict[str, str]]:
    schema = {
        "executive_summary": ["string"],
        "methodology_note": "string",
        "archetypes": [
            {
                "id": "string",
                "label": "string",
                "decision_stage": "string",
                "confidence": "high|medium|low",
                "classic_user_phrasings": ["string"],
                "what_user_really_needs": ["string"],
                "purchase_considerations": ["string"],
                "clean_wildchat_examples": [{"domain": "string", "text": "string"}],
                "noise_to_exclude": ["string"],
                "medtronic_minimed_monitoring_prompts": ["string"],
                "geo_metric_mapping": {
                    "答案可见度": "string",
                    "认知准确度": "string",
                    "证据纳入度": "string",
                    "推荐转化力": "string",
                },
            }
        ],
        "medtronic_priority_prompt_matrix": ["string"],
        "next_monitoring_suggestions": ["string"],
    }
    user_prompt = f"""你是品牌 GEO 研究员。请基于下面从 WildChat 抽出的候选样本，归纳“购买/选择意图”的经典范式，并映射到美敦力 Medtronic / MiniMed 的 GEO 监测。

重要要求：
1. 候选样本有噪音，请主动丢弃考试题、改写任务、代码实现、纯娱乐推荐、非购买决策内容。
2. 不要把候选分类机械照抄；请归纳真实用户在购买、选择、比较、风险、价格、渠道、售后中的稳定问法。
3. 每个范式最多保留 3 条 clean_wildchat_examples，只能来自输入样本；如果样本不干净，可以少写或留空。
4. Medtronic/MiniMed 监测 prompt 要可直接拿去问元宝/DeepSeek，覆盖非品牌泛问、竞品比较、风险安全、渠道和售后。
5. 输出必须是完整 JSON，不要 Markdown，不要注释，不要尾逗号。
6. 字符串尽量短；每个数组最多 5 项。

JSON schema:
{json.dumps(schema, ensure_ascii=False, indent=2)}

候选输入：
{json.dumps(compact, ensure_ascii=False, indent=2)}
"""
    return [
        {"role": "system", "content": "You are a rigorous GEO and consumer-intent analyst. Output valid JSON only."},
        {"role": "user", "content": user_prompt},
    ]


def call_deepseek(messages: List[Dict[str, str]], model: str, base_url: str, timeout: int) -> Dict[str, Any]:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set")

    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 6500,
        "response_format": {"type": "json_object"},
        "stream": False,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"DeepSeek API HTTP {exc.code}: {exc.read().decode('utf-8')[:1000]}") from exc
    content = payload["choices"][0]["message"]["content"]
    return {
        "model": payload.get("model", model),
        "usage": payload.get("usage"),
        "analysis": parse_json(content),
    }


def parse_json(content: str) -> Dict[str, Any]:
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start < 0 or end < 0 or end <= start:
            raise
        return json.loads(content[start:end + 1])


def write_markdown(result: Dict[str, Any]) -> str:
    analysis = result["analysis"]
    lines = [
        "# WildChat 购买意图范式 DeepSeek 归纳",
        "",
        f"- 模型: {result.get('model')}",
        f"- 生成时间: {result.get('created_at')}",
        "",
        "## 总结",
        "",
    ]
    for item in analysis.get("executive_summary", []):
        lines.append(f"- {item}")
    lines.extend(["", "## 范式"])
    for archetype in analysis.get("archetypes", []):
        lines.extend([
            "",
            f"### {archetype.get('label')}",
            "",
            f"- 阶段: {archetype.get('decision_stage')}",
            f"- 置信度: {archetype.get('confidence')}",
            "",
            "**经典问法**",
        ])
        for text in archetype.get("classic_user_phrasings", []):
            lines.append(f"- {text}")
        lines.append("")
        lines.append("**用户真实需求**")
        for text in archetype.get("what_user_really_needs", []):
            lines.append(f"- {text}")
        lines.append("")
        lines.append("**Medtronic/MiniMed 监测 prompt**")
        for text in archetype.get("medtronic_minimed_monitoring_prompts", []):
            lines.append(f"- {text}")
        lines.append("")
        lines.append("**干净 WildChat 样例**")
        for example in archetype.get("clean_wildchat_examples", []):
            lines.append(f"- [{example.get('domain')}] {example.get('text')}")
    lines.extend(["", "## Prompt Matrix", ""])
    for i, prompt in enumerate(analysis.get("medtronic_priority_prompt_matrix", []), 1):
        lines.append(f"{i:02d}. {prompt}")
    return "\n".join(lines)


def write_html(result: Dict[str, Any]) -> str:
    analysis = result["analysis"]
    summary_items = "".join(f"<li>{html.escape(str(item))}</li>" for item in analysis.get("executive_summary", []))
    cards = []
    for archetype in analysis.get("archetypes", []):
        phrasing = "".join(f"<li>{html.escape(str(x))}</li>" for x in archetype.get("classic_user_phrasings", []))
        needs = "".join(f"<li>{html.escape(str(x))}</li>" for x in archetype.get("what_user_really_needs", []))
        prompts = "".join(f"<li>{html.escape(str(x))}</li>" for x in archetype.get("medtronic_minimed_monitoring_prompts", []))
        examples = "".join(
            f"<li><span>{html.escape(str(e.get('domain')))}</span>{html.escape(str(e.get('text')))}</li>"
            for e in archetype.get("clean_wildchat_examples", [])
        )
        metrics = "".join(
            f"<div><b>{html.escape(str(k))}</b><p>{html.escape(str(v))}</p></div>"
            for k, v in archetype.get("geo_metric_mapping", {}).items()
        )
        cards.append(f"""
        <section class="card">
          <div class="head">
            <div>
              <span>{html.escape(str(archetype.get('decision_stage', '')))}</span>
              <h2>{html.escape(str(archetype.get('label', '')))}</h2>
            </div>
            <strong>{html.escape(str(archetype.get('confidence', '')))}</strong>
          </div>
          <h3>经典问法</h3><ul>{phrasing}</ul>
          <h3>用户真实需求</h3><ul>{needs}</ul>
          <h3>Medtronic/MiniMed 监测 Prompt</h3><ol>{prompts}</ol>
          <h3>四项核心指标</h3><div class="metricgrid">{metrics}</div>
          <h3>干净 WildChat 样例</h3><ol class="examples">{examples}</ol>
        </section>
        """)
    matrix = "".join(f"<li>{html.escape(str(x))}</li>" for x in analysis.get("medtronic_priority_prompt_matrix", []))
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WildChat 购买意图范式 DeepSeek 归纳</title>
  <style>
    body {{ margin:0; background:#f6f7f9; color:#1f2933; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; line-height:1.56; }}
    header {{ background:#fff; border-bottom:1px solid #dfe5ec; padding:30px 40px; }}
    main {{ max-width:1240px; margin:0 auto; padding:24px 40px 48px; }}
    h1 {{ margin:0 0 8px; font-size:28px; letter-spacing:0; }}
    h2 {{ margin:0; font-size:20px; }}
    h3 {{ margin:14px 0 6px; font-size:14px; color:#314252; }}
    p {{ margin:0; color:#667381; }}
    .panel, .card {{ background:#fff; border:1px solid #dfe5ec; border-radius:8px; padding:16px; margin-bottom:16px; }}
    .head {{ display:flex; justify-content:space-between; gap:16px; }}
    .head span {{ color:#667381; font-size:12px; text-transform:uppercase; }}
    .head strong {{ color:#176b87; }}
    ul, ol {{ margin:6px 0 0; padding-left:22px; }}
    li {{ margin:5px 0; }}
    .metricgrid {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }}
    .metricgrid div {{ border:1px solid #dfe5ec; border-radius:8px; padding:10px; background:#fbfcfd; }}
    .metricgrid p {{ font-size:13px; margin-top:4px; }}
    .examples span {{ display:inline-block; min-width:96px; color:#7a4d16; font-size:12px; }}
    @media (max-width:860px) {{ header, main {{ padding-left:18px; padding-right:18px; }} .metricgrid {{ grid-template-columns:1fr; }} }}
  </style>
</head>
<body>
  <header>
    <h1>WildChat 购买意图范式 DeepSeek 归纳</h1>
    <p>基于真实 WildChat 候选样本，由 DeepSeek 做噪音剔除、范式归纳和 Medtronic/MiniMed GEO 监测映射。</p>
  </header>
  <main>
    <section class="panel"><h2>总结</h2><ul>{summary_items}</ul></section>
    {''.join(cards)}
    <section class="panel"><h2>优先 Prompt Matrix</h2><ol>{matrix}</ol></section>
  </main>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesize WildChat buyer-intent archetypes with DeepSeek.")
    parser.add_argument("--input", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--model", default=os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"))
    parser.add_argument("--base-url", default=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
    parser.add_argument("--examples-per-archetype", type=int, default=10)
    parser.add_argument("--chars-per-example", type=int, default=360)
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--write-request-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    compact = compact_input(source, args.examples_per_archetype, args.chars_per_example)
    messages = build_messages(compact)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    request_payload = {"model": args.model, "messages": messages, "temperature": 0.1, "max_tokens": 6500, "response_format": {"type": "json_object"}, "stream": False}
    (args.out_dir / "deepseek_synthesis_request.json").write_text(json.dumps(request_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.write_request_only:
        print(json.dumps({"request": str(args.out_dir / "deepseek_synthesis_request.json")}, ensure_ascii=False))
        return
    result = call_deepseek(messages, args.model, args.base_url, args.timeout)
    result["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    (args.out_dir / "deepseek_synthesis.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.out_dir / "deepseek_synthesis.md").write_text(write_markdown(result), encoding="utf-8")
    (args.out_dir / "deepseek_synthesis.html").write_text(write_html(result), encoding="utf-8")
    print(json.dumps({
        "out_dir": str(args.out_dir),
        "model": result.get("model"),
        "archetypes": len(result["analysis"].get("archetypes", [])),
        "prompt_matrix": len(result["analysis"].get("medtronic_priority_prompt_matrix", [])),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
