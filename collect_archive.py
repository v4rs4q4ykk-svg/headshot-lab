"""Publish a small, clearly historical research sample from a public CS2 dataset.

Does not obtain current projections or current CS2 fixtures. No login, API key,
or demo-file download. Fails rather than writing plausible-looking fake data.
"""
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from headshot_lab import match_totals
from replay_dataset import normalize_map

DATASET = "blanchon/opencs2_dataset_demo"
DATASET_URL = f"https://huggingface.co/datasets/{DATASET}"
OUT = Path("data/archive.json")
LIMIT = 15


def make_archive(entries, retrieved_at):
    """Make a source-attributed, historical-only sample; exclude partial series."""
    by_player = defaultdict(list)
    names = {}
    match_urls = {}
    map_ids = set()
    source_dates = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("row"), dict):
            raise ValueError("dataset entry is missing a row")
        row = entry["row"]
        records, provenance = normalize_map(row)
        map_id = (provenance["match_id"], provenance["map_number"])
        if map_id in map_ids:
            raise ValueError(f"duplicate source map {map_id}")
        map_ids.add(map_id)
        source_dates.append(provenance["source_date"])
        if provenance["match_url"]:
            match_urls[provenance["match_id"]] = provenance["match_url"]
        names.update(provenance["players"])
        for record in records:
            by_player[record["player_id"]].append(record)

    players = []
    completed_match_ids = set()
    for player_id, records in by_player.items():
        totals = match_totals(records, player_id)
        if not totals:
            continue
        completed_match_ids.update(t["match_id"] for t in totals)
        results = [{
            **t,
            "source_url": match_urls.get(t["match_id"]) or DATASET_URL
        } for t in totals]
        players.append({
            "player_id": player_id,
            "name": names.get(player_id) or player_id,
            "matches": results,
            "completed_matches": len(results)
        })
    if not completed_match_ids:
        raise ValueError("sample has no complete map 1+2 series")
    players.sort(key=lambda x: (x["name"].lower(), x["player_id"]))
    return {
        "schema_version": 1,
        "kind": "historical_research_sample",
        "live_data_connected": False,
        "prizepicks_connected": False,
        "retrieved_at": retrieved_at,
        "dataset": DATASET,
        "source_url": DATASET_URL,
        "maps_scanned": len(map_ids),
        "completed_series": len(completed_match_ids),
        "earliest_match_date": min(source_dates),
        "latest_match_date": max(source_dates),
        "players": players,
        "note": "Historical March–April 2026 research sample. Not a current CS2 or PrizePicks feed. Incomplete series are excluded."
    }


def main():
    params = urlencode({
        "dataset": DATASET, "config": "default", "split": "train",
        "offset": 0, "length": LIMIT
    })
    request = Request(
        f"https://datasets-server.huggingface.co/rows?{params}",
        headers={"User-Agent": "HeadshotLab-Research/0.2"}
    )
    try:
        with urlopen(request, timeout=30) as response:
            entries = json.load(response).get("rows")
    except HTTPError as exc:
        raise SystemExit(
            f"Archive source denied access (HTTP {exc.code}). "
            "Existing saved archive remains unchanged."
        ) from exc
    if not isinstance(entries, list) or not entries:
        raise ValueError("archive source returned no rows")
    now = datetime.now(timezone.utc).isoformat()
    archive = make_archive(entries, now)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(archive, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"REAL HISTORICAL SAMPLE: {archive['maps_scanned']} maps, "
        f"{archive['completed_series']} complete series, "
        f"{len(archive['players'])} players. "
        f"Source dates {archive['earliest_match_date']} to "
        f"{archive['latest_match_date']}. No live feed."
    )


if __name__ == "__main__":
    main()
