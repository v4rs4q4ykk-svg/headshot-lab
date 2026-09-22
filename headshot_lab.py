"""Headshot Lab calculation engine.

This module does not fetch live data. It validates map-level records supplied by
a future, authorized data provider and never substitutes guesses for missing stats.
"""
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation


def _time(value):
    if not isinstance(value, str):
        raise ValueError("played_at must be an ISO-8601 timestamp")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("played_at must be an ISO-8601 timestamp") from exc
    if result.tzinfo is None:
        raise ValueError("played_at needs a time zone")
    return result


def match_totals(rows, player_id):
    """Return newest-first, completed Maps 1+2 totals for one exact player ID.

    Required fields per map: match_id, player_id, played_at, map_number,
    headshots, completed. Incomplete matches are excluded, not counted as zero.
    Map 3 is intentionally ignored. Duplicate map records are rejected.
    """
    if not player_id:
        raise ValueError("player_id is required")

    by_match = defaultdict(dict)
    metadata = {}
    for row in rows:
        if row["player_id"] != player_id or row["map_number"] not in (1, 2):
            continue
        match_id = row["match_id"]
        if not match_id:
            raise ValueError("match_id is required")
        map_number = row["map_number"]
        if map_number in by_match[match_id]:
            raise ValueError(f"duplicate map {map_number} in match {match_id}")
        played_at = _time(row["played_at"])
        if match_id in metadata and metadata[match_id] != played_at:
            raise ValueError(f"inconsistent match time for {match_id}")
        metadata[match_id] = played_at
        if type(row["headshots"]) is not int or row["headshots"] < 0:
            raise ValueError("headshots must be a nonnegative integer")
        by_match[match_id][map_number] = row

    totals = []
    for match_id, maps in by_match.items():
        if set(maps) != {1, 2}:
            continue
        if not all(maps[n]["completed"] is True for n in (1, 2)):
            continue
        totals.append({
            "match_id": match_id,
            "played_at": metadata[match_id].isoformat(),
            "headshots": maps[1]["headshots"] + maps[2]["headshots"],
        })
    return sorted(totals, key=lambda item: (item["played_at"], item["match_id"]), reverse=True)


def analyze(rows, player_id, projection, windows=(10, 15, 20)):
    """Describe historical outcomes only; no prediction of future outcomes."""
    try:
        line = Decimal(str(projection))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("projection must be a number") from exc
    if not line.is_finite() or line < 0:
        raise ValueError("projection must be a finite nonnegative number")

    matches = match_totals(rows, player_id)
    result = {
        "player_id": player_id,
        "projection": str(line),
        "complete_matches": len(matches),
        "matches": matches,
        "windows": {},
    }
    for size in windows:
        if type(size) is not int or size <= 0:
            raise ValueError("window sizes must be positive integers")
        sample = matches[:size]
        if len(sample) < size:
            result["windows"][str(size)] = {
                "status": "insufficient_data",
                "available": len(sample),
                "required": size,
            }
            continue
        totals = [m["headshots"] for m in sample]
        overs = sum(Decimal(n) > line for n in totals)
        unders = sum(Decimal(n) < line for n in totals)
        pushes = size - overs - unders
        result["windows"][str(size)] = {
            "status": "complete",
            "average": round(sum(totals) / size, 2),
            "overs": overs,
            "unders": unders,
            "pushes": pushes,
            "over_pct": round(100 * overs / size, 2),
        }
    return result
