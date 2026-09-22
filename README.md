# Headshot Lab

CS2 headshot-history research tracker with a target recurring cost of $0.

## What works

- GitHub Actions runs Python unit tests.
- The calculation engine combines **Maps 1 and 2 only**, uses exact player IDs,
  excludes incomplete matches, distinguishes over/under/push, and reports
  "insufficient data" if fewer than 10, 15, or 20 completed matches exist.
- Calculation and replay-schema tests use **fictional fixtures**, not live stats.

## What is blocked or unverified

- **September 22, 2026:** the first attempt to retrieve
  blanchon/cs2_dataset_demo_test through the Hugging Face dataset-viewer
  /rows endpoint failed with **HTTP 401 Unauthorized**. Do not infer that
  the source is freely accessible, and do not purchase anything for it.
- The source's actual fields, available games, licensing for our use, and
  current coverage remain **unverified**. replay_dataset.py is a tentative
  normalization adapter for a proposed event/roster schema, not a verified
  production importer.
- We do **not** have a live professional CS2 feed, PrizePicks integration,
  automated updates, or a completed iPhone dashboard yet. No live-data
  success should be inferred from green unit-test checks.
- FACEIT matchmaking results are not interchangeable with the professional
  tournament matches on the PrizePicks board.

## Run tests

Use Actions → Headshot Lab or run:

    python3 -m unittest discover -s tests -v

## Source requirements

Before deploying automated collection, independently verify an authorized,
free source that supplies real completed professional matches with a match ID,
exact player ID, correct map 1/2 headshot counts and dates, and adequate
coverage for the players on the board. Check usage terms and freshness.

Do not put API keys or passwords in this public repository. Missing data must
stay missing, never be replaced with zeros or fabricated stats.
