"""Count headshot kills by Steam ID in one lawfully obtained CS2 .dem file.

No demo downloader or website scraper. Map index, match ID and player identity
must be independently verified before inserting any result into Headshot Lab.
Requires: pip install demoparser2
Run: python demo_headshots.py /path/to/map.dem
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path


def headshot_rows(events):
    """Count attacker headshot kills; reject ambiguous/missing event columns."""
    if not isinstance(events, list):
        raise ValueError("expected a list of kill events")
    by_player = defaultdict(lambda: {"name": None, "headshots": 0})
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("kill event is not a dictionary")
        if "headshot" not in event or "attacker_steamid" not in event:
            raise ValueError("demo lacks headshot or attacker_steamid fields")
        hs = event["headshot"]
        if type(hs) is not bool:
            raise ValueError("headshot field is not a true/false value")
        steamid = event["attacker_steamid"]
        if not hs or steamid is None:
            continue
        key = str(steamid).strip()
        if not key.isdigit() or int(key) <= 0:
            raise ValueError("invalid attacker Steam ID in headshot event")
        name = event.get("attacker_name")
        if name is not None and not isinstance(name, str):
            raise ValueError("invalid attacker name")
        player = by_player[key]
        if name:
            player["name"] = name
        player["headshots"] += 1
    return [
        {"steamid": sid, "name": value["name"], "headshots": value["headshots"]}
        for sid, value in sorted(by_player.items(), key=lambda pair: (-pair[1]["headshots"], pair[0]))
    ]


def parse_demo(path):
    if not path.is_file() or path.suffix.lower() != ".dem":
        raise ValueError("input must be an existing .dem file")
    from demoparser2 import DemoParser
    parser = DemoParser(str(path))
    header = parser.parse_header()
    events = parser.parse_event("player_death")
    required = {"headshot", "attacker_steamid"}
    if not required.issubset(events.columns):
        raise ValueError("demo did not provide headshot and Steam ID event columns")
    rows = events.to_dict("records")
    # pandas may expose numpy.bool_ or nullable scalars: convert only the
    # headshot flag; absent or invalid values must not become false/zero.
    for row in rows:
        if row["headshot"] is None or str(row["headshot"]).lower() not in {"true", "false"}:
            raise ValueError("missing or invalid headshot flag")
        row["headshot"] = str(row["headshot"]).lower() == "true"
    players = headshot_rows(rows)
    return {
        "source_type": "user_provided_demo",
        "file": path.name,
        "map_name_from_header": header.get("map_name") if isinstance(header, dict) else None,
        "event_count": len(rows),
        "headshot_players": players,
        "notice": "This is ONE map, not Maps 1+2. Verify matching player Steam ID, map order and full-match completion before any historical comparison."
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("demo", type=Path, help="one authorized .dem file")
    args = ap.parse_args()
    print(json.dumps(parse_demo(args.demo), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
