#!/usr/bin/env python3
"""Create a compact PR-writing rule digest from local guide documents.

The source PDFs/PPTX stay local. This script only stores metadata and distilled
rules so downstream GEO/content scripts can use the guidance without copying
large copyrighted passages into the repo.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = ROOT / "data" / "公关稿件指南"
DEFAULT_OUT_DIR = ROOT / "monitor_runs" / "pr_guideline_digest"


WRITING_RULES = [
    {
        "id": "think_like_reporter",
        "label": "像记者一样组织信息",
        "rule": "标题和导语先交代新闻事实、业务变化、用户/行业价值，再进入品牌表达。",
        "why": "企业稿件如果只有宣传口吻，难以成为媒体和AI可引用素材。",
    },
    {
        "id": "facts_before_adjectives",
        "label": "事实和数据先于形容词",
        "rule": "优先给出客观事实、可验证数据、适用场景、限制条件和来源；少用空泛赞美。",
        "why": "AI回答和媒体引用都更偏好结构化事实，而不是没有来源的描述。",
    },
    {
        "id": "human_quote",
        "label": "人物引言要补充判断",
        "rule": "高管/专家引言不要复述正文，应解释趋势、用户痛点、合作意义或下一步承诺。",
        "why": "有判断的人物表达比口号更能增强可信度。",
    },
    {
        "id": "plain_language",
        "label": "把专业术语翻译成人话",
        "rule": "医疗器械技术点要同时提供专业说法和患者/医生可理解的解释。",
        "why": "元宝这类AI回答会面向患者、家属、医生、医院采购等混合受众。",
    },
    {
        "id": "multi_asset_release",
        "label": "稿件不只是一篇文章",
        "rule": "同一主题应配套FAQ、事实表、证据清单、图片/图表说明、医生/患者版摘要。",
        "why": "AI更容易从结构化、多入口内容中抽取答案和引用。",
    },
    {
        "id": "risk_ready",
        "label": "风险问题预先给口径",
        "rule": "涉及召回、安全、费用、医保、数据隐私时，应提供事实边界、适用人群、风险提示和咨询路径。",
        "why": "回避负面问题会让AI引用第三方甚至竞品来源补空。",
    },
    {
        "id": "ai_human_review",
        "label": "AI生成内容必须人工复核",
        "rule": "AI可用于初稿、提纲、摘要和变体，但医疗事实、合规表述、数据、引用必须人工核验。",
        "why": "医疗器械传播存在事实错误、夸大宣传和声誉风险。",
    },
]


MEDICAL_COMPLIANCE_RULES = [
    "避免“最佳、最好、最先进、最高、第一、唯一”等绝对化或无法证明的表述。",
    "避免“根治、治愈率、安全无副作用、疗效最佳、药到病除”等医疗效果承诺。",
    "描述安全性时必须同时给出适用条件、风险提示和医生咨询路径。",
    "涉及患者案例、未成年人、疾病隐私、个体诊疗结果时必须匿名化并取得授权。",
    "涉及召回、投诉、负面舆情时要先核实事实，不用对抗性语言，不做无依据否认。",
    "对外发布前应经过医学、法规、法务、品牌/公关多方审核。",
]


FORBIDDEN_OR_RISKY_PATTERNS = [
    "最佳",
    "最好",
    "最先进",
    "最高技术",
    "根治",
    "治愈率",
    "安全无副作用",
    "疗效最佳",
    "药到病除",
    "无效退款",
    "绝对安全",
    "零风险",
    "立刻见效",
]


GEO_WRITING_RULES = [
    {
        "id": "citation_pack",
        "label": "给AI可引用的证据包",
        "rule": "每篇稿件至少拆出官方事实、临床/监管证据、适用场景、风险提示、FAQ五类信息块。",
    },
    {
        "id": "comparison_ready",
        "label": "主动写对比边界",
        "rule": "竞品问题不要只写自家优势，应写清美敦力适合什么、不适合什么、需要医生判断什么。",
    },
    {
        "id": "answer_shape",
        "label": "按AI答案形态写",
        "rule": "内容要能被AI直接抽成表格、决策树、清单、风险提示和下一步建议。",
    },
    {
        "id": "owned_source_first",
        "label": "优先补官方可抓取资产",
        "rule": "重要说法应能在官网新闻稿、产品FAQ、医生教育页或白皮书中找到官方来源。",
    },
]


KEYWORDS = [
    "标题",
    "导语",
    "引言",
    "数据",
    "事实",
    "媒体",
    "舆情",
    "声誉风险",
    "AI",
    "生成式AI",
    "禁用",
    "慎用",
    "医药",
    "安全",
    "审核",
]


def pdf_text(path: Path) -> str:
    import fitz  # type: ignore

    doc = fitz.open(path)
    return "\n".join(page.get_text("text") for page in doc)


def pptx_text(path: Path) -> str:
    parts: List[str] = []
    with zipfile.ZipFile(path) as zf:
        names = sorted(
            name
            for name in zf.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        )
        for name in names:
            root = ET.fromstring(zf.read(name))
            for node in root.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}t"):
                if node.text:
                    parts.append(node.text)
    return "\n".join(parts)


def read_document(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return pdf_text(path)
    if suffix == ".pptx":
        return pptx_text(path)
    return ""


def keyword_counts(text: str) -> Dict[str, int]:
    return {keyword: text.count(keyword) for keyword in KEYWORDS if text.count(keyword)}


def document_inventory(source_dir: Path) -> List[Dict]:
    docs: List[Dict] = []
    for path in sorted(source_dir.glob("*")):
        if not path.is_file() or path.suffix.lower() not in {".pdf", ".pptx"}:
            continue
        try:
            text = read_document(path)
            counts = keyword_counts(text)
            top = Counter(counts).most_common(6)
            docs.append(
                {
                    "file": path.name,
                    "suffix": path.suffix.lower(),
                    "size_bytes": path.stat().st_size,
                    "extracted_chars": len(text),
                    "top_keyword_counts": dict(top),
                }
            )
        except Exception as exc:  # pragma: no cover - diagnostic payload
            docs.append(
                {
                    "file": path.name,
                    "suffix": path.suffix.lower(),
                    "size_bytes": path.stat().st_size,
                    "error": str(exc),
                }
            )
    return docs


def build_digest(source_dir: Path) -> Dict:
    docs = document_inventory(source_dir)
    return {
        "created_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "source_dir": str(source_dir),
        "document_count": len(docs),
        "documents": docs,
        "writing_rules": WRITING_RULES,
        "geo_writing_rules": GEO_WRITING_RULES,
        "medical_compliance_rules": MEDICAL_COMPLIANCE_RULES,
        "forbidden_or_risky_patterns": FORBIDDEN_OR_RISKY_PATTERNS,
        "medtronic_application": [
            "元宝引用缺口应优先用官方事实表、医生FAQ、患者安全说明和证据清单补齐。",
            "MiniMed/心血管/结构心/外科产品稿件都应避免治疗效果承诺，突出适用边界和咨询路径。",
            "召回和负面新闻不能回避，应准备事实核验页、问答口径和第三方监管/临床来源链接。",
            "稿件要能拆成AI答案模块：一句话结论、对比表、证据、风险、适用人群、下一步。",
        ],
    }


def write_html(path: Path, digest: Dict) -> None:
    def rows(items: Iterable[Dict]) -> str:
        out = []
        for item in items:
            out.append(
                "<tr>"
                f"<td>{html.escape(item.get('file', ''))}</td>"
                f"<td>{html.escape(str(item.get('extracted_chars', item.get('error', ''))))}</td>"
                f"<td>{html.escape(json.dumps(item.get('top_keyword_counts', {}), ensure_ascii=False))}</td>"
                "</tr>"
            )
        return "\n".join(out)

    def cards(items: Iterable[Dict]) -> str:
        return "\n".join(
            f"<article><h3>{html.escape(item['label'])}</h3><p>{html.escape(item['rule'])}</p><small>{html.escape(item.get('why', ''))}</small></article>"
            for item in items
        )

    risk_items = "\n".join(f"<li>{html.escape(item)}</li>" for item in digest["medical_compliance_rules"])
    html_text = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>公关稿件指南 Digest</title>
  <style>
    body {{ margin:0; background:#f6f7f8; color:#172026; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }}
    header {{ background:#10201f; color:#fff; padding:28px; }}
    main {{ max-width:1120px; margin:0 auto; padding:24px; }}
    h1 {{ margin:0 0 8px; font-size:26px; }}
    h2 {{ margin:0 0 12px; font-size:20px; }}
    section {{ background:#fff; border:1px solid #dce2e7; border-radius:8px; padding:16px; margin-bottom:16px; }}
    .grid {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }}
    article {{ border:1px solid #dce2e7; background:#fbfcfd; border-radius:8px; padding:12px; }}
    h3 {{ margin:0 0 8px; font-size:15px; }}
    p {{ margin:6px 0; line-height:1.55; }}
    small {{ color:#64717d; }}
    table {{ width:100%; border-collapse:collapse; }}
    th,td {{ border-bottom:1px solid #dce2e7; padding:9px; text-align:left; vertical-align:top; font-size:13px; }}
    th {{ background:#f1f4f6; }}
    @media(max-width:800px) {{ .grid {{ grid-template-columns:1fr; }} main,header {{ padding-left:16px; padding-right:16px; }} }}
  </style>
</head>
<body>
  <header><h1>公关稿件指南 Digest</h1><p>只保存摘要化规则，不复制原始资料正文。生成时间：{html.escape(digest['created_at'])}</p></header>
  <main>
    <section><h2>写作规则</h2><div class="grid">{cards(digest['writing_rules'])}</div></section>
    <section><h2>GEO 写作规则</h2><div class="grid">{cards(digest['geo_writing_rules'])}</div></section>
    <section><h2>医疗/合规风险</h2><ul>{risk_items}</ul></section>
    <section><h2>资料索引</h2><table><thead><tr><th>文件</th><th>抽取字符</th><th>关键词</th></tr></thead><tbody>{rows(digest['documents'])}</tbody></table></section>
  </main>
</body>
</html>
"""
    path.write_text(html_text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build compact PR guide digest.")
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    digest = build_digest(args.source_dir)
    json_path = args.out_dir / "pr_guideline_digest.json"
    html_path = args.out_dir / "pr_guideline_digest.html"
    json_path.write_text(json.dumps(digest, ensure_ascii=False, indent=2), encoding="utf-8")
    write_html(html_path, digest)
    print(f"pr_guideline_digest_saved {json_path}")
    print(f"pr_guideline_digest_html {html_path}")


if __name__ == "__main__":
    main()
