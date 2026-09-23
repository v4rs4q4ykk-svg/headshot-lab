"""Bounded research check of phoebe's recent CS2 Maps 1+2 headshots.

Uses the one verified /games/{id}/players_stats source with a generic
research user-agent; one run, no circumvention, no publishing a bulk feed.
"""
import json
import time
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://api.bo3.gg/api/v1"
BO3_PLAYER_ID = "49750"
MAX_MATCHES = 25
WINDOWS = (10, 15, 20)

def get(path, query=None):
    url = BASE + path + ("?" + urlencode(query) if query else "")
    request = Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "HeadshotLab-Bounded-Personal-Research/0.2",
    })
    try:
        with urlopen(request, timeout=15) as response:
            body = response.read(1_000_001)
            if len(body) > 1_000_000:
                raise RuntimeError("response too large")
            return json.loads(body)
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        print(f"API unavailable at {path}: {type(exc).__name__}")
        return None

def entries(x):
    if isinstance(x, list):
        return x
    if isinstance(x, dict):
        for k in ("results", "data"):
            if isinstance(x.get(k), list):
                return x[k]
    return []

def is_finished(g):
    return (isinstance(g, dict)
            and g.get("status") == "finished"
            and isinstance(g.get("rounds_count"), int)
            and g["rounds_count"] > 0)

def main():
    recent = entries(get("/matches", {
        "scope":"widget-matches", "page[offset]":0,
        "page[limit]":MAX_MATCHES, "sort":"-start_date",
        "filter[matches.status][in]":"finished",
        "filter[matches.player_ids][overlap]":BO3_PLAYER_ID,
        "filter[matches.discipline_id][eq]":1,
        "with":"teams,games",
    }))
    print(f"Returned {len(recent)} recent finished match candidates.")
    results = []
    steamid = None
    for summary in recent[:MAX_MATCHES]:
        if len(results) >= 20:
            break
        slug = summary.get("slug")
        if not isinstance(slug, str) or not slug or not all(
            c.isalnum() or c in "-_" for c in slug
        ):
            continue
        time.sleep(0.35)
        m = get("/matches/" + slug, {"with": "games"})
        if not isinstance(m, dict) or m.get("game_version") not in (2, "2"):
            continue
        if m.get("status") != "finished":
            continue
        games = {
            int(g["number"]): g for g in (m.get("games") or [])
            if is_finished(g) and str(g.get("number")) in ("1", "2")
        }
        if set(games) != {1, 2}:
            continue
        headshots = {}
        identities = {}
        teams = {}
        valid = True
        for number in (1, 2):
            g = games[number]
            gid = str(g.get("id", ""))
            if not gid.isdigit():
                valid = False
                break
            time.sleep(0.35)
            payload = get("/games/" + gid + "/players_stats")
            if payload is None:
                valid = False
                break
            matches = []
            for row in entries(payload):
                if not isinstance(row, dict):
                    continue
                profile = row.get("steam_profile") or {}
                if not isinstance(profile, dict):
                    continue
                if str(profile.get("nickname", "")).casefold() != "phoebe":
                    continue
                if type(row.get("headshots")) is not int or row["headshots"] < 0:
                    continue
                matches.append(row)
            if len(matches) != 1:
                valid = False
                break
            chosen = matches[0]
            headshots[number] = chosen["headshots"]
            identities[number] = str(chosen.get("steam_profile_id") or
                                     (chosen.get("steam_profile") or {}).get("id") or "")
            teams[number] = chosen.get("clan_name")
        if not valid:
            continue
        if len(set(identities.values())) != 1 or not next(iter(identities.values())):
            print("Ambiguous map identity; dropped match", str(m.get("id")))
            continue
        identity = identities[1]
        if steamid is not None and steamid != identity:
            print("Changed player identity; dropped match", str(m.get("id")))
            continue
        if teams[1] != teams[2]:
            print("Inconsistent team; dropped match", str(m.get("id")))
            continue
        steamid = identity
        results.append({
            "match":m.get("id"), "date":m.get("start_date"),
            "team":teams[1], "m1":headshots[1], "m2":headshots[2],
            "total":headshots[1]+headshots[2],
        })
    print("Verified player identity:", steamid or "unavailable")
    print("Complete Maps 1+2 series:", len(results))
    for n,r in enumerate(results,1):
        print(f"{n:2d}. match={r['match']} date={r['date']} team={r['team']} "
              f"M1={r['m1']} M2={r['m2']} HS={r['total']}")
    line = Decimal("14")  # user screenshot; historic, not verified live board
    for n in WINDOWS:
        if len(results) < n:
            print(f"L{n}: INSUFFICIENT ({len(results)}/{n})")
            continue
        sample = results[:n]
        over = sum(Decimal(x["total"]) > line for x in sample)
        under = sum(Decimal(x["total"]) < line for x in sample)
        push = n - over - under
        avg = round(sum(x["total"] for x in sample) / n, 2)
        print(f"L{n}: avg={avg} over={over} under={under} "
              f"push={push} relative to saved snapshot line {line} (NOT live).")
    print("This is an access and accuracy research test, NOT a licensed recurring feed.")

if __name__ == "__main__":
    main()
