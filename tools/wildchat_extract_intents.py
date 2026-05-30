#!/usr/bin/env python3
"""
Extract diabetes/MiniMed-related user turns from local WildChat parquet files.

The output is intentionally small and experiment-scoped. It can be used to
replace the fallback seed in monitor/intention_lab.js with real WildChat turns.
"""

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL_DIR = ROOT / "data" / "WildChat"
DEFAULT_OUT = ROOT / "monitor_runs" / "minimed_intent_lab" / "wildchat_real_matches.jsonl"

TERMS = [
    "diabetes",
    "diabetic",
    "insulin",
    "insulin pump",
    "cgm",
    "continuous glucose",
    "blood sugar",
    "glucose",
    "hypoglycemia",
    "low blood sugar",
    "minimed",
    "medtronic",
    "guardian",
    "simplera",
    "carelink",
    "dexcom",
    "omnipod",
    "tandem",
    "control-iq",
    "freestyle libre",
    "libre",
    "糖尿病",
    "胰岛素",
    "胰岛素泵",
    "动态血糖",
    "血糖",
    "低血糖",
    "美敦力",
    "雅培",
    "德康",
    "瞬感",
]

HARD_DEVICE_PATTERNS = [
    r"\binsulin pump\b",
    r"\bcontinuous glucose\b",
    r"\bminimed\b",
    r"\bsimplera\b",
    r"\bcarelink\b",
    r"\bdexcom\b",
    r"\bomnipod\b",
    r"\bcontrol[- ]iq\b",
    r"\bfreestyle libre\b",
    r"胰岛素泵",
    r"动态血糖",
    r"血糖仪",
    r"美敦力",
    r"德康",
    r"瞬感",
]

AMBIGUOUS_DEVICE_PATTERNS = [
    r"\btandem\b",
    r"\bguardian\b",
    r"\blibre\b",
    r"\bcgm\b",
    r"\bmedtronic\b",
    r"雅培",
]

DIABETES_CONTEXT_PATTERNS = [
    r"\bdiabetes\b",
    r"\bdiabetic\b",
    r"\binsulin\b",
    r"\bblood glucose\b",
    r"\bblood sugar\b",
    r"\bglucose\b",
    r"\bhypogly",
    r"\ba1c\b",
    r"\bhba1c\b",
    r"糖尿病",
    r"胰岛素",
    r"血糖",
    r"低血糖",
]

QUESTION_INTENT_PATTERNS = [
    r"\bcompare\b",
    r"\bversus\b",
    r"\bvs\b",
    r"\bwhich\b.{0,80}\bbetter\b",
    r"\bbetter (for|than)\b",
    r"\bchoose\b",
    r"\bshould i\b",
    r"\bcost\b",
    r"\bprice\b",
    r"\binsurance\b",
    r"\bsafe\b",
    r"\bsafety\b",
    r"\brisk\b",
    r"\bhypogly",
    r"\blow blood sugar\b",
    r"哪个好",
    r"怎么选",
    r"选择",
    r"对比",
    r"费用",
    r"价格",
    r"医保",
    r"报销",
    r"安全吗",
    r"低血糖",
]


def load_pyarrow():
    try:
        import pyarrow.parquet as pq
    except ImportError as exc:
        raise RuntimeError("Install dependencies first: python3 -m pip install -r requirements-wildchat.txt") from exc
    return pq


def normalize_message(message: Any) -> Dict[str, str]:
    if isinstance(message, dict):
        role = str(message.get("role") or message.get("from") or message.get("speaker") or "")
        content = str(message.get("content") or message.get("value") or message.get("text") or "")
        return {"role": role, "content": content}
    return {"role": "", "content": str(message)}


def iter_user_turns(row: Dict[str, Any]) -> Iterable[str]:
    for key in ["conversation", "conversations", "messages"]:
        value = row.get(key)
        if value is None:
            continue
        if hasattr(value, "as_py"):
            value = value.as_py()
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                yield value
                continue
        if isinstance(value, list):
            for message in value:
                normalized = normalize_message(message)
                role = normalized["role"].lower()
                if not role or role in {"user", "human"}:
                    content = normalized["content"].strip()
                    if content:
                        yield content

    for key in ["prompt", "instruction", "user", "text"]:
        value = row.get(key)
        if value:
            yield str(value)


