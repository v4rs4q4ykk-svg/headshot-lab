# Headshot Lab

A CS2 headshot-history research dashboard with a target recurring cost of $0.

## Available now

- **iPhone dashboard:** https://v4rs4q4ykk-svg.github.io/headshot-lab/
- Python engine calculates completed Maps 1+2 headshots with exact player IDs,
  excludes partial matches and distinguishes over/under/push.
- GitHub Actions calculation tests.
- **Real historical research sample:** The public
  [blanchon/opencs2_dataset_demo](https://huggingface.co/datasets/blanchon/opencs2_dataset_demo)
  dataset successfully returned an older sample. A bounded collector validates
  complete Maps 1+2 results and saves them to `data/archive.json`.
- The dashboard displays these old match results in a **separate historical
  archive**, with original-match links, source attribution and clear dates.
  This sample is **not** a source of current player performance.

## Not finished / do not misrepresent

- **No reliable current professional CS2 headshot feed is connected.**
- **No authorized live PrizePicks projection feed is connected.**
- The historical sample is from April 2026 and does NOT provide the last 20
  current matches for all players; do not calculate L10/L15/L20 from an
  insufficient sample.
- The app is NOT a completed fully automatic current-day PrizePicks tracker.
  Source permission, coverage and freshness must be established before enabling
  a current feed.
- A `401 Unauthorized` on an older, incorrectly named sample source led to
  a corrected dataset ID, which the bounded probe and sample publisher have
  now accessed successfully. The fact a HISTORICAL source works does not mean
  live access works.
- Tournament organizers' terms may apply to underlying demo material.
  Archive is for attributed personal research; investigate rights before
  redistribution or commercial use.

## Tests and maintenance

- **Actions → Headshot Lab** runs the unit tests.
- **Actions → Probe historical CS2 data** checks a bounded source sample.
- **Actions → Publish historical CS2 sample** refreshes the bounded archived
  research sample on demand or when its collector code changes.
- Source is historical; do not schedule that collector as if it creates
  updated current match results.
- Never put API keys in this public repository or display missing stats as zero.

See [DATA_SOURCES.md](DATA_SOURCES.md) for sources considered and rejected.
