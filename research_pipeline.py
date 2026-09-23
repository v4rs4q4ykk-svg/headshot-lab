"""Cached CS2 research: exact source IDs, completed maps, fixtures and vetoes.

Only public JSON endpoints are used. Requests are serial and bounded; HTTP
authorization or rate-limit failures stop the run. No credentials are published.
"""
import argparse
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fetch_player_history import get, rows, SourceUnavailable

DATA = Path("data")
NOW = lambda: datetime.now(timezone.utc).isoformat()


def positive(value):
    return type(value) is int and value > 0


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    temp.replace(path)


class Client:
    def __init__(self, cache=Path(".cache/bo3"), budget=180):
        self.cache, self.budget, self.calls = cache, budget, 0

    def get(self, path, args=None, ttl=3600):
        key = hashlib.sha256(json.dumps([path, args], sort_keys=True).encode()).hexdigest()
        file = self.cache / (key + ".json")
        if file.exists() and time.time() - file.stat().st_mtime < ttl:
            try:
                return json.loads(file.read_text())
            except (ValueError, OSError):
                pass
        if self.calls >= self.budget:
            raise SourceUnavailable("Request budget reached; try the refresh again later.")
        if self.calls:
            time.sleep(0.6)
        self.calls += 1
        try:
            result = get(path, args)
        except SourceUnavailable as exc:
            if str(exc).startswith("HTTP 5"):
                time.sleep(1)
                self.calls += 1
                try:
                    result = get(path, args)
                except SourceUnavailable as retry:
                    raise SourceUnavailable(path + ": " + str(retry)) from None
            else:
                raise SourceUnavailable(path + ": " + str(exc)) from None
        write_json(file, result)
        return result


def identity(row):
    if not isinstance(row, dict) or not positive(row.get("id")):
        return None
    name = row.get("nickname") or row.get("name")
    if not isinstance(name, str) or not name.strip() or len(name) > 90:
        return None
    return {"id": row["id"], "name": name.strip(), "slug": row.get("slug"),
            "team_id": row.get("team_id") if positive(row.get("team_id")) else None}


def team(row):
    item = identity(row)
    return {k: item[k] for k in ("id", "name", "slug")} if item else None


def resolve(client, nickname, ident=None):
    result = rows(client.get("/filters/players", {
        "search_text": nickname, "page[limit]": 30,
        "filter[discipline_id][eq]": 1}, ttl=900))
    people = {p["id"]: p for p in map(identity, result) if p}
    if ident is not None:
        return [people[ident]] if ident in people else []
    return [p for p in people.values() if p["name"].casefold() == nickname.casefold()]


def vetoes(match):
    result = []
    for row in match.get("match_maps") or []:
        if not isinstance(row, dict):
            continue
        map_obj = row.get("maps") or {}
        name = map_obj.get("map_name")
        if not isinstance(name, str) or not re.fullmatch(r"de_[a-z0-9_]{2,40}", name):
            continue
        action = {1: "pick", 2: "ban", 3: "decider"}.get(row.get("choice_type"))
        if action and positive(row.get("order")):
            result.append({"order": row["order"], "action": action,
                           "team_id": row.get("team_id"), "map": name})
    return sorted(result, key=lambda x: x["order"])


def full_bo3_veto(actions):
    return (len(actions) == 7 and len({x["map"] for x in actions}) == 7
            and [x["order"] for x in actions] == list(range(1, 8))
            and [x["action"] for x in actions] == ["ban", "ban", "pick", "pick", "ban", "ban", "decider"]
            and positive(actions[0].get("team_id")) and positive(actions[1].get("team_id"))
            and actions[0]["team_id"] != actions[1]["team_id"]
            and all(actions[i]["team_id"] == actions[i % 2]["team_id"] for i in range(6)))


