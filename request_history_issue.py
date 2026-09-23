"""Validate an owner request, including nickname-only searches, then execute it."""
import os
import re
from research_pipeline import execute


def parse_request(title, body):
    legacy = re.fullmatch(r"Headshot history request: ([1-9][0-9]{0,7})", title)
    current = re.fullmatch(r"CS2 research: ([^\r\n<>]{1,90})", title)
    if not legacy and not current:
        return None
    fields = {}
    for line in body.splitlines():
        key, sep, value = line.partition(": ")
        if sep:
            if key in fields:
                raise ValueError("Duplicate request field")
            fields[key] = value.strip()
    nickname = fields.get("Nickname", "")
    if not re.fullmatch(r"[^\r\n<>]{1,90}", nickname):
        raise ValueError("Invalid nickname")
    ident = legacy.group(1) if legacy else fields.get("Player ID")
    if ident and not re.fullmatch(r"[1-9][0-9]{0,7}", ident):
        raise ValueError("Invalid player ID")
    request = fields.get("Request ID")
    if request and not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", request):
        raise ValueError("Invalid request ID")
    return nickname, int(ident) if ident else None, request


def main():
    if not os.environ.get("ISSUE_AUTHOR") or os.environ["ISSUE_AUTHOR"] != os.environ.get("REPO_OWNER"):
        print("Ignoring research from an account other than the repository owner.")
        return
    request = parse_request(os.environ.get("ISSUE_TITLE", ""), os.environ.get("ISSUE_BODY", ""))
    if request:
        nickname, ident, request_id = request
        execute(nickname, ident, request_id or "issue-" + os.environ.get("ISSUE_NUMBER", "legacy"))


if __name__ == "__main__":
    main()
