#!/usr/bin/env python3
"""
Extract lightweight buyer-decision intent archetypes from local WildChat parquet.

The goal is not to run full-dataset semantic mining. It streams parquet row groups,
keeps only compact candidate samples, and writes a practical GEO dashboard that
maps generic buyer questions back to Medtronic/MiniMed monitoring prompts.
"""

from __future__ import annotations

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
DEFAULT_OUT_DIR = ROOT / "monitor_runs" / "wildchat_purchase_archetypes"


ARCHETYPES: Dict[str, Dict[str, Any]] = {
    "need_framing": {
        "label": "需求定义与场景澄清",
        "stage": "认知前段",
        "user_pattern": "我有一个任务/疾病/预算/场景，应该看什么品类或方案？",
        "hidden_need": "用户还没锁定品牌，先让 AI 帮他定义问题、拆指标、给选择路径。",
        "geo_risk": "如果 AI 的选型指标不包含品牌优势，品牌会在用户形成候选清单前被排除。",
        "patterns": [
            r"\bwhat should i (use|choose|consider)\b",
            r"\bhow (do|should) i choose\b",
            r"\bwhat.*(criteria|factors|requirements|checklist)\b",
            r"\bwhich .* should i look for\b",
            r"怎么选",
            r"如何选择",
            r"应该考虑哪些",
            r"选择.*标准",
            r"选型",
        ],
        "medtronic_prompts": [
            "选择胰岛素泵/CGM/闭环系统时，1型糖尿病患者应该看哪些指标？",
            "医生建议我了解 MiniMed 780G，我应该从哪些标准判断是否适合？",
        ],
    },
    "category_recommendation": {
        "label": "品类推荐与候选清单",
        "stage": "找得到",
        "user_pattern": "请推荐几个最适合我的产品/品牌/服务。",
        "hidden_need": "用户把 AI 当成导购和榜单入口，希望直接得到优先级。",
        "geo_risk": "品牌如果没有进入第一梯队，后续比较、价格和风险讨论都不会发生。",
        "patterns": [
            r"\brecommend(?:ation|ed)?\b.{0,90}\b(?:book|course|tool|app|software|product|service|brand|device|phone|laptop|camera|hotel|restaurant|option|choice|provider|car|pump|sensor)s?\b",
            r"\b(?:book|course|tool|app|software|product|service|brand|device|phone|laptop|camera|hotel|restaurant|option|choice|provider|car|pump|sensor)s?\b.{0,90}\brecommend(?:ation|ed)?\b",
            r"\bbest (?:.+ )?(tool|app|software|product|service|brand|device|phone|laptop|camera|hotel|restaurant|option|choice|pump|sensor)s?\b",
            r"\btop (?:\d+ )?(?:.+ )?(tool|app|software|product|service|brand|device|phone|laptop|camera|hotel|restaurant|option|choice|pump|sensor)s?\b",
            r"\bwhat.*should i use\b",
            r"\bwhat.*should i choose\b",
            r"推荐",
            r"最好.*(?:产品|品牌|方案|工具|设备)",
            r"适合我",
            r"榜单",
            r"排名",
        ],
        "medtronic_prompts": [
            "有哪些值得优先了解的胰岛素泵和动态血糖监测方案？MiniMed 排在什么位置？",
            "给1型糖尿病患者推荐闭环胰岛素泵系统，MiniMed、Omnipod、Tandem、Dexcom/Libre 该怎么排？",
        ],
    },
    "compare_options": {
        "label": "横向比较与二选一",
        "stage": "说得对",
        "user_pattern": "A 和 B 哪个更好？有什么区别？我应该选哪个？",
        "hidden_need": "用户已经有候选，需要 AI 做同类边界、优劣势和适用人群判断。",
        "geo_risk": "AI 容易混淆代际、适应症、可用地区或把非同类产品当直接竞品。",
        "patterns": [
            r"\bcompare\b",
            r"\bcomparison\b",
            r"\bversus\b",
            r"\bvs\.?\b",
            r"\bwhich (one )?is better\b",
            r"\bdifference between\b",
            r"\bchoose between\b",
            r"对比",
            r"比较",
            r"区别",
            r"哪个好",
            r"哪一个更好",
            r"相比",
            r"和.*比",
        ],
        "medtronic_prompts": [
            "MiniMed 780G 和 Tandem t:slim X2 / Control-IQ 怎么选？",
            "MiniMed、Omnipod 5、Dexcom G7、FreeStyle Libre 之间是直接竞品吗？分别适合什么人？",
        ],
    },
    "should_buy_worth": {
        "label": "是否值得购买/采用",
        "stage": "愿推荐",
        "user_pattern": "我该不该买？值不值得？是否应该采用这个方案？",
        "hidden_need": "用户希望 AI 给出结论性建议，并说明为什么现在买或不买。",
        "geo_risk": "回答如果只有风险提示、没有适合人群和下一步，会降低转化信心。",
        "patterns": [
            r"\bshould i buy\b",
            r"\bshould i purchase\b",
            r"\bworth buying\b",
            r"\bis .* worth it\b",
            r"值得买",
            r"该不该买",
            r"要不要买",
            r"是否值得",
            r"值得入手",
            r"要不要用",
            r"是否应该.*采用",
        ],
        "medtronic_prompts": [
            "MiniMed 780G 值得用吗？什么情况下值得，什么情况下不建议？",
            "医生建议我使用美敦力 MiniMed，我要不要采用？请给出推荐结论和风险边界。",
        ],
    },
    "price_value": {
        "label": "价格、预算与长期成本",
        "stage": "转化阻力",
        "user_pattern": "多少钱？贵不贵？预算内划算吗？长期成本如何？",
        "hidden_need": "用户不是只问标价，还在问总拥有成本、耗材、保险/报销和替代方案。",
        "geo_risk": "AI 如果缺少成本构成或医保/保险边界，容易把用户导向低价替代。",
        "patterns": [
            r"\bprice\b",
            r"\bcost\b",
            r"\bbudget\b",
            r"\bcheap(?:est)?\b",
            r"\bexpensive\b",
            r"\bworth the money\b",
            r"\binsurance\b",
            r"\bcovered\b",
            r"\bout[- ]of[- ]pocket\b",
            r"价格",
            r"多少钱",
            r"费用",
            r"预算",
            r"性价比",
            r"划算",
            r"医保",
            r"报销",
            r"自费",
        ],
        "medtronic_prompts": [
            "MiniMed 780G 的费用主要由哪些部分构成？泵、传感器、耗材和培训要分别考虑什么？",
            "如果预算有限，MiniMed 与 Omnipod/Tandem/单独CGM方案相比，长期成本和价值怎么判断？",
        ],
    },
    "risk_trust": {
        "label": "风险、安全与信任",
        "stage": "信任建立",
        "user_pattern": "安全吗？可靠吗？有没有负面新闻、召回、副作用或隐私风险？",
        "hidden_need": "用户在寻找劝退因素，也在寻找风险可控的证据。",
        "geo_risk": "风险表述失衡会直接劝退；证据不足会让品牌资产变成空泛口碑。",
        "patterns": [
            r"\bsafe\b",
            r"\bsafety\b",
            r"\brisk\b",
            r"\bdanger\b",
            r"\bside effect\b",
            r"\breliable\b",
            r"\brecall\b",
            r"\bprivacy\b",
            r"\bcompliance\b",
            r"\bscam\b",
            r"\breview\b",
            r"\breputation\b",
            r"安全吗",
            r"风险",
            r"副作用",
            r"召回",
            r"质量",
            r"可靠",
            r"隐私",
            r"合规",
            r"口碑",
            r"评价",
        ],
        "medtronic_prompts": [
            "MiniMed 780G 安全可靠吗？有哪些常见风险、召回信息和使用限制？",
            "美敦力 MiniMed 的传感器准确性、低血糖风险、报警和售后问题应该如何评估？",
        ],
    },
    "alternatives": {
        "label": "替代方案与平替",
        "stage": "防流失",
        "user_pattern": "如果不选它，还有什么替代方案？有没有便宜/简单/更适合的选择？",
        "hidden_need": "用户在验证目标品牌是否必要，或寻找更低摩擦替代。",
        "geo_risk": "AI 如果把替代方案讲得更完整，本品牌会丢失清晰的适用边界。",
        "patterns": [
            r"\balternative(?:s)? (?:to|for)\b.{0,90}\b(?:product|brand|tool|app|software|service|device|provider|car|medicine|supplement|pump|sensor|therapy)s?\b",
            r"\b(?:product|brand|tool|app|software|service|device|provider|car|medicine|supplement|pump|sensor|therapy)s?\b.{0,90}\balternative(?:s)?\b",
            r"\bsubstitute (?:for|to)\b.{0,90}\b(?:product|brand|tool|app|software|service|device|provider|car|medicine|supplement|pump|sensor|therapy)s?\b",
            r"\breplace\b.{0,90}\b(?:product|brand|tool|app|software|service|device|provider|car|medicine|supplement|pump|sensor|therapy)s?\b",
            r"\bsimilar (?:product|service|tool|device|app|software|brand)\b",
            r"替代(?:产品|方案|工具|设备|药|品牌)",
            r"平替",
            r"不用.*(?:产品|品牌|设备|方案|药|泵).*可以",
            r"类似.*(?:产品|方案|工具|设备|品牌)",
            r"取代.*(?:产品|方案|工具|设备|品牌)",
            r"备选",
        ],
        "medtronic_prompts": [
            "如果不选 MiniMed 780G，还有哪些替代方案？哪些是直接替代，哪些只是部分替代？",
            "MiniMed 与单独使用 Dexcom/Libre CGM 加手动注射相比，分别适合什么人？",
        ],
    },
    "channel_access": {
        "label": "购买渠道与可获得性",
        "stage": "行动路径",
        "user_pattern": "在哪里可以买到/咨询？是否上市？哪个地区可用？渠道是否正规？",
        "hidden_need": "用户要把建议落地，需要官方、医院、授权经销商或本地可及性信息。",
        "geo_risk": "AI 给错渠道、灰色渠道或地区可用性，会造成转化流失和合规风险。",
        "patterns": [
            r"\bwhere can i buy\b",
            r"\bwhere to buy\b",
            r"\bavailable (?:in|at|from|for purchase)\b",
            r"\bavailability\b",
            r"\bin stock\b",
            r"\bdealer\b",
            r"\bdistributor\b",
            r"\bchannel\b",
            r"哪里买",
            r"在哪里买",
            r"渠道",
            r"经销商",
            r"代理商",
            r"上市了吗",
            r"有货",
            r"正规",
        ],
        "medtronic_prompts": [
            "MiniMed 780G 在中国/我所在地区可以通过哪些正规渠道咨询或购买？",
            "如何判断 MiniMed 相关耗材、传感器和售后服务是不是官方或授权渠道？",
        ],
    },
    "post_purchase": {
        "label": "安装、培训、维护与售后",
        "stage": "使用保障",
        "user_pattern": "买后怎么安装、培训、保修、退换、维护和处理故障？",
        "hidden_need": "用户在评估采用后的真实使用成本和服务责任。",
        "geo_risk": "AI 如果说不清医院、厂家、经销商的责任边界，会削弱医疗器械信任。",
        "patterns": [
            r"\bwarranty\b",
            r"\breturn policy\b",
            r"\brefund\b",
            r"\bcustomer support\b",
            r"\bcustomer service\b",
            r"\binstall\b",
            r"\bsetup\b",
            r"\bmaintenance\b",
            r"\btraining\b",
            r"\btroubleshoot\b",
            r"保修",
            r"退换",
            r"售后",
            r"安装",
            r"培训",
            r"维护",
            r"维修",
            r"故障",
            r"怎么用",
        ],
        "medtronic_prompts": [
            "使用 MiniMed 780G 前需要哪些安装、培训和医生随访？",
            "MiniMed 泵、传感器、输注管路和耗材出现问题时，售后和故障处理路径是什么？",
        ],
    },
}