def fixture(match):
    a, b = team(match.get("team1")), team(match.get("team2"))
    if not a or not b or a["id"] == b["id"] or not positive(match.get("id")):
        return None
    games = {g.get("number"): g for g in match.get("games") or [] if isinstance(g, dict)}
    confirmed = []
    for n in (1, 2):
        name = (games.get(n) or {}).get("map_name")
        if isinstance(name, str) and name.startswith("de_"):
            confirmed.append(name)
    actions = vetoes(match)
    if len(confirmed) != 2 and match.get("bo_type") == 3:
        picks = [x["map"] for x in actions if x["action"] == "pick"]
        confirmed = picks[:2] if len(picks) >= 2 else []
    return {"id": match["id"], "slug": match.get("slug"), "start_date": match.get("start_date"),
            "status": match.get("status"), "bo_type": match.get("bo_type"),
            "teams": [a, b], "confirmed_maps": confirmed, "veto": actions,
            "tournament": (match.get("tournament") or {}).get("name")}


def stat_identity(row):
    profile = row.get("steam_profile") or {}
    ident = profile.get("player_id")
    player = profile.get("player") or {}
    if not positive(ident) or player.get("id") != ident:
        return None
    p = identity(player)
    team_id = (row.get("team_clan") or {}).get("team_id")
    hs = row.get("headshots")
    if not p or not positive(team_id) or type(hs) is not int or hs < 0:
        return None
    kills = row.get("kills")
    if type(kills) is int and (kills < 0 or hs > kills):
        return None
    return {"player": p, "team_id": team_id, "hs": hs,
            "profile_id": row.get("steam_profile_id"), "kills": kills}


def completed_series(match, stats_by_number):
    """Extract every verified player from the same two already-fetched maps."""
    if match.get("game_version") != 2 or match.get("status") != "finished":
        return {}
    meta = fixture(match)
    if not meta or not isinstance(meta["start_date"], str):
        return {}
    games = {}
    for g in match.get("games") or []:
        number = g.get("number")
        if number not in (1, 2):
            continue
        if number in games:
            return {}
        games[number] = g
    if set(games) != {1, 2} or any(g.get("status") != "finished" or not positive(g.get("rounds_count")) for g in games.values()):
        return {}
    stats = {}
    for n in (1, 2):
        entries = {}
        duplicates = set()
        for row in stats_by_number.get(n, []):
            p = stat_identity(row)
            if not p:
                continue
            pid = p["player"]["id"]
            if pid in entries:
                duplicates.add(pid)
            entries[pid] = p
        stats[n] = {k: v for k, v in entries.items() if k not in duplicates}
    result = {}
    teams = {t["id"]: t for t in meta["teams"]}
    for pid in stats[1].keys() & stats[2].keys():
        a, b = stats[1][pid], stats[2][pid]
        if a["team_id"] != b["team_id"] or a["team_id"] not in teams or a["profile_id"] != b["profile_id"]:
            continue
        own = teams[a["team_id"]]
        other = next(t for tid, t in teams.items() if tid != own["id"])
        maps = [{"id": games[n]["id"], "name": games[n].get("map_name"),
                 "rounds": games[n]["rounds_count"], "headshots": stats[n][pid]["hs"],
                 "kills": stats[n][pid]["kills"]} for n in (1, 2)]
        roster = {str(tid): sorted(k for k, p in stats[1].items() if p["team_id"] == tid)
                  for tid in teams}
        result[pid] = {"player": a["player"], "record": {
            "id": match["id"], "slug": match.get("slug"), "played_at": meta["start_date"],
            "team": own["name"], "team_id": own["id"], "opponent": other,
            "maps": maps, "map1": a["hs"], "map2": b["hs"], "headshots": a["hs"] + b["hs"],
            "rosters": roster, "veto": vetoes(match)}}
    return result


def match_query(**extra):
    return {"scope": "widget-matches", "page[offset]": 0, "page[limit]": 60,
            "sort": "-start_date", "filter[matches.status][in]": "finished",
            "filter[matches.discipline_id][eq]": 1, "with": "teams,games", **extra}


