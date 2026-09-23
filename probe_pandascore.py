"""Read-only PandaScore fixtures-access check; does not fetch paid statistics.

Run via manual GitHub Action after repository secret PANDASCORE_TOKEN is set.
Never print the token, request headers, or complete response payloads.
"""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://api.pandascore.co"

def get(path, params):
    token = os.environ.get("PANDASCORE_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "PANDASCORE_TOKEN is not set. Add it under repository Settings "
            "> Secrets and variables > Actions. Never commit it."
        )
    url = API + path + "?" + urlencode(params)
    request = Request(
        url,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/json",
            "User-Agent": "Headshot-Lab/0.1 (fixtures verification)"
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except HTTPError as exc:
        raise SystemExit(
            "PandaScore request failed: HTTP "
            + str(exc.code)
            + ". Check account plan/token or endpoint access; "
            "the token and response body are intentionally hidden."
        ) from None
    except URLError:
        raise SystemExit("PandaScore network request failed (details hidden).") from None


def show(results, label, desired):
    if not isinstance(results, list):
        raise SystemExit(label + " response was not a list.")
    exact = [r for r in results if isinstance(r, dict) and
             str(r.get("name", "")).casefold() == desired.casefold()]
    print(label + ": " + str(len(results)) + " returned, " +
          str(len(exact)) + " exact name matches.")
    for p in exact[:10]:
        current_team = p.get("current_team")
        if not isinstance(current_team, dict):
            current_team = {}
        print("  id=" + str(p.get("id")) +
              " name=" + str(p.get("name")) +
              " slug=" + str(p.get("slug")) +
              " current_team=" + str(current_team.get("name", "unverified")))
    return exact


def main():
    print("Read-only PandaScore Fixtures test. No post-game headshot stats are requested.")
    players = get("/csgo/players", {"search[name]": "phoebe", "per_page": 30})
    matches = show(players, "Player search: phoebe", "phoebe")
    teams = get("/csgo/teams", {"search[name]": "Mindfreak", "per_page": 30})
    show(teams, "Team search: Mindfreak", "Mindfreak")
    if not matches:
        print("OUTCOME: phoebe missing from this API search; do not invent a PandaScore player ID.")
    else:
        print("OUTCOME: check the player's team and identity before linking fixtures.")
    print("This is NOT a headshot history test. Historical player stats require plan access.")
    print("Checking free player match listings for IDs and possible replay references.")
    try:
        history = get("/players/51078/matches", {"per_page": 25, "sort": "-begin_at"})
    except SystemExit as exc:
        print("Player match listing unavailable: " + str(exc))
        history = []
    if not isinstance(history, list):
        print("Player match listing had unexpected data type.")
        history = []
    print("Player match listing returned " + str(len(history)) + " matches.")
    for m in history[:20]:
        if not isinstance(m, dict):
            continue
        opponents = [str(x.get("opponent", {}).get("name", "?"))
                     for x in m.get("opponents", [])
                     if isinstance(x, dict) and isinstance(x.get("opponent"), dict)]
        links = sorted({key for key in m if "demo" in key.casefold() or "replay" in key.casefold()})
        print("  match id=" + str(m.get("id")) +
              " date=" + str(m.get("begin_at")) +
              " status=" + str(m.get("status")) +
              " opponents=" + ",".join(opponents)[:120] +
              " demo/replay fields=" + str(links))
    print("Fixture listings are NOT demo downloads or per-map headshot counts.")


if __name__ == "__main__":
    main()