DOMAIN_RULES = [
    ("health_medical", "医疗健康", [r"doctor", r"medical", r"medicine", r"diabetes", r"insulin", r"hospital", r"patient", r"health", r"drug", r"therapy", r"supplement", r"fish oil", r"omega-3", r"医生", r"医院", r"患者", r"医疗", r"糖尿病", r"胰岛素", r"治疗", r"保健品"]),
    ("software_ai", "软件/AI/工具", [r"software", r"\bapp\b", r"\bapi\b", r"plugin", r"chatgpt", r"\bai\b", r"tool", r"saas", r"软件", r"应用", r"工具", r"插件", r"模型"]),
    ("consumer_electronics", "消费电子", [r"phone", r"laptop", r"camera", r"headphone", r"\btv\b", r"iphone", r"android", r"电脑", r"手机", r"相机", r"耳机", r"电视"]),
    ("finance_business", "金融/商业采购", [r"stock", r"invest", r"bank", r"insurance", r"business", r"supplier", r"vendor", r"contract", r"procurement", r"投资", r"股票", r"保险", r"供应商", r"合同", r"采购"]),
    ("travel_local", "旅行/本地服务", [r"hotel", r"flight", r"travel", r"restaurant", r"visa", r"trip", r"property", r"机票", r"酒店", r"旅行", r"餐厅", r"签证", r"房产"]),
    ("education_career", "教育/职业", [r"course", r"school", r"university", r"resume", r"job", r"career", r"learn", r"课程", r"学校", r"简历", r"求职", r"学习"]),
    ("home_lifestyle", "家居/生活方式", [r"home", r"kitchen", r"furniture", r"food", r"diet", r"fitness", r"house", r"家", r"厨房", r"家具", r"饮食", r"健身"]),
    ("auto_mobility", "汽车/出行", [r"\bcar\b", r"vehicle", r"bike", r"\bev\b", r"tesla", r"汽车", r"电动车", r"自行车"]),
]


