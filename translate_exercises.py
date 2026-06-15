"""
Translate columns of exercise_library.csv to Hebrew:
  - exercise_name        -> exercise_name_he
  - description          -> description_he

Uses the same translation endpoint that `src/services/translateService.js`
calls in the app (configured via REACT_APP_TRANSLATE_API_URL in .env).

The endpoint expects a "menu" with `meals[].meal` strings, so we wrap each
source string as a fake meal. Order is preserved by the endpoint.

Features:
  - Deduplicates strings before calling the API
  - Per-field batch sizes (names are short, descriptions are long)
  - Caches translations to JSON so the script is resumable / safe to re-run
  - Writes a backup of the CSV before overwriting it

Usage:
    python translate_exercises.py                  # translate both fields
    python translate_exercises.py --only=name      # only exercise_name
    python translate_exercises.py --only=description
"""

import argparse
import csv
import json
import os
import sys
import time
import subprocess
from pathlib import Path

try:
    import requests
except ModuleNotFoundError:
    print("Installing 'requests'...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests


# ---------- Config ----------
CSV_PATH = Path("exercise_library.csv")
BACKUP_PATH = Path("exercise_library.csv.bak")

API_URL = "https://dietitian-be.azurewebsites.net/api/translate"
TARGET_LANG = "he"
REQUEST_TIMEOUT = 180  # seconds (descriptions can be long)
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 5

# Per-field config: which source -> target column, batch size, cache file.
FIELDS = {
    "name": {
        "src": "exercise_name",
        "dst": "exercise_name_he",
        "batch_size": 25,
        "cache": Path("exercise_translations_he.json"),
    },
    "description": {
        "src": "description",
        "dst": "description_he",
        "batch_size": 5,
        "cache": Path("exercise_descriptions_he.json"),
    },
}


# ---------- Cache helpers ----------
def load_cache(path: Path) -> dict:
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: could not read cache {path} ({e}); starting fresh.")
    return {}


def save_cache(path: Path, cache: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)
    tmp.replace(path)


# ---------- API ----------
def translate_batch(strings: list[str]) -> list[str]:
    """Call the translate API with a batch of strings.

    We wrap each string as `{meal: <text>}` because the API only translates
    the `meal` field (verified by probing). Order is preserved.
    """
    payload = {
        "menu": {
            "meals": [{"meal": s} for s in strings],
            "note": "",
        },
        "targetLang": TARGET_LANG,
    }

    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(
                API_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
            data = resp.json()
            meals = data.get("meals") or []
            if len(meals) != len(strings):
                raise RuntimeError(
                    f"Response size mismatch: sent {len(strings)}, got {len(meals)}"
                )
            translations = [(m.get("meal") or "").strip() for m in meals]
            if any(t == "" for t in translations):
                raise RuntimeError("Empty translation in response")
            return translations
        except Exception as e:
            last_err = e
            print(f"  Attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    raise RuntimeError(f"Batch failed after {MAX_RETRIES} attempts: {last_err}")


# ---------- Pipeline ----------
def translate_field(rows: list[dict], field_cfg: dict, label: str) -> int:
    """Translate one column in-place across `rows`. Returns number applied."""
    src_col = field_cfg["src"]
    dst_col = field_cfg["dst"]
    batch_size = field_cfg["batch_size"]
    cache_path = field_cfg["cache"]

    cache = load_cache(cache_path)
    print(f"\n=== {label} ({src_col} -> {dst_col}) ===")
    print(f"  Cache: {cache_path.name} has {len(cache)} entries.")

    # Build the list of unique source strings still needing translation.
    needed: list[str] = []
    seen: set[str] = set()
    for row in rows:
        src = (row.get(src_col) or "").strip()
        dst = (row.get(dst_col) or "").strip()
        if not src or dst:
            continue
        if src in cache or src in seen:
            continue
        seen.add(src)
        needed.append(src)

    print(f"  {len(needed)} unique strings need translation.")

    for i in range(0, len(needed), batch_size):
        batch = needed[i : i + batch_size]
        idx_end = min(i + batch_size, len(needed))
        print(f"  Translating {i + 1}-{idx_end} of {len(needed)} ...")
        translations = translate_batch(batch)
        for src, tr in zip(batch, translations):
            cache[src] = tr
        save_cache(cache_path, cache)
        time.sleep(0.2)  # be gentle on the API

    applied = 0
    for row in rows:
        src = (row.get(src_col) or "").strip()
        dst = (row.get(dst_col) or "").strip()
        if not src or dst:
            continue
        translated = cache.get(src)
        if translated:
            row[dst_col] = translated
            applied += 1

    print(f"  Applied {applied} translations to rows.")
    return applied


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--only",
        choices=list(FIELDS.keys()),
        help="Translate only one field. Default: all.",
    )
    args = parser.parse_args()

    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found in {os.getcwd()}")
        return 1

    print(f"Reading {CSV_PATH} ...")
    with open(CSV_PATH, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    print(f"  Loaded {len(rows)} rows.")

    if not fieldnames:
        print("ERROR: CSV has no header.")
        return 1

    fields_to_run = [args.only] if args.only else list(FIELDS.keys())

    # Validate columns exist
    for fname in fields_to_run:
        cfg = FIELDS[fname]
        for col in (cfg["src"], cfg["dst"]):
            if col not in fieldnames:
                print(f"ERROR: CSV missing column '{col}' required for '{fname}'.")
                return 1

    # Backup the CSV once before any writes.
    if not BACKUP_PATH.exists():
        print(f"Backing up CSV to {BACKUP_PATH} ...")
        BACKUP_PATH.write_bytes(CSV_PATH.read_bytes())

    total_applied = 0
    for fname in fields_to_run:
        total_applied += translate_field(rows, FIELDS[fname], label=fname)

    print(f"\nWriting {CSV_PATH} ({total_applied} new translations total) ...")
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
