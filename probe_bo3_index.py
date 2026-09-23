"""Compare BO3 player-filter pagination keys and sort determinism."""
from urllib.request import Request,urlopen
from urllib.parse import urlencode
import json
for sort in (None,"id","nickname"):
 ids={}
 for offset in (0,100,1000):
  q={"page[offset]":offset,"page[limit]":100,"filter[discipline_id][eq]":1}
  if sort:q["sort"]=sort
  req=Request("https://api.bo3.gg/api/v1/filters/players?"+urlencode(q),headers={"Accept":"application/json","User-Agent":"HeadshotLab-index-sizing/0.2"})
  with urlopen(req,timeout=20) as r:data=json.load(r)
  ids[offset]={v.get("id") for v in data.get("results",[])}
  print("sort",sort,"offset",offset,"total",data.get("total"),"count",len(ids[offset]),
        "first",[(x.get("id"),x.get("nickname")) for x in data.get("results",[])[:3]],flush=True)
 print("sort",sort,"overlap",len(ids[0]&ids[100]),len(ids[0]&ids[1000]),len(ids[100]&ids[1000]),flush=True)
