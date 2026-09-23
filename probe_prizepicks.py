"""One-shot check of an unofficial, public PrizePicks projection endpoint.

NOT a live feed. No automatic retries, browser impersonation, auth spoofing,
anti-bot bypass, or persistent storage of an unlicensed projection dataset.
Returns only counts and a minimal CS2/headshot sample for access verification.
"""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

URL = "https://partner-api.prizepicks.com/projections?per_page=100"


def inspect(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ValueError("Response lacks the expected projections data array.")
    included = {}
    for obj in payload.get("included", []):
        if not isinstance(obj, dict):
            continue
        included[(str(obj.get("type")), str(obj.get("id")))] = obj.get("attributes") or {}
    total = len(payload["data"])
    cs2 = []
    headshots = []
    for obj in payload["data"]:
        if not isinstance(obj, dict):
            continue
        attributes = obj.get("attributes") or {}
        relation = ((obj.get("relationships") or {}).get("new_player") or {}).get("data") or {}
        player = included.get((str(relation.get("type")), str(relation.get("id"))), {})
        league = str(attributes.get("league") or player.get("league") or "")
        stat = str(attributes.get("stat_type") or "")
        # Only collect CS/CS2 names or stat types, never whole raw payloads.
        if not any(s in league.casefold() for s in ("cs2", "csgo", "counter-strike", "counter strike")):
            continue
        name = str(player.get("name") or attributes.get("description") or attributes.get("name") or "")
        point = {"name": name, "market": stat, "line": attributes.get("line_score"),
                 "league": league}
        cs2.append(point)
        if "headshot" in stat.casefold():
            headshots.append(point)
    print("JSON response format: valid.")
    print(f"Total projections in sampled page: {total}")
    print(f"Identified CS2/CSGO projections: {len(cs2)}")
    print(f"Identified CS2 headshot projections: {len(headshots)}")
    for p in headshots[:5]:
        print("Sample: " + json.dumps(p, ensure_ascii=False, sort_keys=True))
    found = [p for p in headshots if p["name"].strip().casefold() == "phoebe"]
    print(f"Phoebe headshot markets found in returned page: {len(found)}")
    for p in found[:3]:
        print("Phoebe: " + json.dumps(p, ensure_ascii=False, sort_keys=True))
    if len(headshots) == 0:
        print("OUTCOME: no usable CS2 headshot markets established.")
    else:
        print("OUTCOME: endpoint returned CS2 headshot data; freshness, completeness, "
              "pagination and permitted reuse are STILL unverified.")


def main():
    print("ONE-SHOT public endpoint test. No Cloudflare bypass, no storage, no feed deployment.")
    request = Request(URL, headers={"Accept": "application/json", "User-Agent": "Headshot-Lab-Access-Check/0.1"})
    try:
        with urlopen(request, timeout=20) as response:
            if response.status != 200:
                print(f"Access denied/unavailable: HTTP {response.status}")
                return
            content_type = response.headers.get("Content-Type", "")
            if "json" not in content_type.lower():
                print("Unexpected Content-Type; no data accepted.")
                return
            body = response.read(4_000_001)
            if len(body) > 4_000_000:
                print("Response exceeded bounded size; no data accepted.")
                return
            inspect(json.loads(body))
    except HTTPError as exc:
        print(f"Endpoint rejected request: HTTP {exc.code}; no workaround attempted.")
    except (URLError, TimeoutError) as exc:
        print("Endpoint unavailable: " + type(exc).__name__ + "; no workaround attempted.")
    except (ValueError, UnicodeDecodeError) as exc:
        print("Response was not usable JSON: " + str(exc))


if __name__ == "__main__":
    main()
