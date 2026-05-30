#!/usr/bin/env python3
"""
Mine generic commercial/user-decision intent archetypes from local WildChat parquet.

This does not try to solve one brand directly. It extracts real user phrasings
around purchase, comparison, recommendation, price, safety, alternatives, and
post-purchase support, then turns them into reusable GEO prompt archetypes.
"""

import argparse
import html
import json
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL_DIR = ROOT / "data" / "WildChat"
DEFAULT_OUT_DIR = ROOT / "monitor_runs" / "wildchat_intent_archetypes"


INTENTS = {
    "purchase_decision": {
        "label": "购买决策",
        "goal": "用户准备买/采购某个对象，想知道怎么决策。",
        "patterns": [
            r"\bshould i buy\b", r"\bcan i buy\b", r"\bwhere can i buy\b", r"\bbuy\b", r"\bpurchase\b", r"\border\b",
            r"\bworth buying\b", r"\bis .* worth it\b", r"购买", r"买.*吗", r"值得买",
            r"入手", r"采购", r"下单",
        ],
        "geo_template": "我准备购买/采购【品类/产品】，在【场景/预算/人群】下应该怎么选？请给出推荐优先级、关键风险、替代方案和下一步。",
    },
    "compare_options": {
        "label": "方案/品牌对比",
        "goal": "用户已经有 2 个以上候选，需要横向比较。",
        "patterns": [
            r"\bcompare\b", r"\bcomparison\b", r"\bversus\b", r"\bvs\.?\b", r"\bwhich (one )?is better\b",
            r"\bdifference between\b", r"对比", r"比较", r"区别",
            r"哪个好", r"哪一个更好", r"相比", r"和.*比",
        ],
        "geo_template": "【品牌A/产品A】和【品牌B/产品B】怎么选？请从性能、价格、风险、适用人群、售后和证据来源做对比。",
    },
    "recommendation": {
        "label": "推荐/榜单",
        "goal": "用户没有固定候选，希望 AI 推荐。",
        "patterns": [
            r"\brecommend\b", r"\brecommendation\b", r"\bbest (.+ )?(tool|app|software|product|service|brand|device|phone|laptop|camera|hotel|restaurant|option|choice)\b",
            r"\btop (.+ )?(tool|app|software|product|service|brand|device|phone|laptop|camera|hotel|restaurant|option|choice)s?\b",
            r"\bwhat.*should i use\b",
            r"\bwhat.*should i choose\b", r"推荐", r"最好", r"排名", r"榜单", r"优先了解",
            r"应该选", r"适合我",
        ],
        "geo_template": "如果我要解决【任务/疾病/场景】，有哪些品牌/产品值得优先了解？请按推荐优先级排序并说明理由。",
    },
    "price_value": {
        "label": "价格/预算/性价比",
        "goal": "用户围绕价格、预算、ROI、医保/保险、是否划算提问。",
        "patterns": [
            r"\bprice\b", r"\bcost\b", r"\bbudget\b", r"\bcheap\b", r"\bexpensive\b",
            r"\bworth the money\b", r"\broi\b", r"\binsurance\b", r"\bcovered\b",
            r"价格", r"多少钱", r"费用", r"预算", r"性价比", r"划算", r"医保", r"报销",
        ],
        "geo_template": "【产品/服务】大概多少钱？哪些费用项最关键？在【预算/医保/采购限制】下是否划算，有哪些低成本替代方案？",
    },
    "risk_safety": {
        "label": "风险/安全/负面顾虑",
        "goal": "用户担心安全、质量、失败率、副作用、召回、隐私或合规风险。",
        "patterns": [
            r"\bsafe\b", r"\bsafety\b", r"\brisk\b", r"\bdanger\b", r"\bside effect\b",
            r"\breliable\b", r"\brecall\b", r"\bprivacy\b", r"\bcompliance\b", r"\bscam\b",
            r"安全吗", r"风险", r"副作用", r"召回", r"质量", r"可靠", r"隐私", r"合规",
        ],
        "geo_template": "【品牌/产品】安全吗？有哪些常见风险、负面新闻或使用限制？与替代方案相比风险是否可接受？",
    },
    "alternatives": {
        "label": "替代方案",
        "goal": "用户想知道不用某品牌/产品时还有什么选择。",
        "patterns": [
            r"\balternative(?:s)? (?:to|for)\b", r"\bsubstitute (?:for|to)\b", r"\breplace\b",
            r"\binstead of\b", r"替代", r"平替", r"不用.*可以",
            r"类似", r"取代", r"备选",
        ],
        "geo_template": "如果不选【品牌/产品】，有哪些替代方案？请说明各自适用场景、代价、风险和不适合的人群。",
    },
    "how_to_choose": {
        "label": "选择标准/决策清单",
        "goal": "用户想知道选择时应考虑哪些因素。",
        "patterns": [
            r"\bhow to choose\b", r"\bwhat should i consider\b", r"\bfactors\b",
            r"\bcriteria\b", r"\bchecklist\b", r"怎么选", r"如何选择",
            r"考虑哪些", r"判断标准", r"选型", r"决策", r"清单",
        ],
        "geo_template": "选择【品类/产品】时应该看哪些指标？请给一份面向【用户/采购方/医生】的决策清单。",
    },
    "where_to_buy": {
        "label": "渠道/可获得性",
        "goal": "用户关心在哪里买、是否上市、渠道、地区可用性。",
        "patterns": [
            r"\bwhere can i buy\b", r"\bwhere to buy\b", r"\bavailable (?:in|at|from|for purchase)\b", r"\bavailability\b",
            r"\bstock\b", r"\bdealer\b", r"\bdistributor\b", r"\bchannel\b",
            r"哪里买", r"在哪里买", r"渠道", r"经销商", r"代理商", r"上市了吗", r"有货",
        ],
        "geo_template": "【产品/品牌】在哪里可以买到或咨询？正规渠道有哪些？如何判断授权/真伪/地区可用性？",
    },
    "post_purchase": {
        "label": "售后/使用/维护",
        "goal": "用户买后或使用前关心安装、培训、保修、退换、维护。",
        "patterns": [
            r"\bwarranty\b", r"\breturn policy\b", r"\brefund\b", r"\bcustomer support\b", r"\bcustomer service\b",
            r"\binstall\b", r"\bsetup\b", r"\bmaintenance\b", r"\btraining\b",
            r"保修", r"退换", r"售后", r"安装", r"培训", r"维护", r"维修", r"怎么用",
        ],
        "geo_template": "购买/使用【产品】后，安装培训、耗材维护、保修售后和故障处理应该注意什么？",
    },
}


