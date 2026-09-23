# Headshot Lab

A CS2 headshot-history research dashboard with a target recurring cost of $0.

## Available now

- **iPhone dashboard:** https://v4rs4q4ykk-svg.github.io/headshot-lab/
- Python engine calculates completed Maps 1+2 headshots with exact player IDs,
  excludes partial matches and distinguishes over/under/push.
- GitHub Actions calculation tests.
- **Verified phoebe research example:** A bounded BO3.gg per-map test returned
  20 complete available Maps 1+2 CS2 series with exact integer headshot
  counts. The dashboard now displays phoebe's L10/L15/L20 averages,
  over/under/push against a **saved** 14-headshot screenshot line, and
  20 dated per-map totals. Five other match candidates were excluded;
  these are NOT necessarily her last 20 matches played.
  See [the verified research run](https://github.com/v4rs4q4ykk-svg/headshot-lab/actions/runs/35810256579).
- **PrizePicks access proof:** A one-time public endpoint test retrieved CS2
  headshot markets, including phoebe's saved 14 line. This does not establish
  licensed/authorized continuous access or fresh availability.

- **Real historical research sample:** The public
  [blanchon/opencs2_dataset_demo](https://huggingface.co/datasets/blanchon/opencs2_dataset_demo)
  dataset successfully returned an older sample. A bounded collector validates
  complete Maps 1+2 results and saves them to `data/archive.json`.
- The dashboard displays these old match results in a **separate historical
  archive**, with original-match links, source attribution and clear dates.
  This sample is **not** a source of current player performance.

## Not finished / do not misrepresent

- **The BO3.gg per-game endpoint returned exact map headshots in a bounded test,
  but an authorized recurring full-board collection/feed is NOT connected.**
- **One-time PrizePicks endpoint access worked; an authorized recurring live
  projection feed is NOT connected.**
- The older archive is from April 2026; the separate phoebe research sample
  covers October 2025–August 2026 and must not be mislabeled live/current.
  Neither is full-board, updated September player coverage.
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

## Search and per-player research connection

The **BO3.gg identity index** is published at `data/bo3_players.json`;
its first completed run indexed **15,561 unique valid names/IDs** from a
source-reported 20,508. BO3's paginated source overlapped, so the index
explicitly sets `complete=false`; it is not a claim to include every player.
The GitHub Pages player-search UI reads this local index. BO3 returned no
CORS allowance for the Pages origin, so the browser cannot call BO3 directly.

A separate **bounded, user-initiated research bridge** is connected through
GitHub issues: search a listed nickname, press "Check headshot history",
then submit the prefilled GitHub request using the connected repo owner
account. An Actions job collects that specific player's available complete
Map 1+2 series and publishes `data/player_histories/<BO3_ID>.json`.
It is free, may take a few minutes, and is not instant or automatic
when merely typing a player nickname. Any missing/ambiguous records stay
missing, not zero-filled. The first test issue, #2, completed successfully:
https://github.com/v4rs4q4ykk-svg/headshot-lab/actions/runs/35872077782

The older data and the on-demand research do NOT imply a current PrizePicks
projection connection, full last-20 game coverage, automated refresh of every
player, or redistribution rights granted by the data suppliers. PrizePicks'
August 2026 terms prohibit robotic access to its Site/App (section 16(l));
therefore the undocumented, previously accessible endpoint is not installed
as a scheduled collector.
