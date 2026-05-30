#!/usr/bin/env python3
"""
Download WildChat-1M with retry/resume support.

This is adapted for datasets from the aliendao model_download.py idea:
- Try aliendao mirror first when --mirror is set.
- Resume interrupted file downloads via .part files and Range requests.
- Fall back to huggingface_hub.snapshot_download unless --mirror-only is set.
- Keep raw data under data/wildchat/raw/, which is gitignored.
"""

import argparse
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests
from tqdm import tqdm


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPO_ID = "allenai/WildChat-1M"
DEFAULT_LOCAL_DIR = ROOT / "data" / "wildchat" / "raw" / DEFAULT_REPO_ID
DEFAULT_CACHE_DIR = ROOT / "data" / ".hf_cache" / DEFAULT_REPO_ID
MIRROR_INDEX = "https://e.aliendao.cn"
MIRROR_DOWNLOAD_HOST = "http://61.133.217.142:20800/download"
MIRROR_DOWNLOAD_HOST_ENTERPRISE = "http://61.133.217.139:20800/download"


def log(repo_id: str, event: str, message: str) -> None:
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"{stamp} {repo_id} {event}: {message}", flush=True)


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def repo_prefix(repo_type: str, repo_id: str) -> str:
    return f"{'datasets' if repo_type == 'dataset' else 'models'}/{repo_id}"


def local_path_for_file(local_dir: Path, repo_type: str, repo_id: str, mirror_path: str) -> Path:
    prefix = "/" + repo_prefix(repo_type, repo_id).strip("/") + "/"
    if mirror_path.startswith(prefix):
        relative = mirror_path[len(prefix):]
    else:
        relative = mirror_path.lstrip("/")
    return local_dir / relative


def pattern_match(path: str, allow_patterns: Optional[List[str]]) -> bool:
    if not allow_patterns:
        return True
    return any(Path(path).match(pattern) for pattern in allow_patterns)


def fetch_mirror_json(url: str, timeout: int = 30) -> Optional[Dict]:
    response = requests.get(url, timeout=timeout)
    if response.status_code != 200:
        return None
    return response.json()


def fetch_mirror_files(repo_id: str, repo_type: str) -> List[Dict]:
    base = f"{MIRROR_INDEX}/{repo_prefix(repo_type, repo_id)}?json=true"
    payload = fetch_mirror_json(base)
    if not payload:
        return []

    files = payload.get("data", {}).get("files", [])
    output: List[Dict] = []
    queue = list(files)

    while queue:
        item = queue.pop(0)
        if item.get("name") in {".gitattributes", "~incomplete.txt"}:
            continue
        if item.get("type") == "dir":
            nested_url = f"{MIRROR_INDEX}/{item['path']}?json=true"
            nested = fetch_mirror_json(nested_url)
            if nested:
                queue.extend(nested.get("data", {}).get("files", []))
            continue
        output.append(item)

    return output


def content_length_from_headers(headers: Dict[str, str], existing_bytes: int = 0) -> Optional[int]:
    content_range = headers.get("content-range") or headers.get("Content-Range")
    if content_range:
        match = re.search(r"/(\d+)$", content_range)
        if match:
            return int(match.group(1))
    length = headers.get("content-length") or headers.get("Content-Length")
    if length is not None:
        return int(length) + existing_bytes
    return None


def download_resumable(url: str, dest: Path, index: int, total_files: int, chunk_size: int = 1024 * 1024) -> bool:
    ensure_dir(dest.parent)
    part = dest.with_suffix(dest.suffix + ".part")
    existing = part.stat().st_size if part.exists() else 0

    headers = {}
    if existing > 0:
        headers["Range"] = f"bytes={existing}-"

    with requests.get(url, headers=headers, stream=True, timeout=(20, 90), verify=False) as response:
        if response.status_code in {401, 403}:
            raise RuntimeError(f"mirror denied access: {response.status_code}")
        if existing > 0 and response.status_code == 200:
            # Server ignored Range, restart safely instead of appending duplicate bytes.
            existing = 0
            part.unlink(missing_ok=True)
        elif response.status_code not in {200, 206}:
            raise RuntimeError(f"download failed: HTTP {response.status_code}")

        total_bytes = content_length_from_headers(response.headers, existing)
        if total_bytes and dest.exists() and dest.stat().st_size >= total_bytes:
            return True

        mode = "ab" if existing > 0 and response.status_code == 206 else "wb"
        desc = f"{index}/{total_files} {dest.name}"
        total_mb = math.ceil((total_bytes or 0) / chunk_size) if total_bytes else None
        initial_mb = existing // chunk_size
        with open(part, mode) as handle, tqdm(
            total=total_mb,
            initial=initial_mb if total_mb else 0,
            unit="MB",
            desc=desc,
            leave=False,
        ) as progress:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if not chunk:
                    continue
                handle.write(chunk)
                progress.update(1)

    if total_bytes and part.stat().st_size < total_bytes:
        raise RuntimeError(f"incomplete file: {part.stat().st_size}/{total_bytes} bytes")
    part.replace(dest)
    return True


