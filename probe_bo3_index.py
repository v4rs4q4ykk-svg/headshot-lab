"""Bounded size-and-pagination test for BO3 identity index, no data publication."""
from urllib.request import Request,urlopen
from urllib.parse import urlencode
import json
for offset in (0,100):
 q=urlencode({"page[offset]":offset,"page[limit]":100,"filter[discipline_id][eq]":1})
 req=Request("https://api.bo3.gg/api/v1/filters/players?"+q,headers={"Accept":"application/json","User-Agent":"HeadshotLab-index-sizing/0.1"})
 with urlopen(req,timeout=20) as r:
  data=json.load(r)
 print("offset",offset,"total",data.get("total"),
       "count",len(data.get("results",[])),
       "examples",[(x.get("id"),x.get("nickname"),x.get("team_id")) for x in data.get("results",[])[:3]])
