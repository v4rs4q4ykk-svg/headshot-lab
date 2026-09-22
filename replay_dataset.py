"""Normalize a small, publicly available CS2 replay-analysis dataset.

Source: blanchon/cs2_dataset_demo_test (Hugging Face dataset viewer).
The source is an OLD FIVE-MAP TEST DATASET, not a live professional-match
feed. This adapter is for a real-data proof of concept, not current picks.
"""
from collections import Counter
from datetime import datetime, timezone


def normalize_map(row):
    """Return (per-player map records, provenance) from one parsed demo row.

    Count actual kill events marked as headshots, grouped by Steam ID.
    A roster entry with zero headshot kills is a real zero; an absent roster
    or absent kill-event list is rejected, not treated as zero.
    """
    match_id = str(row["match_id"])
    map_number = row["map_index"]
    if not match_id or type(map_number) is not int or map_number < 1:
        raise ValueError("valid match_id and map_index required")
    played_at = row["match_date"]
    if not isinstance(played_at, str):
        raise ValueError("match_date must be UTC ISO string")
    try:
        dt = datetime.fromisoformat(played_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid match_date") from exc
    # Dataset declares its naive timestamp field to be UTC.
    dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

    if type(row.get("rounds_played")) is not int or row["rounds_played"] <= 0:
        raise ValueError("map has no completed rounds")
    kills = row.get("kills")
    players = row.get("players")
    if not isinstance(kills, list) or not isinstance(players, list) or not players:
        raise ValueError("roster or kill events missing; can't count safely")

    roster = {}
    for player in players:
        steamid = player.get("steamid")
        if steamid is None:
            raise ValueError("roster member missing steamid")
        player_id = str(steamid)
        roster[player_id] = player.get("name") or player_id

    headshots = Counter()
    for kill in kills:
        if kill.get("headshot") is True:
            attacker = kill.get("attacker_steamid")
            if attacker is None:
                raise ValueError("headshot kill without attacker ID")
            player_id = str(attacker)
            if player_id not in roster:
                raise ValueError("headshot attacker missing from player roster")
            headshots[player_id] += 1

    records = [{
        "match_id": match_id,
        "player_id": pid,
        "played_at": dt.isoformat(),
        "map_number": map_number,
        "headshots": headshots[pid],
        "completed": True,
    } for pid in roster]
    provenance = {
        "match_id": match_id,
        "map_number": map_number,
        "match_url": row.get("match_url"),
        "source": "blanchon/cs2_dataset_demo_test",
        "source_date": dt.isoformat(),
        "players": roster,
    }
    return records, provenance