COMMERCIAL_CONTEXT_PATTERNS = [
    r"\bproduct\b", r"\bservice\b", r"\bbrand\b", r"\btool\b", r"\bapp\b", r"\bsoftware\b", r"\bdevice\b",
    r"\bphone\b", r"\blaptop\b", r"\bcamera\b", r"\bhotel\b", r"\brestaurant\b", r"\bcar\b", r"\binsurance\b",
    r"\bsupplier\b", r"\bvendor\b", r"\bdealer\b", r"\bdistributor\b", r"\bpump\b", r"\bsensor\b", r"\btherapy\b",
    r"\bbuy\b", r"\bpurchase\b", r"\bprice\b", r"\bcost\b", r"\bbudget\b", r"\brecommend\b", r"\bcompare\b",
    r"产品", r"品牌", r"服务", r"工具", r"软件", r"应用", r"设备", r"手机", r"电脑", r"相机", r"酒店", r"餐厅",
    r"汽车", r"保险", r"供应商", r"经销商", r"代理商", r"购买", r"采购", r"价格", r"费用", r"预算", r"推荐",
    r"对比", r"渠道", r"医疗器械", r"胰岛素泵", r"传感器",
]


PURCHASABLE_PATTERNS = [
    r"\bproduct\b", r"\bservice\b", r"\bbrand\b", r"\btool\b", r"\bapp\b", r"\bsoftware\b", r"\bdevice\b",
    r"\bphone\b", r"\blaptop\b", r"\bcamera\b", r"\bheadphone\b", r"\bprovider\b", r"\bbook\b", r"\bcourse\b",
    r"\bhotel\b", r"\brestaurant\b", r"\bcar\b", r"\bproperty\b", r"\binsurance\b", r"\bsupplier\b", r"\bvendor\b",
    r"\bdealer\b", r"\bdistributor\b", r"\bpump\b", r"\bsensor\b", r"\bmedicine\b", r"\bsupplement\b", r"\btherapy\b",
    r"\bgpu\b", r"\btransistor\b", r"\bbattery\b", r"\btrailer\b", r"\bbackpack\b", r"\bring\b",
    r"产品", r"品牌", r"服务", r"工具", r"软件", r"应用", r"设备", r"手机", r"电脑", r"相机", r"耳机", r"酒店", r"餐厅",
    r"汽车", r"房产", r"保险", r"课程", r"书", r"供应商", r"经销商", r"代理商", r"医疗器械", r"药", r"保健品", r"胰岛素泵",
    r"传感器", r"耗材", r"背包", r"戒指",
]


DIRECT_BUYER_PATTERNS = [
    r"\bbuy\b", r"\bpurchase\b", r"\border\b", r"\bprice\b", r"\bcost\b", r"\bbudget\b", r"\bcheap\b",
    r"\bexpensive\b", r"\bwhere can i buy\b", r"\bwhere to buy\b", r"\bavailable\b", r"\bin stock\b",
    r"\bdealer\b", r"\bdistributor\b", r"\bwarranty\b", r"\breturn policy\b", r"\bcustomer support\b",
    r"购买", r"买", r"采购", r"下单", r"价格", r"多少钱", r"费用", r"预算", r"性价比", r"哪里买", r"在哪里买",
    r"渠道", r"有货", r"保修", r"售后", r"维修", r"耗材",
]


