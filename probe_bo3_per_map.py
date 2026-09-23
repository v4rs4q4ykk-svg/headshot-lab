"""One-shot check: BO3 per-game player headshot COUNTS, not aggregate percentages.

Research source: alexdistefano306/the-edge/edge/data/cs2.py describes
GET /matches/{slug}?with=games -> GET /games/{game_id}/players_stats.
No proxy, browser impersonation, scraper loop, bulk feed, or data publication.
"""
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE="https://api.bo3.gg/api/v1"

def get(path, query=None):
    url=BASE+path+("?"+urlencode(query) if query else "")
    req=Request(url,headers={"Accept":"application/json","User-Agent":"HeadshotLab-API-Research/0.1"})
    try:
        with urlopen(req,timeout=20) as res:
            data=res.read(1_000_001)
            if len(data)>1_000_000:
                raise ValueError("response too large")
            return json.loads(data)
    except HTTPError as exc:
        print(f"{path}: HTTP {exc.code} (no bypass attempted)")
    except (URLError,TimeoutError,ValueError) as exc:
        print(f"{path}: {type(exc).__name__} (no bypass attempted)")
    return None

def rows(payload):
    if isinstance(payload,list):return payload
    if isinstance(payload,dict):
        for key in ("results","data"):
            if isinstance(payload.get(key),list):return payload[key]
    return []

def main():
    print("One-shot per-game headshot COUNT probe, NOT an authorized live feed.")
    people=rows(get("/filters/players",{"search_text":"phoebe","page[limit]":5,"filter[discipline_id][eq]":1}))
    exact=[p for p in people if str(p.get("nickname","")).casefold()=="phoebe"]
    print(f"Exact BO3 phoebe identity matches: {len(exact)}")
    if len(exact)!=1: return
    pid=exact[0].get("id")
    print(f"BO3 player ID: {pid}")
    matches=rows(get("/matches",{
        "scope":"widget-matches","page[offset]":0,"page[limit]":25,
        "sort":"-start_date","filter[matches.status][in]":"finished",
        "filter[matches.player_ids][overlap]":str(pid),
        "filter[matches.discipline_id][eq]":1,"with":"teams,games"
    }))
    print(f"Recent finished matches returned: {len(matches)}")
    for m in matches[:4]:
        print("Candidate: match_id="+str(m.get("id"))+" slug="+str(m.get("slug"))+
              " date="+str(m.get("start_date"))+" version="+str(m.get("game_version")))
    if not matches:return
    chosen=None
    for m in matches:
        if m.get("slug") and m.get("game_version") in (None,2,"2"):
            chosen=m
            break
    if not chosen:
        print("No CS2 candidate with a resolvable slug.");return
    slug=str(chosen["slug"])
    if not all(c.isalnum() or c in "-_" for c in slug):
        print("Unsafe slug rejected");return
    match=get("/matches/"+slug,{"with":"games"})
    if not isinstance(match,dict):return
    if match.get("game_version") not in (2,"2"):
        print("Match not confirmed as CS2, stop");return
    games=[g for g in (match.get("games") or []) if isinstance(g,dict)
           and g.get("number") in (1,2,"1","2") and
           g.get("id") and g.get("status")=="finished" and
           isinstance(g.get("rounds_count"),int) and g["rounds_count"]>0]
    print("Source match="+str(match.get("id"))+" played Maps 1+2 found="+str(len(games)))
    totals={}
    if len(games)!=2:
        print("Incomplete series: no total calculated.");return
    for g in games:
        game_id=g["id"]
        if not str(game_id).isdigit():raise ValueError("bad game id")
        payload=get(f"/games/{game_id}/players_stats")
        stats=rows(payload)
        print("Map "+str(g["number"])+" rows="+str(len(stats))+
              " example fields="+str(sorted(stats[0])[:25] if stats else []))
        found=[]
        for row in stats:
            steam=row.get("steam_profile") or {}
            if not isinstance(steam,dict):steam={}
            nick=steam.get("nickname") or ""
            if str(nick).casefold()!="phoebe":continue
            hs=row.get("headshots")
            if type(hs)!=int or hs<0:
                print("phoebe headshots MISSING/NOT AN INTEGER: no total calculated");return
            found.append(row)
        if len(found)!=1:
            print("phoebe identity ambiguous/absent on map "+str(g["number"]));return
        row=found[0]
        print("VERIFIED CANDIDATE: match="+str(match.get("id"))+
              " map_number="+str(g["number"])+" map_name="+str(g.get("map_name"))+
              " player="+str((row.get("steam_profile") or {}).get("nickname"))+
              " team="+str(row.get("clan_name"))+
              " headshots="+str(row["headshots"]))
        totals[int(g["number"])]=row["headshots"]
    if set(totals)=={1,2}:
        print("FIRST REAL MAPS 1+2 HS TOTAL: "+str(totals[1]+totals[2])+
              " (one match only; no last-20 claim).")
    print("Reuse/terms and extended coverage NOT established by an access test.")

if __name__=="__main__":
    main()