DOMAIN_RULES = [
    ("health_medical", "医疗健康", [r"doctor", r"medical", r"medicine", r"diabetes", r"insulin", r"hospital", r"patient", r"health", r"医生", r"医院", r"患者", r"医疗", r"药", r"糖尿病"]),
    ("software_ai", "软件/AI/工具", [r"software", r"app", r"api", r"plugin", r"chatgpt", r"ai", r"code", r"tool", r"软件", r"应用", r"工具", r"插件", r"模型"]),
    ("consumer_electronics", "消费电子", [r"phone", r"laptop", r"camera", r"headphone", r"tv", r"iphone", r"android", r"电脑", r"手机", r"相机", r"耳机", r"电视"]),
    ("finance_business", "金融/商业", [r"stock", r"invest", r"bank", r"insurance", r"business", r"supplier", r"contract", r"投资", r"股票", r"保险", r"供应商", r"合同", r"采购"]),
    ("travel_local", "旅行/本地服务", [r"hotel", r"flight", r"travel", r"restaurant", r"visa", r"trip", r"机票", r"酒店", r"旅行", r"餐厅", r"签证"]),
    ("education_career", "教育/职业", [r"course", r"school", r"university", r"resume", r"job", r"career", r"learn", r"课程", r"学校", r"简历", r"求职", r"学习"]),
    ("home_lifestyle", "家居/生活方式", [r"home", r"kitchen", r"furniture", r"food", r"diet", r"fitness", r"house", r"家", r"厨房", r"家具", r"饮食", r"健身"]),
    ("auto_mobility", "汽车/出行设备", [r"car", r"vehicle", r"bike", r"ev", r"tesla", r"汽车", r"电动车", r"自行车"]),
]


