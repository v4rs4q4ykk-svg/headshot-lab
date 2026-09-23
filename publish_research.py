"""Merge generated JSON into the latest main on an ephemeral Actions checkout."""
import json
import os
import subprocess
from pathlib import Path
from research_pipeline import build_catalog, write_json


def git(*args, check=True):
    return subprocess.run(["git", *args], check=check, capture_output=True, text=True)


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise SystemExit("Publication runs only in the disposable Actions checkout.")
    generated = {}
    for folder in ("data/player_histories", "data/requests"):
        for path in Path(folder).glob("*.json"):
            generated[path] = json.loads(path.read_text())
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    for attempt in range(3):
        git("fetch", "origin", "main")
        git("reset", "--hard", "origin/main")
        for path, incoming in generated.items():
            try:
                current = json.loads(path.read_text())
            except (OSError, ValueError):
                current = None
            if current:
                field = "retrieved_at" if "player_histories" in str(path) else "updated_at"
                if current.get("coverage", {}).get("full_player_scan") and not incoming.get("coverage", {}).get("full_player_scan"):
                    continue
                if incoming.get(field, "") < current.get(field, ""):
                    continue
                if "matches" in incoming and not incoming.get("coverage", {}).get("full_player_scan"):
                    matches = {m["id"]: m for m in current.get("matches", [])}
                    matches.update({m["id"]: m for m in incoming["matches"]})
                    incoming = {**incoming, "matches": sorted(matches.values(), key=lambda m: m["played_at"], reverse=True)[:60]}
            write_json(path, incoming)
        build_catalog()
        git("add", "data")
        if git("diff", "--cached", "--quiet", check=False).returncode == 0:
            return
        git("commit", "-m", "Refresh CS2 player, opponent and veto research")
        result = git("push", "origin", "HEAD:main", check=False)
        if result.returncode == 0:
            print("Published research successfully.")
            return
    raise SystemExit("Research is collected but publication conflicted after three attempts.")


if __name__ == "__main__":
    main()
