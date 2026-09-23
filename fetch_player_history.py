"""Bounded, user-requested research of one BO3.gg CS2 player's map HS history.

Use ONLY with a specific BO3 player ID submitted via the connected GitHub
account. No board scraper, login impersonation, proxy, bypass, mass crawling
or guesses. Missing/unplayed maps stay missing. A completed series may be
older than the requested player's actual last 20 matches.
"""
import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = "https://api.bo3.gg/api/v1"
WAIT = 0.4

class SourceUnavailable(Exception):
    pass

def get(path, args=None):
    uri = ROOT + path + ("?" + urlencode(args) if args else "")
    request = Request(uri, headers={
        "Accept": "application/json",
        "User-Agent": "HeadshotLab-Bounded-User-Research/0.3",
    })
    for attempt in range(2):
        try:
            with urlopen(request, timeout=24) as response:
                if response.status != 200:
                    raise SourceUnavailable("HTTP " + str(response.status))
                data = response.read(1_000_001)
                if len(data) > 1_000_000:
                    raise SourceUnavailable("oversized response")
                return json.loads(data)
        except HTTPError as exc:
            # Authorization/rate-limit errors stop immediately. No evasion.
            raise SourceUnavailable("HTTP " + str(exc.code)) from None
        except (URLError, TimeoutError) as exc:
            if attempt == 0:
                time.sleep(1.5)
                continue
            raise SourceUnavailable("source/network unavailable after one retry") from exc
        except ValueError as exc:
            raise SourceUnavailable("source returned invalid JSON") from exc

def rows(data):
    if isinstance(data,list):
        return data
    if isinstance(data,dict):
        for key in ("results","data"):
            if isinstance(data.get(key),list):
                return data[key]
    return []

def player_id(ident):
    if not re.fullmatch(r"[1-9][0-9]{0,7}", ident):
        raise ValueError("BO3 player ID must be 1-8 positive digits")
    return int(ident)

def fetch_player(ident, sleep=time.sleep):
    lookup = get("/filters/players", {
        "search_text": "",
        "page[limit]": 1,
        "filter[players.id][eq]": ident,
        "filter[discipline_id][eq]": 1,
    })
    exact = [p for p in rows(lookup) if p.get("id") == ident]
    # Some API builds do not implement id filtering. Caller must provide
    # and manually verify name in that case, but never accept another ID.
    return exact[0] if len(exact) == 1 else None

def team_identity(entry):
    """Use only a named team with an unambiguous source ID."""
    if not isinstance(entry, dict):
        return None
    value = entry.get("team") if isinstance(entry.get("team"), dict) else entry
    ident = value.get("id")
    name = value.get("name")
    if type(ident) is not int or ident <= 0 or not isinstance(name, str) or not name.strip():
        return None
    aliases = {name.strip().casefold()}
    for clan in value.get("team_clans") or []:
        if isinstance(clan, dict) and isinstance(clan.get("clan_name"), str):
            aliases.add(clan["clan_name"].strip().casefold())
    return {"id": ident, "name": name.strip(), "aliases": aliases}

def opponent_identity(match, player_team):
    teams = match.get("teams")
    if teams is None:
        teams = [match.get("team1"), match.get("team2")]
    if not isinstance(teams, list) or len(teams) != 2 or not isinstance(player_team, str):
        return None
    identities = [team_identity(t) for t in teams]
    if any(t is None for t in identities) or identities[0]["id"] == identities[1]["id"]:
        return None
    own = [t for t in identities if player_team.strip().casefold() in t["aliases"]]
    other = [t for t in identities if player_team.strip().casefold() not in t["aliases"]]
    return {"id": other[0]["id"], "name": other[0]["name"]} if len(own) == len(other) == 1 else None

def map_identity(game):
    name = game.get("map_name")
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9 _-]{2,60}", name.strip()):
        return None
    return name.strip()