def team_profile(client, team_obj):
    data = rows(client.get("/matches", match_query(**{
        "scope": "widget-map-pool", "page[limit]": 30,
        "filter[matches.team_ids][overlap]": str(team_obj["id"]),
        "filter[matches.start_date][gt]": (datetime.now(timezone.utc) - timedelta(days=180)).date().isoformat(),
        "with": "teams,games,match_maps"}), ttl=7200))
    history, seen = [], set()
    for m in data:
        actions = vetoes(m)
        if m.get("id") in seen or not full_bo3_veto(actions):
            continue
        if team_obj["id"] not in (actions[0]["team_id"], actions[1]["team_id"]):
            continue
        seen.add(m["id"])
        history.append({"id": m["id"], "played_at": m.get("start_date"), "veto": actions,
                        "maps": [{"name": g.get("map_name"), "rounds": g.get("rounds_count")}
                                 for g in m.get("games") or [] if g.get("status") == "finished"]})
    return {"team": team_obj, "retrieved_at": NOW(), "matches": history[:20]}


def research(client, player):
    candidates = rows(client.get("/matches", match_query(**{
        "filter[matches.player_ids][overlap]": str(player["id"])}), ttl=300))
    results, peers, exclusions, seen = [], {}, [], set()
    checked = 0
    for cand in candidates:
        if len(results) >= 20:
            break
        if cand.get("id") in seen:
            continue
        seen.add(cand.get("id"))
        slug = cand.get("slug")
        if not isinstance(slug, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,180}", slug):
            continue
        checked += 1
        m = client.get("/matches/" + slug, {"with": "teams,games,match_maps"}, ttl=86400)
        games = [g for g in m.get("games") or [] if g.get("number") in (1, 2) and g.get("status") == "finished" and positive(g.get("rounds_count"))]
        if m.get("game_version") != 2 or m.get("status") != "finished" or len(games) != 2:
            exclusions.append({"id": m.get("id"), "date": m.get("start_date"), "reason": "No two completed CS2 maps"})
            continue
        stats = {g["number"]: rows(client.get("/games/" + str(g["id"]) + "/players_stats", ttl=86400)) for g in games}
        found = completed_series(m, stats)
        for pid, item in found.items():
            peers.setdefault(pid, {"player": item["player"], "matches": []})["matches"].append(item["record"])
        if player["id"] in found:
            results.append(found[player["id"]]["record"])
        else:
            exclusions.append({"id": m.get("id"), "date": m.get("start_date"), "reason": "Player ID or complete headshots unavailable"})
    results.sort(key=lambda x: x["played_at"], reverse=True)
    tid = player.get("team_id")
    upcoming, profiles = [], {}
    metadata_errors = []
    if positive(tid):
        stop = False
        try:
            upcoming_rows = rows(client.get("/matches", match_query(**{
                "page[limit]": 3, "sort": "start_date", "filter[matches.status][in]": "upcoming,current",
                "filter[matches.team_ids][overlap]": str(tid), "with": "teams,games"}), ttl=300))
            for raw in upcoming_rows:
                if raw.get("slug"):
                    try:
                        raw = client.get("/matches/" + raw["slug"], {"with": "teams,games,match_maps"}, ttl=300)
                    except SourceUnavailable as exc:
                        metadata_errors.append(str(exc))
                        if any(code in str(exc) for code in ("HTTP 401", "HTTP 403", "HTTP 429")):
                            stop = True
                f = fixture(raw)
                if f and tid in [t["id"] for t in f["teams"]] and f["status"] in ("upcoming", "current"):
                    upcoming.append(f)
                if stop:
                    break
        except SourceUnavailable as exc:
            metadata_errors.append(str(exc))
            stop = any(code in str(exc) for code in ("HTTP 401", "HTTP 403", "HTTP 429"))
        wanted = {}
        for f in upcoming:
            for t in f["teams"]:
                wanted[t["id"]] = t
        if results:
            for t in [{"id": results[0]["team_id"], "name": results[0]["team"], "slug": None}, results[0]["opponent"]]:
                wanted.setdefault(t["id"], t)
        if not stop:
            for team_obj in list(wanted.values())[:5]:
                try:
                    profiles[str(team_obj["id"])] = team_profile(client, team_obj)
                except SourceUnavailable as exc:
                    metadata_errors.append(str(exc))
                    if any(code in str(exc) for code in ("HTTP 401", "HTTP 403", "HTTP 429")):
                        break
    return {"schema_version": 3, "kind": "cs2_player_research", "bo3_player_id": player["id"],
            "nickname": player["name"], "player": player, "retrieved_at": NOW(),
            "source": "BO3.gg public match and per-game player records", "matches": results,
            "upcoming": upcoming, "team_profiles": profiles,
            "coverage": {"full_player_scan": True, "candidates_checked": checked, "available": len(results),
                         "excluded": exclusions, "metadata_errors": metadata_errors},
            "candidates_checked": checked, "excluded_checked": len(exclusions)}, peers