COMMERCIAL_CONTEXT_PATTERNS = [
    r"\bproduct\b", r"\bservice\b", r"\bbrand\b", r"\btool\b", r"\bapp\b", r"\bsoftware\b",
    r"\bdevice\b", r"\bphone\b", r"\blaptop\b", r"\bcamera\b", r"\bhotel\b", r"\brestaurant\b",
    r"\bcar\b", r"\bfridge\b", r"\bbar\b", r"\binsurance\b", r"\bsupplier\b", r"\bdealer\b",
    r"\bdistributor\b", r"\bbuy\b", r"\bpurchase\b", r"\bprice\b", r"\bcost\b", r"\bbudget\b",
    r"\brecommend\b", r"\bcompare\b", r"\bwhere to buy\b", r"\bwhere can i buy\b",
    r"产品", r"品牌", r"服务", r"工具", r"软件", r"应用", r"设备", r"手机", r"电脑", r"相机",
    r"酒店", r"餐厅", r"汽车", r"保险", r"供应商", r"经销商", r"代理商", r"购买", r"采购",
    r"价格", r"费用", r"预算", r"推荐", r"对比", r"哪里买",
]


NON_INTENT_PATTERNS = [
    r"^write (an?|the)?\s*(engaging|constructive|long|short)?\s*(article|essay|story|cover letter|poem|script)\b",
    r"^write a feed post\b",
    r"^rewrite\b",
    r"^riscrivi\b",
    r"^polish this essay\b",
    r"^summari[sz]e this\b",
    r"^translate\b",
    r"^reformuler\b",
    r"^帮我润色",
    r"^把以下文字",
    r"^做个总结",
    r"^优化下",
    r"^按照 .*写",
    r"^给你两段话",
    r"^我在公司实习",
    r"^just (read and )?say\b",
    r"reply me ok\b",
    r"view available hint",
    r"\balternative hypothesis\b",
    r"complete the following sentence",
    r"^question:\s+you are a household robot",
    r"^your task is to explore\b",
]


DECISION_QUERY_PATTERNS = [
    r"\?",
    r"？",
    r"^which\b",
    r"^what\b",
    r"^where\b",
    r"^how\b",
    r"^should\b",
    r"^is .* worth\b",
    r"^can you (find|recommend|compare|show|suggest|help me choose)\b",
    r"^do you recommend\b",
    r"^give me .*recommend",
    r"^show me .*keyword",
    r"推荐",
    r"怎么选",
    r"如何选择",
    r"哪里买",
    r"多少钱",
    r"价格",
    r"费用",
    r"哪个好",
    r"值得",
    r"安全吗",
    r"风险",
    r"替代",
    r"平替",
    r"售后",
    r"保修",
    r"渠道",
]


def load_pyarrow():
    try:
        import pyarrow.parquet as pq
    except ImportError as exc:
        raise RuntimeError("Install pyarrow first: python3 -m pip install --user pyarrow") from exc
    return pq


def normalize_message(message: Any) -> Dict[str, str]:
    if isinstance(message, dict):
        role = str(message.get("role") or message.get("from") or message.get("speaker") or "")
        content = str(message.get("content") or message.get("value") or message.get("text") or "")
        return {"role": role, "content": content}
    return {"role": "", "content": str(message)}


def iter_user_turns(row: Dict[str, Any]) -> Iterable[str]:
    value = row.get("conversation") or row.get("conversations") or row.get("messages")
    if hasattr(value, "as_py"):
        value = value.as_py()
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            yield value
            return
    if isinstance(value, list):
        for message in value:
            normalized = normalize_message(message)
            role = normalized["role"].lower()
            if role in {"user", "human"}:
                content = " ".join(normalized["content"].split()).strip()
                if content:
                    yield content


def clean_text(text: str) -> str:
    text = " ".join(str(text).split())
    return text.replace("<PRESIDIO_ANONYMIZED_EMAIL_ADDRESS>", "[email]").replace("<PRESIDIO_ANONYMIZED_PERSON>", "[person]")


def is_good_user_query(text: str) -> bool:
    if len(text) < 12 or len(text) > 700:
        return False
    lower = text.lower()
    if lower.count("http") > 2:
        return False
    if len(re.findall(r"[{};=<>]", text)) > 18:
        return False
    if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in NON_INTENT_PATTERNS):
        return False
    if not any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in DECISION_QUERY_PATTERNS):
        return False
    return True


