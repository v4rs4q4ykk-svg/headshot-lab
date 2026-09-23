"""Build a name/ID index for searchable CS2 players from BO3's public API.

This is an identity index, NOT per-player headshot history, a projection feed,
or authorized third-party licensed product access. Does not bypass Cloudflare,
impersonate a browser, use proxy rotation, or scrape website HTML. Only
minimal IDs and nicknames are kept. Stops on any HTTP 403/429.
"""
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE="https://api.bo3.gg/api/v1/filters/players"
OUT=Path("data/bo3_players.json")
LIMIT=100
MAX_PAGES=240
MAX_PLAYERS=24000
WAIT_SEC=0.65

def parse_page(payload):
    if not isinstance(payload,dict) or not isinstance(payload.get("results"),list):
        raise ValueError("Unexpected player-index data format")
    total=payload.get("total") or {}
    if not isinstance(total,dict):
        raise ValueError("Unexpected player-index total")
    count=total.get("count")
    if type(count) is not int or count<0 or count>MAX_PLAYERS:
        raise ValueError("Unexpected player-index size")
    players=[]
    for p in payload["results"]:
        if not isinstance(p,dict):
            continue
        ident=p.get("id")
        name=p.get("nickname")
        if type(ident) is not int or ident<=0 or not isinstance(name,str) or not name.strip():
            continue
        team=p.get("team_id")
        players.append({"id":ident,"name":name.strip(),
                        "team_id":team if type(team) is int and team>0 else None})
    return count,players

def get_page(offset):
    q=urlencode({"page[offset]":offset,"page[limit]":LIMIT,
                 "filter[discipline_id][eq]":1})
    req=Request(BASE+"?"+q,headers={"Accept":"application/json",
                                    "User-Agent":"HeadshotLab-index/0.1"})
    try:
        with urlopen(req,timeout=25) as res:
            body=res.read(500_001)
            if len(body)>500_000: raise ValueError("Index page exceeded size limit")
            return json.loads(body)
    except HTTPError as exc:
        raise SystemExit(f"Stopped index collection at {offset}: HTTP {exc.code}. No bypass attempted.") from None
    except (URLError,TimeoutError) as exc:
        raise SystemExit(f"Stopped index collection at {offset}: network unavailable.") from None

def collect(getter=get_page,sleep=time.sleep,clock=lambda:datetime.now(timezone.utc).isoformat()):
    seen={}
    expected=None
    for page in range(MAX_PAGES):
        offset=page*LIMIT
        if page:sleep(WAIT_SEC)
        payload=getter(offset)
        count,players=parse_page(payload)
        if expected is None:expected=count
        if count>MAX_PLAYERS:raise ValueError("Unexpected source size")
        if abs(count-expected)>LIMIT:
            raise ValueError("Index size shifted significantly during collection")
        if not players and offset<count:
            raise ValueError("Incomplete index: empty page before end")
        for p in players:
            if p["id"] in seen and seen[p["id"]]["name"]!=p["name"]:
                raise ValueError("Conflicting player ID; index not published")
            seen[p["id"]]=p
        if page%25==0:print(f"Indexed {len(seen)}/{count} minimal player records",flush=True)
        if offset+LIMIT>=count:
            if len(seen)<count-LIMIT:
                print("Source pagination overlaps substantially; publishing a transparently PARTIAL index.",flush=True)
            return {"schema_version":1,"kind":"identity_index_not_headshot_feed",
                    "source":"BO3.gg public CS2 player filter",
                    "retrieved_at":clock(),
                    "complete":len(seen)>=count-LIMIT,
                    "source_reported_count":count,
                    "players":sorted(seen.values(),key=lambda p:(p["name"].casefold(),p["id"]))}
    raise ValueError("Index exceeded safe page cap")

def main():
    record=collect()
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(record,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print(f"Saved {len(record['players'])}/{record['source_reported_count']} names/IDs; complete={record['complete']}; NOT headshot match history.")

if __name__=="__main__":
    main()
