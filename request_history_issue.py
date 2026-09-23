"""Strictly validate a GitHub issue request before any CS2 API request."""
import os
import re

title=os.environ.get("ISSUE_TITLE","")
body=os.environ.get("ISSUE_BODY","")
actor=os.environ.get("ISSUE_AUTHOR","")
owner=os.environ.get("REPO_OWNER","")
if not actor or actor!=owner:
    raise SystemExit("Only this repo owner may request a research fetch.")
match=re.fullmatch(r"Headshot history request: ([1-9][0-9]{0,7})",title)
name=re.fullmatch(r"Nickname: ([^\r\n<>]{1,90})\s*",body)
if not match or not name:
    raise SystemExit("Invalid research request")
with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf-8") as f:
    print("id="+match.group(1),file=f)
    print("nickname="+name.group(1).strip(),file=f)