NON_BUYER_PATTERNS = [
    r"^write (?:an?|the)?\s*(?:engaging|constructive|long|short)?\s*(?:article|essay|story|cover letter|poem|script|paper)\b",
    r"^write a feed post\b",
    r"^rewrite\b",
    r"^translate\b",
    r"^summari[sz]e\b",
    r"^paraphrase\b",
    r"^polish\b",
    r"^proofread\b",
    r"^compose\b",
    r"^create a (?:story|poem|song|essay)\b",
    r"\bsummari[sz]e\b.{0,120}\bpaper\b",
    r"^solve\b",
    r"^calculate\b",
    r"^prove\b",
    r"\bmultiple choice\b",
    r"\bwhich of the following\b",
    r"\bwhat does the author recommend\b",
    r"^what does the term\b",
    r"^what differentiates\b",
    r"^what are key objectives\b",
    r"^what is a key factor\b",
    r"^which action is best\b",
    r"\bbest ways? to\b",
    r"\beasiest or best way\b",
    r"\bwhat is the best formula\b",
    r"\bwhat is the best material\b",
    r"\bwhat is one of the best ways\b",
    r"\blook for the advertisements\b",
    r"\bsearch online reviews\b",
    r"\binsurance deductibles liability warranty\b",
    r"\bto prevent financial burden\b",
    r"\bit eliminates\b.{0,80}\bit boosts\b",
    r"\bphase\(s\) of software production\b",
    r"\bwidespread shift to remote work\b",
    r"\bonly select numbers\b",
    r"\bchemical equation\b",
    r"\bfree energ(?:y|ies)\b",
    r"\bhomework\b",
    r"\bexam question\b",
    r"\bdefinition 1\b",
    r"\bjailbreak\b",
    r"\btechnical interviews?\b",
    r"\bbest tips\b",
    r"\bsubject of the email\b",
    r"\bJOI star\b",
    r"\bexpand this text\b",
    r"\bshare some of the prompts\b",
    r"\bcomparing distributions\b",
    r"\bdifference between phone numbers\b",
    r"^question:\s",
    r"^your task is to\b",
    r"^complete the following\b",
    r"^帮我润色",
    r"^把以下文字",
    r"^翻译",
    r"^改写",
    r"^优化下",
    r"换一种说法",
    r"把这个改成",
    r"帮我精炼",
    r"请查阅资料",
    r"^写一篇",
    r"^请写",
    r"^案例分析",
    r"双色球|彩票",
]


QUESTION_OR_DECISION_PATTERNS = [
    r"\?",
    r"？",
    r"^which\b",
    r"^what\b",
    r"^where\b",
    r"^how\b",
    r"^should\b",
    r"^do you recommend\b",
    r"^can you (find|recommend|compare|suggest|help me choose)\b",
    r"推荐",
    r"怎么选",
    r"如何选择",
    r"哪里买",
    r"多少钱",
    r"哪个好",
    r"值得",
    r"安全吗",
    r"风险",
    r"替代",
    r"售后",
    r"保修",
]


def load_pyarrow():
    try:
        import pyarrow.parquet as pq
    except ImportError as exc:
        raise RuntimeError("Install pyarrow first: python3 -m pip install -r requirements-wildchat.txt") from exc
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
            if normalized["role"].lower() in {"user", "human"}:
                content = " ".join(normalized["content"].split()).strip()
                if content:
                    yield content


def redact_text(text: str) -> str:
    text = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email]", text, flags=re.I)
    text = re.sub(r"https?://\S+", "[url]", text)
    text = re.sub(r"\b(?:\+?\d[\d -]{8,}\d)\b", "[phone]", text)
    return text


