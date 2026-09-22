# Headshot Lab

CS2 headshot-history research app, being built for a $0 recurring budget.

## Current state

- GitHub Actions runs the Python unit tests.
- The calculation engine combines **Maps 1 and 2 only**, uses an exact player ID,
  excludes incomplete matches, distinguishes over/under/push, and shows
  "insufficient data" when fewer than 10, 15, or 20 completed matches exist.
- **There is no live feed, PrizePicks integration, website, or fully automatic
  tracker yet.** All tests use clearly identified fictional fixture data.

## Run tests

Run \`python3 -m unittest discover -s tests -v\` in a Python environment,
or use **Actions → Headshot Lab → Run workflow**.

## Data provider requirement

An authorized source must supply actual professional match records with:
\`match_id\`, \`player_id\`, \`played_at\` (time-zone-aware ISO-8601),
\`map_number\` (1 or 2), \`headshots\` (integer), and \`completed\` (boolean).

Historical FACEIT matchmaking stats are **not** assumed to represent the
professional tournament matches on a PrizePicks board. Do not put tokens in a
public repository. The collector will be added only after a suitable free
source and its permitted usage have been verified.
