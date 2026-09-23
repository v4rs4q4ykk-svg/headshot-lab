"""Check whether a static GitHub Pages site can directly call the BO3 CS2 API.

A CORS header probe is not an attempt to bypass the browser's CORS policy.
No session cookies, proxies or forged browser user-agent.
"""
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ORIGIN = "https://v4rs4q4ykk-svg.github.io"
BASE = "https://api.bo3.gg/api/v1"
PATHS = [
 "/filters/players?search_text=phoebe&page%5Blimit%5D=1",
 "/matches?scope=widget-matches&page%5Blimit%5D=1",
 "/matches/mindfreak-vs-arcade-29-08-2026?with=games",
 "/games/172763/players_stats",
]

for path in PATHS:
    for method in ("OPTIONS", "GET"):
        req = Request(BASE+path, method=method,
            headers={"Origin": ORIGIN, "Accept": "application/json",
                     "User-Agent":"HeadshotLab-CORS-Research/0.1",
                     **({"Access-Control-Request-Method":"GET"} if method=="OPTIONS" else {})})
        try:
            with urlopen(req,timeout=12) as resp:
                if method=="GET":resp.read(150)
                print(method,path,resp.status,
                      "Allow-Origin",resp.headers.get("Access-Control-Allow-Origin"),
                      "Allow-Methods",resp.headers.get("Access-Control-Allow-Methods"))
        except HTTPError as e:
            print(method,path,"HTTP",e.code,
                  "Allow-Origin",e.headers.get("Access-Control-Allow-Origin"))
        except (URLError,TimeoutError) as e:
            print(method,path,type(e).__name__)
