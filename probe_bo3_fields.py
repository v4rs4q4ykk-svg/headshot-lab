"""One-time, bounded access check for BO3.gg player stat fields.

No browser impersonation, bypass, scraping loop, caching, or production feed.
Print field names and bounded diagnostic samples only, not datasets.
"""
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE="https://api.bo3.gg/api/v1"
ROUTES=[
 ("/filters/players",{"search_text":"phoebe","page[limit]":"3","filter[discipline_id][eq]":"1"}),
 ("/players/phoebe/general_stats",{}),
 ("/players/phoebe/map_stats",{}),
 ("/players/phoebe/accuracy_stats",{}),
]

def request(path,query):
    uri=BASE+path+("?"+urlencode(query) if query else "")
    req=Request(uri,headers={"Accept":"application/json","User-Agent":"HeadshotLab-Single-Access-Test/0.1"})
    try:
        with urlopen(req,timeout=12) as rsp:
            if rsp.status!=200: return "HTTP "+str(rsp.status),None
            body=rsp.read(1_000_001)
            if len(body)>1_000_000:return "response over 1MB cap",None
            return "HTTP 200",json.loads(body)
    except HTTPError as exc:return "HTTP "+str(exc.code),None
    except (URLError,TimeoutError):return "network error",None
    except (UnicodeDecodeError,ValueError):return "not usable JSON",None

def fields(x,prefix="",depth=0):
    if depth>3:return []
    if isinstance(x,list):
        return fields(x[0],prefix+"[0].",depth+1) if x else []
    if isinstance(x,dict):
        out=[]
        for k,v in list(x.items())[:30]:
            path=prefix+str(k)
            out.append(path)
            out+=fields(v,path+".",depth+1) if isinstance(v,(dict,list)) else []
        return out
    return []

def main():
    print("One-shot no-bypass BO3.gg API field test.")
    for path,query in ROUTES:
        status,payload=request(path,query)
        print("Route "+path+": "+status)
        if payload is not None:
            names=fields(payload)
            print("  Top-level type: "+type(payload).__name__)
            print("  Fields: "+json.dumps(names[:65]))
            hs=[name for name in names if any(w in name.lower() for w in ("headshot","head_shot","hs","map_number"))]
            print("  Candidate HS/map fields: "+json.dumps(hs[:30]))
    print("No full feed or licensing established by this test.")

if __name__=="__main__":
    main()