def collect(ident, nickname):
    if not isinstance(nickname, str) or not nickname.strip() or len(nickname)>90:
        raise ValueError("A bounded, exact player nickname is required")
    if not re.fullmatch(r"[^\r\n<>]{1,90}",nickname):
        raise ValueError("Invalid nickname")
    matches = rows(get("/matches", {
        "scope": "widget-matches",
        "page[offset]": 0, "page[limit]": 40,
        "sort": "-start_date",
        "filter[matches.status][in]": "finished",
        "filter[matches.player_ids][overlap]": str(ident),
        "filter[matches.discipline_id][eq]": 1,
        "with": "teams,games",
    }))
    if not matches:
        raise SourceUnavailable("no finished matches returned; no zero-filled history")
    results = []
    profile_id = None
    excluded = 0
    for cand in matches[:40]:
        if len(results)>=20:
            break
        slug = cand.get("slug")
        if not isinstance(slug,str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,160}",slug):
            excluded += 1
            continue
        time.sleep(WAIT)
        match = get("/matches/"+slug, {"with":"teams,games"})
        if not isinstance(match,dict) or match.get("game_version") not in (2,"2") or match.get("status")!="finished":
            excluded += 1
            continue
        games = {}
        for game in match.get("games") or []:
            if not isinstance(game,dict) or str(game.get("number")) not in ("1","2"):
                continue
            if (game.get("status")=="finished" and
                type(game.get("rounds_count")) is int and game["rounds_count"]>0 and
                str(game.get("id","")).isdigit()):
                games[int(game["number"])]=game
        if set(games)!={1,2}:
            excluded += 1
            continue
        map_stats=[]
        for n in (1,2):
            time.sleep(WAIT)
            stats = rows(get("/games/"+str(games[n]["id"])+"/players_stats"))
            candidates = []
            for row in stats:
                if not isinstance(row,dict):
                    continue
                profile=row.get("steam_profile") or {}
                if not isinstance(profile,dict) or str(profile.get("nickname","")).casefold()!=nickname.casefold():
                    continue
                h=row.get("headshots")
                p=row.get("steam_profile_id") or profile.get("id")
                if type(h) is int and h>=0 and p is not None:
                    candidates.append((str(p),h,row.get("clan_name")))
            if len(candidates)!=1:
                map_stats=[]
                break
            map_stats.append(candidates[0])
        if len(map_stats)!=2 or map_stats[0][0]!=map_stats[1][0] or map_stats[0][2]!=map_stats[1][2]:
            excluded+=1
            continue
        if profile_id is None:
            profile_id=map_stats[0][0]
        if profile_id!=map_stats[0][0]:
            excluded+=1
            continue
        date=match.get("start_date")
        if not isinstance(date,str) or not date:
            excluded+=1
            continue
        opponent = opponent_identity(match, map_stats[0][2])
        results.append({"id":match.get("id"),"played_at":date,"team":map_stats[0][2],
                        "opponent":opponent,
                        "maps":[{"name":map_identity(games[n]),"rounds":games[n]["rounds_count"]}
                                for n in (1,2)],
                        "map1":map_stats[0][1],"map2":map_stats[1][1],
                        "headshots":map_stats[0][1]+map_stats[1][1]})
    results.sort(key=lambda r:r["played_at"],reverse=True)
    return {"schema_version":2,"kind":"on_demand_user_research_not_live",
        "bo3_player_id":ident,"bo3_profile_id":profile_id,"nickname":nickname,
        "source":"BO3.gg public per-game player stats (research access; reuse rights unverified)",
        "retrieved_at":datetime.now(timezone.utc).isoformat(),
        "candidates_checked":len(matches[:40]),"excluded_checked":excluded,
        "matches":results,
        "caveat":"Newest complete available series among bounded candidates, not necessarily the last 20 games played; no PrizePicks projection or licensed recurring feed."}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--id",required=True)
    ap.add_argument("--name",required=True)
    opts=ap.parse_args()
    ident=player_id(opts.id)
    info=collect(ident,opts.name)
    output=Path("data/player_histories")/(str(ident)+".json")
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(info,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Saved one player research result; player_id="+str(ident)+
          " matches="+str(len(info["matches"]))+
          " excluded="+str(info["excluded_checked"])+
          " file="+str(output),flush=True)

if __name__=="__main__":
    main()