def download_from_mirror(
    repo_id: str,
    repo_type: str,
    local_dir: Path,
    allow_patterns: Optional[List[str]],
    token: str,
    enterprise: bool,
) -> bool:
    files = fetch_mirror_files(repo_id, repo_type)
    if not files:
        log(repo_id, "mirror", "no file list from aliendao")
        return False

    selected = []
    for item in files:
        mirror_path = item.get("path", "")
        dest = local_path_for_file(local_dir, repo_type, repo_id, mirror_path)
        relative = dest.relative_to(local_dir).as_posix()
        if pattern_match(relative, allow_patterns):
            selected.append((item, dest))

    if not selected:
        log(repo_id, "mirror", "file list found, but allow_patterns matched nothing")
        return False

    log(repo_id, "mirror", f"downloading {len(selected)} files to {local_dir}")
    host = MIRROR_DOWNLOAD_HOST_ENTERPRISE if enterprise else MIRROR_DOWNLOAD_HOST
    for index, (item, dest) in enumerate(selected, 1):
        mirror_path = item["path"]
        url = f"{host}{mirror_path}"
        if enterprise and token:
            url = f"{url}?token={token}"
        download_resumable(url, dest, index, len(selected))
    return True


def download_from_huggingface(
    repo_id: str,
    repo_type: str,
    local_dir: Path,
    cache_dir: Path,
    allow_patterns: Optional[List[str]],
    max_workers: int,
    token: Optional[str],
) -> bool:
    try:
        from huggingface_hub import snapshot_download
    except ImportError as exc:
        raise RuntimeError("Install dependencies first: python3 -m pip install -r requirements-wildchat.txt") from exc

    kwargs = {
        "repo_id": repo_id,
        "repo_type": repo_type,
        "local_dir": str(local_dir),
        "cache_dir": str(cache_dir),
        "resume_download": True,
        "max_workers": max_workers,
    }
    if allow_patterns:
        kwargs["allow_patterns"] = allow_patterns
    if token:
        kwargs["token"] = token

    log(repo_id, "huggingface", f"snapshot_download to {local_dir}")
    snapshot_download(**kwargs)
    return True


def complete_marker(local_dir: Path) -> Path:
    return local_dir / ".wildchat_download_complete.json"


def has_expected_parquet(local_dir: Path) -> bool:
    return len(list((local_dir / "data").glob("*.parquet"))) >= 1


def write_complete(local_dir: Path, repo_id: str, repo_type: str) -> None:
    payload = {
        "repo_id": repo_id,
        "repo_type": repo_type,
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "parquet_files": sorted(str(path.relative_to(local_dir)) for path in (local_dir / "data").glob("*.parquet")),
    }
    complete_marker(local_dir).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo_id", default=DEFAULT_REPO_ID)
    parser.add_argument("--repo_type", default="dataset", choices=["dataset", "model"])
    parser.add_argument("--local_dir", default=str(DEFAULT_LOCAL_DIR))
    parser.add_argument("--cache_dir", default=str(DEFAULT_CACHE_DIR))
    parser.add_argument("--allow-pattern", action="append", dest="allow_patterns", default=["README.md", "data/*.parquet"])
    parser.add_argument("--mirror", action="store_true", help="Try aliendao.cn mirror first.")
    parser.add_argument("--mirror-only", action="store_true", help="Do not fall back to huggingface.co.")
    parser.add_argument("--token", default=os.environ.get("HF_TOKEN", ""))
    parser.add_argument("--enterprise", action="store_true", help="Use aliendao enterprise endpoint.")
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument("--max-retries", type=int, default=1440)
    parser.add_argument("--retry-sleep", type=int, default=60)
    args = parser.parse_args()

    repo_id = args.repo_id
    local_dir = Path(args.local_dir).expanduser().resolve()
    cache_dir = Path(args.cache_dir).expanduser().resolve()
    ensure_dir(local_dir)
    ensure_dir(cache_dir)

    if complete_marker(local_dir).exists() and has_expected_parquet(local_dir):
        log(repo_id, "skip", f"already completed: {local_dir}")
        return 0

    last_error = None
    for attempt in range(1, args.max_retries + 1):
        try:
            log(repo_id, "attempt", str(attempt))
            ok = False
            if args.mirror:
                ok = download_from_mirror(
                    repo_id=repo_id,
                    repo_type=args.repo_type,
                    local_dir=local_dir,
                    allow_patterns=args.allow_patterns,
                    token=args.token,
                    enterprise=args.enterprise,
                )
            if not ok and not args.mirror_only:
                ok = download_from_huggingface(
                    repo_id=repo_id,
                    repo_type=args.repo_type,
                    local_dir=local_dir,
                    cache_dir=cache_dir,
                    allow_patterns=args.allow_patterns,
                    max_workers=args.max_workers,
                    token=args.token or None,
                )
            if ok and has_expected_parquet(local_dir):
                write_complete(local_dir, repo_id, args.repo_type)
                log(repo_id, "success", str(local_dir))
                return 0
            raise RuntimeError("download finished but expected parquet files were not found")
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            log(repo_id, "fail", str(exc))
            if attempt >= args.max_retries:
                break
            time.sleep(args.retry_sleep)

    log(repo_id, "failed", str(last_error))
    return 1


if __name__ == "__main__":
    sys.exit(main())
