"""Find a stable player-id partition for missing names in BO3 index."""
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError
import json
base="https://api.bo3.gg/api/v1/filters/players"
queries=[
 {"search_text":"ZywOo","page[limit]":5},
 {"search_text":"NiKo","page[limit]":5},
 {"filter[players.id][eq]":49750,"page[limit]":5},
 {"filter[players.id][gt]":50000,"page[limit]":5},
 {"filter[players.id][lt]":50000,"page[limit]":5},
 {"page[limit]":500,"page[offset]":0},
]
for q in queries:
 q={"filter[discipline_id][eq]":1,**q}
 try:
  req=Request(base+"?"+urlencode(q),headers={"Accept":"application/json","User-Agent":"HeadshotLab-index-filter-check/0.1"})
  with urlopen(req,timeout=20) as r:
   data=json.load(r)
  print("query",q,"total",data.get("total"),"rows",len(data.get("results",[])),
       "first",[(x.get("id"),x.get("nickname")) for x in data.get("results",[])[:5]],flush=True)
 except HTTPError as e: print("query",q,"HTTP",e.code,flush=True)
