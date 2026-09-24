# Headshot Lab server

This version removes the GitHub issue step from player searches. A same-origin
server searches BO3's public player records and streams verified Maps 1–2
headshots as matches arrive. The browser requests up to 60 candidates for 20
complete available series, then saves the result locally. Shared source
responses use an isolated named server cache when available; cache permission,
read or write failures fall back to direct source requests. Player lists expire
after five minutes and completed matches after one day.

Saved stats display immediately. First-time searches need source network calls;
they are automatic but not guaranteed to be instantaneous. Rate limits, missing
records and unavailable sources are shown as errors or partial coverage.

No source keys, GitHub tokens, payment information or paid data plan is required.
PrizePicks standard pre-game Maps 1–2 headshot lines load automatically from
the public projection feed, refresh every minute, and expire after 90 seconds.
Started games, alternate odds, promotions and other markets are excluded. An
unavailable feed clears comparisons instead of preserving an apparently live
line. Multiple upcoming offers are selectable by opponent and start time.

The leaderboard compares each current line with the latest 10, 15 or 20
verified available series, ranked by strictly-above-line share; pushes stay in
the denominator. These are not results against historical betting lines.
Only full player scans with enough series receive a rank. Unknown or ambiguous
player identities stay unranked. Two background loaders populate histories and
save up to 80 locally. `node scripts/warm-board.mjs` refreshes bundled snapshots
for the current board using the same source validation as searches.

Matchup/map metadata loads independently after
headshot history starts arriving. The experimental map model is unchanged.

Run `node build.mjs`, `node --test tests/api.test.mjs`, and
`node --test tests/test_analysis.cjs`. `node dev.mjs` serves the exact built
Worker implementation for browser tests. `node tests/browser.cjs` exercises
an actual cold Dragon search, comparisons, filters and a cached reload.
`node --test tests/lines.test.mjs` checks market filtering, identity ambiguity,
and stale/cache failure behavior. `node tests/board-browser.cjs` checks automatic
line changes, all three ranking windows, pushes and unavailable feed behavior.