def match_intents(text: str) -> List[str]:
    has_commercial_context = any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in COMMERCIAL_CONTEXT_PATTERNS)
    hits = []
    for intent_id, spec in INTENTS.items():
        if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in spec["patterns"]):
            hits.append(intent_id)
    if not has_commercial_context:
        return []
    return hits


def classify_domain(text: str) -> Tuple[str, str]:
    for domain_id, label, patterns in DOMAIN_RULES:
        if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns):
            return domain_id, label
    return "general", "通用/其他"


def extract_object_hint(text: str) -> str:
    patterns = [
        r"(?:should i buy|buying|buy|purchase|recommend|best|compare|how to choose|where to buy)\s+(.{2,80})",
        r"(?:购买|买|推荐|对比|怎么选|如何选择|哪里买)\s*(.{2,60})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            value = match.group(1)
            value = re.split(r"[?.!,;，。？；\n]", value)[0]
            return value.strip()[:80]
    return ""


def sample_rows(local_dir: Path, per_intent: int, max_rows: int, row_group_limit: int) -> Tuple[List[Dict], Dict]:
    pq = load_pyarrow()
    parquet_files = sorted((local_dir / "data").glob("*.parquet")) or sorted(local_dir.glob("*.parquet"))
    if not parquet_files:
        raise FileNotFoundError(f"No parquet files found under {local_dir}")

    samples_by_intent: Dict[str, List[Dict]] = defaultdict(list)
    seen = set()
    scanned_conversations = 0
    scanned_turns = 0

    for parquet_file in parquet_files:
        parquet = pq.ParquetFile(parquet_file)
        row_groups = parquet.num_row_groups if row_group_limit <= 0 else min(parquet.num_row_groups, row_group_limit)
        for row_group in range(row_groups):
            table = parquet.read_row_group(row_group)
            for row in table.to_pylist():
                scanned_conversations += 1
                if max_rows and scanned_conversations > max_rows:
                    return flatten(samples_by_intent), stats(samples_by_intent, scanned_conversations, scanned_turns)
                for turn in iter_user_turns(row):
                    scanned_turns += 1
                    text = clean_text(turn)
                    if not is_good_user_query(text):
                        continue
                    if text in seen:
                        continue
                    intents = match_intents(text)
                    if not intents:
                        continue
                    seen.add(text)
                    domain_id, domain_label = classify_domain(text)
                    item = {
                        "text": text,
                        "intents": intents,
                        "primary_intent": intents[0],
                        "domain_id": domain_id,
                        "domain_label": domain_label,
                        "object_hint": extract_object_hint(text),
                        "source_file": parquet_file.name,
                        "language": row.get("language"),
                        "conversation_id": row.get("conversation_id"),
                    }
                    for intent_id in intents:
                        if len(samples_by_intent[intent_id]) < per_intent:
                            samples_by_intent[intent_id].append({**item, "primary_intent": intent_id})
                    if all(len(samples_by_intent[intent_id]) >= per_intent for intent_id in INTENTS):
                        return flatten(samples_by_intent), stats(samples_by_intent, scanned_conversations, scanned_turns)
    return flatten(samples_by_intent), stats(samples_by_intent, scanned_conversations, scanned_turns)


def flatten(samples_by_intent: Dict[str, List[Dict]]) -> List[Dict]:
    rows = []
    for intent_id in INTENTS:
        rows.extend(samples_by_intent.get(intent_id, []))
    return rows


def stats(samples_by_intent: Dict[str, List[Dict]], scanned_conversations: int, scanned_turns: int) -> Dict:
    rows = flatten(samples_by_intent)
    return {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "scanned_conversations": scanned_conversations,
        "scanned_user_turns": scanned_turns,
        "sample_count": len(rows),
        "intent_counts": Counter(row["primary_intent"] for row in rows),
        "domain_counts": Counter(row["domain_label"] for row in rows),
        "language_counts": Counter(str(row.get("language")) for row in rows),
    }


def build_archetypes(samples: List[Dict]) -> List[Dict]:
    rows_by_intent: Dict[str, List[Dict]] = defaultdict(list)
    for row in samples:
        rows_by_intent[row["primary_intent"]].append(row)

    archetypes = []
    for intent_id, spec in INTENTS.items():
        rows = rows_by_intent.get(intent_id, [])
        domain_counts = Counter(row["domain_label"] for row in rows)
        object_hints = [row["object_hint"] for row in rows if row.get("object_hint")]
        archetypes.append({
            "id": intent_id,
            "label": spec["label"],
            "goal": spec["goal"],
            "sample_count": len(rows),
            "top_domains": domain_counts.most_common(6),
            "object_hints": object_hints[:12],
            "geo_template": spec["geo_template"],
            "brand_monitoring_questions": monitoring_questions(intent_id),
            "examples": rows[:12],
        })
    return archetypes


def monitoring_questions(intent_id: str) -> List[str]:
    common = {
        "purchase_decision": [
            "用户问“是否应该购买/使用【品牌产品】”时，AI 会不会主动推荐本品牌？",
            "AI 是否说明了适用人群、关键风险、替代方案和下一步咨询路径？",
        ],
        "compare_options": [
            "当用户把本品牌与核心竞品放在一起比较时，AI 给出的排序和理由是否准确？",
            "AI 是否混淆产品代际、适应症、价格或渠道？",
        ],
        "recommendation": [
            "用户只问品类推荐时，本品牌是否进入第一梯队？",
            "AI 推荐本品牌时是否说清推荐理由和证据来源？",
        ],
        "price_value": [
            "AI 是否能正确解释价格构成、长期耗材/维护成本和医保/保险限制？",
            "价格敏感场景下 AI 会不会把用户导向竞品或低价替代方案？",
        ],
        "risk_safety": [
            "AI 是否准确覆盖安全风险、召回/负面新闻和风险缓释方式？",
            "回答会不会因为风险表述失衡而劝退潜在用户？",
        ],
        "alternatives": [
            "AI 提到替代方案时，本品牌是否仍有清晰适用场景？",
            "AI 是否把非同类产品错误作为直接替代？",
        ],
        "how_to_choose": [
            "AI 给出的选型标准是否包含品牌的优势指标？",
            "AI 是否能按用户画像/预算/风险偏好给出分层建议？",
        ],
        "where_to_buy": [
            "AI 是否知道正规购买/咨询渠道、授权经销商和地区可及性？",
            "AI 是否会给出不准确电话、网站、非授权渠道或灰色购买建议？",
        ],
        "post_purchase": [
            "AI 是否覆盖安装培训、售后、保修、耗材更换、故障处理？",
            "AI 是否把售后责任在厂家、经销商、医院/服务商之间说清楚？",
        ],
    }
    return common[intent_id]


def write_outputs(out_dir: Path, samples: List[Dict], summary: Dict, archetypes: List[Dict]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "samples.jsonl").open("w", encoding="utf-8") as handle:
        for row in samples:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    payload = {
        "summary": {
            **summary,
            "intent_counts": dict(summary["intent_counts"]),
            "domain_counts": dict(summary["domain_counts"]),
            "language_counts": dict(summary["language_counts"]),
        },
        "archetypes": archetypes,
    }
    (out_dir / "archetypes.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "archetypes.md").write_text(build_markdown(payload), encoding="utf-8")
    (out_dir / "archetypes.html").write_text(build_html(payload), encoding="utf-8")


def build_markdown(payload: Dict) -> str:
    lines = ["# WildChat 用户意图经典范式", ""]
    summary = payload["summary"]
    lines.append(f"- 扫描 conversation: {summary['scanned_conversations']}")
    lines.append(f"- 扫描 user turns: {summary['scanned_user_turns']}")
    lines.append(f"- 样本数: {summary['sample_count']}")
    lines.append("")
    for item in payload["archetypes"]:
        lines.extend([
            f"## {item['label']}",
            "",
            item["goal"],
            "",
            f"**GEO 模板**：{item['geo_template']}",
            "",
            "**品牌监测问题**：",
        ])
        for question in item["brand_monitoring_questions"]:
            lines.append(f"- {question}")
        lines.append("")
        lines.append("**真实问法样例**：")
        for example in item["examples"][:5]:
            lines.append(f"- [{example['domain_label']}] {example['text']}")
        lines.append("")
    return "\n".join(lines)


def build_html(payload: Dict) -> str:
    summary = payload["summary"]
    cards = []
    for item in payload["archetypes"]:
        examples = "".join(
            f"<li><span>{html.escape(str(example['domain_label']))}</span>{html.escape(example['text'])}</li>"
            for example in item["examples"][:8]
        )
        questions = "".join(f"<li>{html.escape(question)}</li>" for question in item["brand_monitoring_questions"])
        domains = ", ".join(f"{label} {count}" for label, count in item["top_domains"])
        cards.append(f"""
        <section class="card">
          <div class="head">
            <div>
              <span>{html.escape(item['id'])}</span>
              <h2>{html.escape(item['label'])}</h2>
            </div>
            <strong>{item['sample_count']}</strong>
          </div>
          <p>{html.escape(item['goal'])}</p>
          <p class="template">{html.escape(item['geo_template'])}</p>
          <p class="domains">{html.escape(domains)}</p>
          <h3>品牌监测问题</h3>
          <ul>{questions}</ul>
          <h3>真实问法样例</h3>
          <ol>{examples}</ol>
        </section>
        """)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WildChat 用户意图经典范式</title>
  <style>
    body {{ margin:0; background:#f5f6f8; color:#1e2732; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.55; }}
    header {{ padding:32px 40px; background:#fff; border-bottom:1px solid #dfe5ec; }}
    h1 {{ margin:0 0 8px; font-size:28px; }}
    header p {{ margin:0; color:#667381; }}
    main {{ padding:24px 40px 48px; display:grid; gap:16px; }}
    .metrics {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }}
    .metric, .card {{ background:#fff; border:1px solid #dfe5ec; border-radius:8px; padding:16px; }}
    .metric span, .head span {{ color:#667381; font-size:12px; text-transform:uppercase; }}
    .metric strong {{ display:block; font-size:30px; }}
    .head {{ display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }}
    .head h2 {{ margin:2px 0 8px; font-size:20px; }}
    .head strong {{ font-size:24px; color:#176b87; }}
    .template {{ padding:10px 12px; background:#edf5f7; border-left:3px solid #176b87; }}
    .domains {{ color:#667381; }}
    h3 {{ margin:16px 0 8px; font-size:15px; }}
    li {{ margin:7px 0; }}
    li span {{ display:inline-block; margin-right:8px; color:#667381; font-size:12px; }}
    @media (max-width:800px) {{ header, main {{ padding-left:18px; padding-right:18px; }} .metrics {{ grid-template-columns:1fr; }} }}
  </style>
</head>
<body>
  <header>
    <h1>WildChat 用户意图经典范式</h1>
    <p>从真实用户问法中抽取购买、比较、推荐、价格、安全、替代、渠道和售后等跨行业范式，用作品牌 GEO 监测问题骨架。</p>
  </header>
  <main>
    <section class="metrics">
      <div class="metric"><span>Conversations</span><strong>{summary['scanned_conversations']}</strong></div>
      <div class="metric"><span>User Turns</span><strong>{summary['scanned_user_turns']}</strong></div>
      <div class="metric"><span>Samples</span><strong>{summary['sample_count']}</strong></div>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local_dir", default=str(ROOT / "data" / "WildChat"))
    parser.add_argument("--out_dir", default=str(DEFAULT_OUT_DIR))
    parser.add_argument("--per-intent", type=int, default=60)
    parser.add_argument("--max-rows", type=int, default=0, help="0 means scan all available rows.")
    parser.add_argument("--row-group-limit", type=int, default=0, help="0 means all row groups.")
    args = parser.parse_args()

    samples, summary = sample_rows(
        local_dir=Path(args.local_dir).expanduser().resolve(),
        per_intent=args.per_intent,
        max_rows=args.max_rows,
        row_group_limit=args.row_group_limit,
    )
    archetypes = build_archetypes(samples)
    out_dir = Path(args.out_dir).expanduser().resolve()
    write_outputs(out_dir, samples, summary, archetypes)
    print(json.dumps({
        "out_dir": str(out_dir),
        "samples": len(samples),
        "intent_counts": dict(summary["intent_counts"]),
        "domain_counts": dict(summary["domain_counts"]),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