def load_record(pid):
    path = DATA / "player_histories" / (str(pid) + ".json")
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def publish(target, peers):
    at = NOW()
    for pid, peer in peers.items():
        if pid == target["bo3_player_id"]:
            continue
        old = load_record(pid)
        if old and old.get("coverage", {}).get("full_player_scan"):
            continue
        matches = {m["id"]: m for m in (old or {}).get("matches", [])}
        matches.update({m["id"]: m for m in peer["matches"]})
        record = {"schema_version": 3, "kind": "cs2_player_research", "bo3_player_id": pid,
                  "nickname": peer["player"]["name"], "player": peer["player"], "retrieved_at": at,
                  "source": target["source"], "matches": sorted(matches.values(), key=lambda m: m["played_at"], reverse=True)[:60],
                  "upcoming": [], "team_profiles": {}, "coverage": {"full_player_scan": False, "excluded": []}}
        write_json(DATA / "player_histories" / (str(pid) + ".json"), record)
    write_json(DATA / "player_histories" / (str(target["bo3_player_id"]) + ".json"), target)
    build_catalog()


def build_catalog():
    people = []
    for path in sorted((DATA / "player_histories").glob("*.json")):
        d = json.loads(path.read_text())
        if not d.get("matches"):
            continue
        people.append({"id": d["bo3_player_id"], "name": d["nickname"],
                       "team_id": d.get("player", {}).get("team_id"),
                       "team": d["matches"][0].get("team"), "series": len(d["matches"]),
                       "retrieved_at": d["retrieved_at"], "schema_version": d.get("schema_version", 1),
                       "full_player_scan": d.get("coverage", {}).get("full_player_scan", False),
                       "recent_totals": [m["headshots"] for m in d["matches"][:20]]})
    write_json(DATA / "research_catalog.json", {"updated_at": NOW(), "players": people})


def execute(nickname, ident=None, request_id=None):
    client = Client()
    status = {"requested_name": nickname, "requested_id": ident, "updated_at": NOW()}
    try:
        choices = resolve(client, nickname, ident)
        if len(choices) != 1:
            status.update(status="ambiguous" if choices else "not_found", candidates=choices,
                          message="Choose a source identity." if choices else "No exact CS2 player was returned by the source.")
        else:
            record, peers = research(client, choices[0])
            if not record["matches"]:
                raise SourceUnavailable("This player has no complete Map 1+2 headshot records available.")
            publish(record, peers)
            status.update(status="ready", player_id=record["bo3_player_id"], player_name=record["nickname"],
                          available=len(record["matches"]), requests=client.calls)
    except (SourceUnavailable, ValueError, KeyError) as exc:
        status.update(status="error", message=str(exc))
    status["updated_at"] = NOW()
    if request_id:
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", request_id):
            raise ValueError("Invalid request ID")
        write_json(DATA / "requests" / (request_id + ".json"), status)
    print(json.dumps(status), flush=True)
    return status


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name")
    parser.add_argument("--id", type=int)
    parser.add_argument("--request-id")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--catalog-only", action="store_true")
    args = parser.parse_args()
    if args.catalog_only:
        build_catalog()
    elif args.refresh:
        records = [json.loads(p.read_text()) for p in (DATA / "player_histories").glob("*.json")]
        records = [r for r in records if r.get("coverage", {}).get("full_player_scan") or r.get("schema_version", 1) < 3]
        for r in sorted(records, key=lambda x: x["retrieved_at"])[:4]:
            status = execute(r["nickname"], r["bo3_player_id"])
            if status["status"] == "error":
                break
    else:
        if not args.name or not re.fullmatch(r"[^\r\n<>]{1,90}", args.name):
            parser.error("A valid nickname is required")
        execute(args.name.strip(), args.id, args.request_id)


if __name__ == "__main__":
    main()