def clean_text(text: str) -> str:
    text = " ".join(str(text).split())
    replacements = {
        "<PRESIDIO_ANONYMIZED_EMAIL_ADDRESS>": "[email]",
        "<PRESIDIO_ANONYMIZED_PERSON>": "[person]",
        "<PRESIDIO_ANONYMIZED_PHONE_NUMBER>": "[phone]",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return redact_text(text)


def is_likely_buyer_query(text: str) -> bool:
    if len(text) < 18 or len(text) > 650:
        return False
    lower = text.lower()
    if lower.count("[url]") > 1 or lower.count("http") > 1:
        return False
    if len(re.findall(r"[{};=<>]", text)) > 14:
        return False
    if any(re.search(pattern, text, flags=re.I) for pattern in NON_BUYER_PATTERNS):
        return False
    if not any(re.search(pattern, text, flags=re.I) for pattern in QUESTION_OR_DECISION_PATTERNS):
        return False
    has_direct_buyer_signal = any(re.search(pattern, text, flags=re.I) for pattern in DIRECT_BUYER_PATTERNS)
    has_purchasable_object = any(re.search(pattern, text, flags=re.I) for pattern in PURCHASABLE_PATTERNS)
    return has_direct_buyer_signal or has_purchasable_object


def match_archetypes(text: str) -> List[str]:
    matches = []
    for archetype_id, spec in ARCHETYPES.items():
        if any(re.search(pattern, text, flags=re.I) for pattern in spec["patterns"]):
            matches.append(archetype_id)
    return matches


def is_good_archetype_hit(archetype_id: str, text: str) -> bool:
    checks = {
        "need_framing": [
            r"\bhow (?:do|should) i choose\b", r"\bwhat should i consider\b", r"\bcriteria\b", r"\brequirements\b",
            r"\bchecklist\b", r"怎么选", r"如何选择", r"选择.*标准", r"选型",
        ],
        "category_recommendation": [
            r"\brecommend\b", r"\brecommendation\b", r"\bbest\b", r"\btop\b", r"\bwhat.*should i use\b",
            r"\bwhat.*should i choose\b", r"推荐", r"最好", r"榜单", r"排名",
        ],
        "compare_options": [
            r"\bcompare\b", r"\bcomparison\b", r"\bversus\b", r"\bvs\.?\b", r"\bwhich (?:one )?is better\b",
            r"\bdifference between\b", r"\bchoose between\b", r"对比", r"比较", r"区别", r"哪个好", r"相比",
        ],
        "should_buy_worth": [
            r"\bshould i buy\b", r"\bshould i purchase\b", r"\bworth buying\b", r"\bis .* worth it\b",
            r"值得买", r"该不该买", r"要不要买", r"是否值得", r"值得入手", r"要不要用",
        ],
        "price_value": [
            r"\bprice\b", r"\bcost\b", r"\bbudget\b", r"\bcheap\b", r"\bexpensive\b", r"\binsurance\b",
            r"\bcovered\b", r"价格", r"多少钱", r"费用", r"预算", r"性价比", r"划算", r"医保", r"报销",
        ],
        "risk_trust": [
            r"\bsafe\b", r"\bsafety\b", r"\breliable\b", r"\brecall\b", r"\bprivacy\b", r"\bcompliance\b",
            r"\bscam\b", r"\breview\b", r"\breputation\b", r"\bquality\b", r"\bside effect\b",
            r"安全吗", r"副作用", r"召回", r"质量", r"可靠", r"隐私", r"合规", r"口碑", r"评价",
        ],
        "alternatives": [
            r"\balternative(?:s)? (?:to|for)\b", r"\bsubstitute (?:for|to)\b", r"\bsimilar (?:product|service|tool|device|app|software|brand)\b",
            r"替代(?:产品|方案|工具|设备|药|品牌)", r"平替", r"类似.*(?:产品|方案|工具|设备|品牌)",
        ],
        "channel_access": [
            r"\bwhere can i buy\b", r"\bwhere to buy\b", r"\bavailable (?:in|at|from|for purchase)\b",
            r"\bavailability\b", r"\bin stock\b", r"\bdealer\b", r"\bdistributor\b", r"\bchannel\b",
            r"哪里买", r"在哪里买", r"渠道", r"经销商", r"代理商", r"上市了吗", r"有货",
        ],
        "post_purchase": [
            r"\bwarranty\b", r"\breturn policy\b", r"\brefund\b", r"\bcustomer support\b", r"\bcustomer service\b",
            r"\binstall\b", r"\bsetup\b", r"\bmaintenance\b", r"\btraining\b", r"\btroubleshoot\b",
            r"保修", r"退换", r"售后", r"安装", r"培训", r"维护", r"维修", r"故障", r"怎么用",
        ],
    }
    return any(re.search(pattern, text, flags=re.I) for pattern in checks[archetype_id])


def archetype_bonus(archetype_id: str, text: str) -> int:
    bonus_patterns = {
        "need_framing": [r"\bhow (?:do|should) i choose\b", r"\bwhat should i consider\b", r"怎么选", r"如何选择"],
        "category_recommendation": [r"\brecommend\b", r"\bwhich .*brand\b", r"推荐"],
        "compare_options": [r"\bvs\.?\b", r"\bwhich .*better\b", r"哪个好", r"相比"],
        "should_buy_worth": [r"\bshould i buy\b", r"\bis .* worth it\b", r"值得买", r"要不要"],
        "price_value": [r"\bprice\b", r"\bcost\b", r"\bbudget\b", r"多少钱", r"费用"],
        "risk_trust": [r"\bsafe\b", r"\breliable\b", r"\brecall\b", r"\breview\b", r"安全吗", r"可靠", r"召回"],
        "alternatives": [r"\balternative(?:s)? (?:to|for)\b", r"替代", r"平替"],
        "channel_access": [r"\bwhere can i buy\b", r"\bwhere to buy\b", r"哪里买", r"渠道"],
        "post_purchase": [r"\binstall\b", r"\bsetup\b", r"\bwarranty\b", r"\bcustomer support\b", r"安装", r"售后", r"保修"],
    }
    return 4 if any(re.search(pattern, text, flags=re.I) for pattern in bonus_patterns[archetype_id]) else 0


def classify_domain(text: str) -> Tuple[str, str]:
    for domain_id, label, patterns in DOMAIN_RULES:
        if any(re.search(pattern, text, flags=re.I) for pattern in patterns):
            return domain_id, label
    return "general", "通用/其他"


def language_label(value: Any, text: str) -> str:
    raw = str(value or "").lower()
    if "chinese" in raw or raw in {"zh", "zh-cn", "cn"}:
        return "Chinese"
    if "english" in raw or raw == "en":
        return "English"
    return "Chinese" if re.search(r"[\u4e00-\u9fff]", text) else "English/Other"


def extract_object_hint(text: str) -> str:
    patterns = [
        r"(?:should i buy|should i purchase|buying|buy|purchase|recommend|best|compare|how to choose|where to buy|where can i buy)\s+(.{2,100})",
        r"(?:购买|买|推荐|对比|怎么选|如何选择|哪里买|多少钱|值得买)\s*(.{2,80})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I)
        if match:
            value = re.split(r"[?.!,;，。？；\n]", match.group(1))[0]
            value = value.strip(" :-")
            if value:
                return value[:90]
    return ""


def quality_score(text: str, archetype_ids: List[str], domain_id: str, object_hint: str) -> int:
    score = 0
    if re.search(r"\?|？", text):
        score += 3
    if re.search(r"^(which|what|where|how|should|do you recommend|can you)", text, flags=re.I):
        score += 3
    if object_hint:
        score += 2
    if domain_id != "general":
        score += 2
    if len(archetype_ids) > 1:
        score += 1
    if 40 <= len(text) <= 220:
        score += 2
    if re.search(r"\b(?:buy|purchase|price|cost|recommend|compare|where to buy|worth it)\b|购买|价格|推荐|对比|值得|渠道", text, flags=re.I):
        score += 3
    if re.search(r"\b(?:product|brand|device|software|service|tool|pump|sensor)\b|产品|品牌|设备|方案|工具", text, flags=re.I):
        score += 2
    if re.search(r"\b(?:multiple choice|homework|equation|essay|write|rewrite|translate)\b|写一篇|翻译|改写|论文", text, flags=re.I):
        score -= 5
    return score


def parquet_files(local_dir: Path) -> List[Path]:
    candidates = sorted((local_dir / "data").glob("*.parquet")) or sorted(local_dir.glob("*.parquet"))
    if not candidates:
        raise FileNotFoundError(f"No parquet files found under {local_dir}")
    return candidates


def sample_rows(local_dir: Path, per_archetype: int, max_conversations: int, row_group_limit: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    pq = load_pyarrow()
    keep_per_archetype = max(per_archetype * 8, per_archetype + 20)
    samples_by_archetype: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    match_counts = Counter()
    domain_counts = Counter()
    language_counts = Counter()
    seen_texts = set()
    scanned_conversations = 0
    scanned_user_turns = 0
    matched_user_turns = 0

    for parquet_file in parquet_files(local_dir):
        parquet = pq.ParquetFile(parquet_file)
        row_groups = parquet.num_row_groups if row_group_limit <= 0 else min(parquet.num_row_groups, row_group_limit)
        for row_group in range(row_groups):
            table = parquet.read_row_group(row_group)
            for row in table.to_pylist():
                scanned_conversations += 1
                if max_conversations and scanned_conversations > max_conversations:
                    return finalize_samples(samples_by_archetype, per_archetype), build_summary(scanned_conversations, scanned_user_turns, matched_user_turns, match_counts, domain_counts, language_counts)
                for turn in iter_user_turns(row):
                    scanned_user_turns += 1
                    text = clean_text(turn)
                    if text in seen_texts or not is_likely_buyer_query(text):
                        continue
                    archetype_ids = match_archetypes(text)
                    archetype_ids = [archetype_id for archetype_id in archetype_ids if is_good_archetype_hit(archetype_id, text)]
                    if not archetype_ids:
                        continue
                    seen_texts.add(text)
                    matched_user_turns += 1
                    domain_id, domain_label = classify_domain(text)
                    lang = language_label(row.get("language"), text)
                    object_hint = extract_object_hint(text)
                    score = quality_score(text, archetype_ids, domain_id, object_hint)
                    if score < 4:
                        continue
                    domain_counts[domain_label] += 1
                    language_counts[lang] += 1
                    base_item = {
                        "text": text,
                        "archetypes": archetype_ids,
                        "domain_id": domain_id,
                        "domain_label": domain_label,
                        "language": lang,
                        "object_hint": object_hint,
                        "source_file": parquet_file.name,
                        "conversation_id": row.get("conversation_id"),
                    }
                    for archetype_id in archetype_ids:
                        stage_score = score + archetype_bonus(archetype_id, text)
                        if stage_score < 6:
                            continue
                        match_counts[archetype_id] += 1
                        bucket = samples_by_archetype[archetype_id]
                        if len(bucket) < keep_per_archetype:
                            bucket.append({**base_item, "quality_score": stage_score, "primary_archetype": archetype_id})

                    if all(len(samples_by_archetype[key]) >= keep_per_archetype for key in ARCHETYPES):
                        return finalize_samples(samples_by_archetype, per_archetype), build_summary(scanned_conversations, scanned_user_turns, matched_user_turns, match_counts, domain_counts, language_counts)

    return finalize_samples(samples_by_archetype, per_archetype), build_summary(scanned_conversations, scanned_user_turns, matched_user_turns, match_counts, domain_counts, language_counts)


def finalize_samples(samples_by_archetype: Dict[str, List[Dict[str, Any]]], per_archetype: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for archetype_id in ARCHETYPES:
        bucket = sorted(
            samples_by_archetype.get(archetype_id, []),
            key=lambda row: (-int(row.get("quality_score", 0)), len(row.get("text", ""))),
        )
        rows.extend(bucket[:per_archetype])
    return rows


def build_summary(scanned_conversations: int, scanned_user_turns: int, matched_user_turns: int, match_counts: Counter, domain_counts: Counter, language_counts: Counter) -> Dict[str, Any]:
    return {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "method": "streamed parquet row groups; regex prefilter; top-quality sample retention; no local LLM or embeddings",
        "scanned_conversations": scanned_conversations,
        "scanned_user_turns": scanned_user_turns,
        "matched_user_turns": matched_user_turns,
        "match_counts": dict(match_counts),
        "domain_counts": dict(domain_counts),
        "language_counts": dict(language_counts),
    }


def build_archetypes(samples: List[Dict[str, Any]], summary: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows_by_archetype: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in samples:
        rows_by_archetype[row["primary_archetype"]].append(row)

    archetypes = []
    for archetype_id, spec in ARCHETYPES.items():
        rows = rows_by_archetype.get(archetype_id, [])
        domains = Counter(row["domain_label"] for row in rows)
        hints = [row["object_hint"] for row in rows if row.get("object_hint")]
        archetypes.append({
            "id": archetype_id,
            "label": spec["label"],
            "stage": spec["stage"],
            "user_pattern": spec["user_pattern"],
            "hidden_need": spec["hidden_need"],
            "geo_risk": spec["geo_risk"],
            "observed_match_count": summary["match_counts"].get(archetype_id, 0),
            "sample_count": len(rows),
            "top_domains": domains.most_common(5),
            "object_hints": hints[:10],
            "medtronic_prompts": spec["medtronic_prompts"],
            "geo_metric_mapping": geo_metric_mapping(archetype_id),
            "examples": rows[:10],
        })
    return archetypes


def geo_metric_mapping(archetype_id: str) -> Dict[str, str]:
    mappings = {
        "need_framing": {
            "答案可见度": "品类泛问下是否主动出现 MiniMed/美敦力。",
            "认知准确度": "是否把闭环泵、CGM、注射方案边界说清。",
            "证据纳入度": "是否引用指南、说明书、监管和临床证据。",
            "推荐转化力": "是否给出医生咨询、适用人群和下一步。",
        },
        "category_recommendation": {
            "答案可见度": "推荐榜单中是否进入第一梯队。",
            "认知准确度": "推荐理由是否对应真实产品能力。",
            "证据纳入度": "是否有权威来源支撑推荐排序。",
            "推荐转化力": "是否愿意把 MiniMed 作为明确候选。",
        },
        "compare_options": {
            "答案可见度": "竞品对比中品牌是否被完整提及。",
            "认知准确度": "是否混淆泵、CGM、算法、地区上市状态。",
            "证据纳入度": "是否给出官方/临床/监管证据。",
            "推荐转化力": "是否给出分人群选择结论。",
        },
        "should_buy_worth": {
            "答案可见度": "用户问要不要用时品牌露出是否靠前。",
            "认知准确度": "是否准确解释适合/不适合场景。",
            "证据纳入度": "是否用证据平衡价格、风险和疗效。",
            "推荐转化力": "是否形成明确、不过度的采用建议。",
        },
        "price_value": {
            "答案可见度": "价格讨论中是否保留品牌价值点。",
            "认知准确度": "是否覆盖泵、传感器、耗材、培训和报销。",
            "证据纳入度": "是否标明价格来源和地区差异。",
            "推荐转化力": "是否避免只因高价导向竞品。",
        },
        "risk_trust": {
            "答案可见度": "风险问法中是否仍能呈现品牌资产。",
            "认知准确度": "召回、安全、准确性是否表述准确。",
            "证据纳入度": "是否纳入官方安全通告和监管资料。",
            "推荐转化力": "是否把风险和缓释方式一起讲清。",
        },
        "alternatives": {
            "答案可见度": "替代方案中是否保留 MiniMed 适用边界。",
            "认知准确度": "是否区分直接替代和部分替代。",
            "证据纳入度": "替代品对比是否有同口径证据。",
            "推荐转化力": "是否说明何时仍应优先考虑 MiniMed。",
        },
        "channel_access": {
            "答案可见度": "行动路径中是否出现官方/授权渠道。",
            "认知准确度": "渠道、地区、上市状态是否准确。",
            "证据纳入度": "是否引用官方网站、医院或授权体系。",
            "推荐转化力": "是否给出安全可执行的咨询路径。",
        },
        "post_purchase": {
            "答案可见度": "售后场景中是否关联官方服务能力。",
            "认知准确度": "培训、耗材、故障、责任边界是否准确。",
            "证据纳入度": "是否纳入说明书、售后政策、官方材料。",
            "推荐转化力": "是否降低采用后的不确定性。",
        },
    }
    return mappings[archetype_id]


def payload(samples: List[Dict[str, Any]], summary: Dict[str, Any]) -> Dict[str, Any]:
    archetypes = build_archetypes(samples, summary)
    return {
        "summary": {
            **summary,
            "sample_count": len(samples),
            "archetype_count": len(archetypes),
            "caveat": "This is archetype mining for prompt design, not a statistically representative estimate.",
        },
        "topline_takeaways": [
            "购买意图不是一个问题，而是一条从需求定义、候选发现、比较、价格、风险、渠道到售后的决策链。",
            "AI 回答最容易影响品牌的时刻，是用户尚未点名品牌、只问品类推荐或选择标准的时候。",
            "对医疗器械品牌，风险/安全问法既是劝退风险，也是建立信任的关键证据入口。",
            "GEO 监测不应只问品牌词，还要覆盖非品牌泛问、竞品对比、替代方案和行动路径。",
        ],
        "archetypes": archetypes,
    }


def write_outputs(out_dir: Path, data: Dict[str, Any], samples: List[Dict[str, Any]]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "purchase_archetypes.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    with (out_dir / "purchase_samples.jsonl").open("w", encoding="utf-8") as handle:
        for row in samples:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    (out_dir / "purchase_archetypes.md").write_text(build_markdown(data), encoding="utf-8")
    (out_dir / "purchase_archetypes.html").write_text(build_html(data), encoding="utf-8")
    (out_dir / "medtronic_prompt_matrix_from_archetypes.txt").write_text(build_prompt_matrix(data), encoding="utf-8")


def build_markdown(data: Dict[str, Any]) -> str:
    summary = data["summary"]
    lines = [
        "# WildChat 购买/选择意图经典范式",
        "",
        "> 说明：这是用于 GEO prompt 设计的轻量范式挖掘，不是全量统计抽样。",
        "",
        f"- 扫描 conversations: {summary['scanned_conversations']}",
        f"- 扫描 user turns: {summary['scanned_user_turns']}",
        f"- 命中 buyer turns: {summary['matched_user_turns']}",
        f"- 输出样本数: {summary['sample_count']}",
        "",
        "## 核心结论",
        "",
    ]
    for takeaway in data["topline_takeaways"]:
        lines.append(f"- {takeaway}")
    lines.append("")
    for item in data["archetypes"]:
        lines.extend([
            f"## {item['label']}",
            "",
            f"- 决策阶段：{item['stage']}",
            f"- 经典问法：{item['user_pattern']}",
            f"- 真实需求：{item['hidden_need']}",
            f"- GEO 风险：{item['geo_risk']}",
            f"- 扫描命中数：{item['observed_match_count']}；入选样本数：{item['sample_count']}",
            "",
            "### 对 Medtronic/MiniMed 的监测 prompt",
        ])
        for prompt in item["medtronic_prompts"]:
            lines.append(f"- {prompt}")
        lines.extend(["", "### 四项指标映射"])
        for key, value in item["geo_metric_mapping"].items():
            lines.append(f"- {key}：{value}")
        lines.extend(["", "### WildChat 真实问法样例"])
        for example in item["examples"][:5]:
            lines.append(f"- [{example['domain_label']}] {example['text']}")
        lines.append("")
    return "\n".join(lines)


def build_prompt_matrix(data: Dict[str, Any]) -> str:
    lines = [
        "# Medtronic/MiniMed GEO Prompt Matrix from WildChat Buyer Archetypes",
        "# One prompt per line. Use with DeepSeek/Yuanbao monitoring.",
        "",
    ]
    idx = 1
    for item in data["archetypes"]:
        lines.append(f"## {item['label']}")
        for prompt in item["medtronic_prompts"]:
            lines.append(f"{idx:02d}. {prompt}")
            idx += 1
        lines.append("")
    return "\n".join(lines)


def build_html(data: Dict[str, Any]) -> str:
    summary = data["summary"]
    cards = []
    for item in data["archetypes"]:
        examples = "".join(
            f"<li><span>{html.escape(str(example['domain_label']))}</span>{html.escape(example['text'])}</li>"
            for example in item["examples"][:6]
        )
        prompts = "".join(f"<li>{html.escape(prompt)}</li>" for prompt in item["medtronic_prompts"])
        metrics = "".join(
            f"<div><b>{html.escape(metric)}</b><p>{html.escape(text)}</p></div>"
            for metric, text in item["geo_metric_mapping"].items()
        )
        domains = " / ".join(f"{label} {count}" for label, count in item["top_domains"]) or "n/a"
        cards.append(f"""
        <section class="archetype">
          <div class="row">
            <div>
              <span class="eyebrow">{html.escape(item['stage'])}</span>
              <h2>{html.escape(item['label'])}</h2>
            </div>
            <strong>{item['observed_match_count']}</strong>
          </div>
          <p class="pattern">{html.escape(item['user_pattern'])}</p>
          <div class="twocol">
            <div>
              <h3>真实需求</h3>
              <p>{html.escape(item['hidden_need'])}</p>
            </div>
            <div>
              <h3>GEO 风险</h3>
              <p>{html.escape(item['geo_risk'])}</p>
            </div>
          </div>
          <p class="domains">样本领域：{html.escape(domains)}</p>
          <h3>Medtronic/MiniMed 监测 Prompt</h3>
          <ol class="prompts">{prompts}</ol>
          <h3>四项核心指标映射</h3>
          <div class="metrics-grid small">{metrics}</div>
          <h3>WildChat 真实问法样例</h3>
          <ol class="examples">{examples}</ol>
        </section>
        """)
    takeaways = "".join(f"<li>{html.escape(t)}</li>" for t in data["topline_takeaways"])
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WildChat 购买/选择意图经典范式</title>
  <style>
    :root {{
      --bg:#f6f7f9;
      --panel:#ffffff;
      --line:#dfe5ec;
      --text:#1f2933;
      --muted:#667381;
      --accent:#176b87;
      --accent2:#7a4d16;
    }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; line-height:1.56; }}
    header {{ background:var(--panel); border-bottom:1px solid var(--line); padding:32px 40px 24px; }}
    h1 {{ margin:0 0 8px; font-size:30px; letter-spacing:0; }}
    header p {{ margin:0; color:var(--muted); max-width:920px; }}
    main {{ padding:24px 40px 48px; max-width:1280px; margin:0 auto; }}
    .metrics-grid {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px; }}
    .metric, .takeaways, .archetype {{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }}
    .metric span, .eyebrow {{ color:var(--muted); font-size:12px; text-transform:uppercase; }}
    .metric strong {{ display:block; font-size:30px; margin-top:2px; color:var(--accent); }}
    .takeaways {{ margin-bottom:16px; }}
    .takeaways h2, .archetype h2 {{ margin:0; }}
    .takeaways ul {{ margin:10px 0 0; padding-left:20px; }}
    .archetype {{ margin-bottom:16px; }}
    .row {{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }}
    .row strong {{ color:var(--accent); font-size:28px; }}
    .pattern {{ margin:12px 0; padding:10px 12px; border-left:4px solid var(--accent); background:#eef6f8; }}
    .twocol {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
    h3 {{ margin:14px 0 6px; font-size:14px; color:#314252; }}
    p {{ margin:0; }}
    .domains {{ color:var(--muted); margin-top:12px; font-size:13px; }}
    ol {{ margin:6px 0 0; padding-left:22px; }}
    li {{ margin:5px 0; }}
    .examples li span {{ display:inline-block; color:var(--accent2); min-width:96px; font-size:12px; }}
    .small {{ grid-template-columns:repeat(4,minmax(0,1fr)); margin:6px 0 0; }}
    .small div {{ border:1px solid var(--line); border-radius:8px; padding:10px; background:#fbfcfd; }}
    .small b {{ font-size:13px; }}
    .small p {{ color:var(--muted); font-size:13px; margin-top:4px; }}
    @media (max-width: 860px) {{
      header, main {{ padding-left:18px; padding-right:18px; }}
      .metrics-grid, .twocol, .small {{ grid-template-columns:1fr; }}
      h1 {{ font-size:24px; }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>WildChat 购买/选择意图经典范式</h1>
    <p>从真实 WildChat 用户问法中抽取跨行业购买、选择、风险、渠道和售后范式，并映射为 Medtronic/MiniMed GEO 监测 prompt。该报告用于 prompt 设计，不等同于全量统计结论。</p>
  </header>
  <main>
    <section class="metrics-grid">
      <div class="metric"><span>Conversations</span><strong>{summary['scanned_conversations']}</strong></div>
      <div class="metric"><span>User turns</span><strong>{summary['scanned_user_turns']}</strong></div>
      <div class="metric"><span>Buyer matches</span><strong>{summary['matched_user_turns']}</strong></div>
      <div class="metric"><span>Samples</span><strong>{summary['sample_count']}</strong></div>
    </section>
    <section class="takeaways">
      <h2>核心结论</h2>
      <ul>{takeaways}</ul>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mine buyer-decision archetypes from local WildChat parquet.")
    parser.add_argument("--local-dir", type=Path, default=DEFAULT_LOCAL_DIR, help="Directory containing WildChat parquet files.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output directory.")
    parser.add_argument("--per-archetype", type=int, default=18, help="Selected examples per archetype.")
    parser.add_argument("--max-conversations", type=int, default=100000, help="Stop after this many conversations; 0 means full scan.")
    parser.add_argument("--row-group-limit", type=int, default=0, help="Limit row groups per parquet file for quick tests; 0 means all.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    samples, summary = sample_rows(args.local_dir, args.per_archetype, args.max_conversations, args.row_group_limit)
    data = payload(samples, summary)
    write_outputs(args.out_dir, data, samples)
    print(json.dumps({
        "out_dir": str(args.out_dir),
        "scanned_conversations": summary["scanned_conversations"],
        "scanned_user_turns": summary["scanned_user_turns"],
        "matched_user_turns": summary["matched_user_turns"],
        "sample_count": len(samples),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
