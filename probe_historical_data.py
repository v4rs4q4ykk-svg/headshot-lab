"""Bounded access test for a public historical CS2 replay dataset.

Downloads only dataset-viewer JSON, never large demo archives. No credentials.
Failure is visible in Actions; no fake data or fallback to FACEIT stats.
"""
import json
from collections import defaultdict
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from headshot_lab import match_totals
from replay_dataset import normalize_map

DATASET = "blanchon/opencs2_dataset_demo"
BASE = "https://datasets-server.huggingface.co"
QUERY = urlencode({"dataset": DATASET, "config": "default", "split": "train", "offset": 0, "length": 15})


def main():
    url = f"{BASE}/rows?{QUERY}"
    req = Request(url, headers={"User-Agent": "HeadshotLab-Research/0.1"})
    try:
        with urlopen(req, timeout=25) as response:
            payload = json.load(response)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise SystemExit(
                f"DATA SOURCE UNAVAILABLE (HTTP {exc.code}): "
                "The dataset viewer denied access. This is not a GitHub Actions "
                "or headshot-calculator error. Do not buy a subscription or "
                "pretend the missing stats are zero. We need a verified, "
                "permitted source before enabling live collection."
            ) from exc
        raise
    print(f"HTTP access OK for {DATASET}", flush=True)
    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("dataset viewer did not provide data rows")

    by_player = defaultdict(list)
    seen = set()
    for entry in rows:
        row = entry["row"]
        records, provenance = normalize_map(row)
        ident = (provenance["match_id"], provenance["map_number"])
        if ident in seen:
            raise ValueError(f"duplicate map in source: {ident}")
        seen.add(ident)
        for record in records:
            by_player[record["player_id"]].append(record)

    eligible = [(pid, match_totals(data, pid)) for pid, data in by_player.items()]
    complete = [(pid, matches) for pid, matches in eligible if matches]
    print(f"Source: {DATASET}")
    print("STATUS: historical sample only — NOT a live 2026 prediction feed.")
    print(f"Received {len(rows)} parsed demo map rows")
    print(f"Distinct players: {len(by_player)}")
    print(f"Players with at least one complete Maps 1+2 series: {len(complete)}")
    for pid, matches in complete[:5]:
        print(f"  Player ID {pid}: {matches[0]['headshots']} headshots, source match {matches[0]['match_id']}")
    print("REAL-DATA ACCESS TEST PASSED (historical sample only)")


if __name__ == "__main__":
    main()