def regex_any(text: str, patterns: List[str]) -> bool:
    import re
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def is_relevant_device_turn(text: str, strict: bool) -> bool:
    compact = " ".join(text.split())
    if len(compact) < 8:
        return False
    if len(compact) > 3500:
        # Long pasted documents often contain incidental terms but are weak for user intent mining.
        return False
    has_hard_device = regex_any(compact, HARD_DEVICE_PATTERNS)
    has_diabetes_context = regex_any(compact, DIABETES_CONTEXT_PATTERNS)
    has_ambiguous_device = regex_any(compact, AMBIGUOUS_DEVICE_PATTERNS) and has_diabetes_context
    has_core = has_hard_device or has_ambiguous_device
    if strict:
        return has_core and (regex_any(compact, QUESTION_INTENT_PATTERNS) or "?" in compact or "？" in compact)
    lower = compact.lower()
    has_general_diabetes = has_diabetes_context
    return has_core or (has_general_diabetes and regex_any(compact, QUESTION_INTENT_PATTERNS))


def classify_intent(text: str) -> str:
    lower = text.lower()
    if any(term in lower for term in ["cost", "price", "insurance", "covered", "医保", "报销", "费用", "价格"]):
        return "cost_access"
    if any(term in lower for term in ["compare", "versus", "vs", "better", "哪个好", "对比", "选择"]):
        return "brand_comparison"
    if any(term in lower for term in ["low", "hypo", "safety", "risk", "低血糖", "风险", "安全"]):
        return "safety"
    if any(term in lower for term in ["child", "kid", "pregnan", "type 1", "type 2", "儿童", "孩子", "1型", "2型"]):
        return "patient_fit"
    if any(term in lower for term in ["accur", "sensor", "cgm", "mard", "传感器", "准确"]):
        return "cgm_accuracy"
    if any(term in lower for term in ["tir", "a1c", "hba1c", "control", "控糖", "糖化"]):
        return "performance"
    return "general_diabetes_device"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local_dir", default=str(DEFAULT_LOCAL_DIR))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--row-group-limit", type=int, default=0, help="0 means all row groups.")
    parser.add_argument("--loose", action="store_true", help="Allow broader diabetes/glucose matches. Default is stricter device-intent matching.")
    args = parser.parse_args()

    pq = load_pyarrow()
    local_dir = Path(args.local_dir).expanduser().resolve()
    parquet_files = sorted((local_dir / "data").glob("*.parquet"))
    if not parquet_files:
        parquet_files = sorted(local_dir.glob("*.parquet"))
    if not parquet_files:
        raise FileNotFoundError(f"No parquet files found under {local_dir} or {local_dir / 'data'}")

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    terms_lower = [term.lower() for term in TERMS]
    count = 0
    seen = set()
    with out_path.open("w", encoding="utf-8") as handle:
      for parquet_file in parquet_files:
        parquet = pq.ParquetFile(parquet_file)
        row_group_count = parquet.num_row_groups
        if args.row_group_limit:
            row_group_count = min(row_group_count, args.row_group_limit)
        for row_group in range(row_group_count):
            table = parquet.read_row_group(row_group)
            for row in table.to_pylist():
                for turn in iter_user_turns(row):
                    compact = " ".join(turn.split())
                    lower = compact.lower()
                    if not compact or compact in seen:
                        continue
                    if not is_relevant_device_turn(compact, strict=not args.loose):
                        continue
                    seen.add(compact)
                    item = {
                        "source_file": str(parquet_file.relative_to(local_dir)),
                        "intent": classify_intent(compact),
                        "text": compact,
                        "language": row.get("language"),
                        "country": row.get("country"),
                    }
                    handle.write(json.dumps(item, ensure_ascii=False) + "\n")
                    count += 1
                    if count >= args.limit:
                        print(json.dumps({"out": str(out_path), "matches": count}, ensure_ascii=False, indent=2))
                        return 0

    print(json.dumps({"out": str(out_path), "matches": count}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
